import { beforeAll, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { init } from '@/assets/data'
import { parseClipboard, ItemCategory, type ParsedItem } from '@/parser'
import { createPresets } from '@/web/price-check/filters/create-presets'
import { createTradeRequest } from '@/web/price-check/trade/pathofexile-trade'
import { displayText, listingToClipboard, type MapListing } from './helpers/listing-to-clipboard'

vi.mock('@/web/Config', () => ({ AppConfig: () => ({}) }))
vi.mock('@/web/background/IPC', () => ({ Host: {} }))
beforeAll(async () => { await init('ko') })
const options = { league: 'Covens', merchantOnly: false, currency: null, collapseListings: 'app' as const, activateStockFilter: false, useEn: true, searchStatRange: 0 }
const dir = process.env.MAP_AUDIT_FULL
  ? new URL('../../tools/data-generator/out/map-listings/', import.meta.url)
  : new URL('./fixtures/listings/', import.meta.url)
const fields: Record<string, keyof ParsedItem> = {
  '아틀라스 획득물': 'areaAtlasDrops', '아이템 희귀도': 'areaItemRarity', '몬스터 무리 규모': 'areaPackSize',
  '지도 더 많음': 'mapMoreMaps', '실낱 더 많음': 'mapMoreScarabs', '갑충석 더 많음': 'mapMoreScarabs', '화폐 더 많음': 'mapMoreCurrency', '점술 카드 더 많음': 'mapMoreDivCards'
}

it('audits every supplied map and records recognized IDs, properties and default requests', () => {
  const report: Record<string, ReturnType<typeof audit>[]> = {}
  function audit (listing: MapListing, index: number) {
    const row = { index, name: listing.name, base: listing.baseType, excluded: false, parsed: false, error: '', unknown: [] as string[], mismatched: [] as unknown[], missing: [] as string[], propertyErrors: [] as string[], requestError: '', enabled: [] as string[], filters: {} as unknown }
    // Preserve input contamination in the report without creating fake maps.
    if (!listing.baseType.includes('지도')) { row.excluded = true; return row }
    const result = parseClipboard(listingToClipboard(listing))
    if (result.isErr()) { row.error = result.error; return row }
    const item = result.value
    row.parsed = item.category === ItemCategory.Map
    if (!row.parsed) row.error = `category=${item.category}`
    row.unknown = item.unknownModifiers.map(mod => mod.text).filter(text => !text.startsWith('('))
    const expected = new Set(Object.values(listing.extended?.hashes ?? {}).flatMap(entries => entries.map(([id]) => id)))
    const recognized = new Set<string>()
    for (const calc of item.statsByType) {
      const ids = calc.stat.trade.ids[calc.type] ?? []
      ids.forEach(id => recognized.add(id))
      if (ids.length && !ids.some(id => expected.has(id))) row.mismatched.push({ ref: calc.stat.ref, ids, type: calc.type })
    }
    row.missing = [...expected].filter(id => !recognized.has(id))
    for (const prop of listing.properties ?? []) {
      const name = displayText(prop.name)
      const field = fields[name]
      if (field && item[field] !== parseInt(prop.values[0]?.[0], 10)) row.propertyErrors.push(`${name}: ${String(item[field])}`)
      if (name === '지도 지역' && item.mapArea?.name !== prop.values[0]?.[0]) row.propertyErrors.push(name)
    }
    try {
      const presets = createPresets(item, options)
      const preset = presets.presets.find(preset => preset.id === presets.active)!
      const request = createTradeRequest(preset.filters, preset.stats)
      row.enabled = request.query.stats.flatMap(group => group.filters).filter(filter => !filter.disabled).map(filter => filter.id)
      row.filters = request.query.filters
    } catch (error) { row.requestError = String(error) }
    return row
  }
  for (const file of readdirSync(dir).filter(file => file.endsWith('.json') && file !== 'summary.json').sort()) {
    const listings: MapListing[] = JSON.parse(readFileSync(new URL(file, dir), 'utf8'))
    if (process.env.MAP_AUDIT_FULL) expect(listings).toHaveLength(20)
    else {
      expect(listings.length).toBeGreaterThanOrEqual(3)
      expect(listings.length).toBeLessThanOrEqual(5)
    }
    const rows = listings.map(audit)
    expect(rows.some(row => !row.excluded), file).toBe(true)
    report[file.replace('.json', '')] = rows
  }
  if (process.env.MAP_AUDIT_OUTPUT) writeFileSync(process.env.MAP_AUDIT_OUTPUT, JSON.stringify(report, null, 2) + '\n')
  if (!process.env.MAP_AUDIT_DISCOVERY) {
    for (const [type, rows] of Object.entries(report)) {
      for (const row of rows.filter(row => !row.excluded)) {
        expect(row.parsed, `${type}[${row.index}]: ${row.error}`).toBe(true)
        expect(row.unknown, `${type}[${row.index}] unknown`).toEqual([])
        expect(row.mismatched, `${type}[${row.index}] wrong recognized IDs`).toEqual([])
        expect(row.missing, `${type}[${row.index}] missing API IDs`).toEqual([])
        expect(row.propertyErrors, `${type}[${row.index}] properties`).toEqual([])
        expect(row.requestError, `${type}[${row.index}] request`).toBe('')
      }
    }
  }
  expect(Object.keys(report)).toHaveLength(17)
})

