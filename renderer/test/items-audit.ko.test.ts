import { beforeAll, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { init } from '@/assets/data'
import { parseClipboard } from '@/parser'
import { createPresets } from '@/web/price-check/filters/create-presets'
import { createTradeRequest } from '@/web/price-check/trade/pathofexile-trade'

vi.mock('@/web/Config', () => ({ AppConfig: () => ({}) }))
vi.mock('@/web/background/IPC', () => ({ Host: {} }))
beforeAll(async () => { await init('ko') })
const options = { league: 'Covens', merchantOnly: false, currency: null, collapseListings: 'app' as const, activateStockFilter: false, useEn: true, searchStatRange: 0 }
const dir = process.env.ITEM_AUDIT_FULL ? new URL('../../tools/data-generator/out/item-listings/', import.meta.url) : new URL('./fixtures/listings-items/', import.meta.url)
interface Listing {
  name: string
  baseType: string
  sourceIndex?: number
  expectedAudit?: { category: string, unknown: string[], mismatched: unknown[], missing: string[], enabled: string[] }
  extended: { text: string, hashes?: Record<string, Array<[string, number[]]>> }
}
export function clipboardText (encoded: string) {
  return Buffer.from(encoded, 'base64').toString('utf8').replace(/\r\n/g, '\n').replace(/\n--------\n메모:[\s\S]*$/, '').trimEnd() + '\n'
}
it('audits real Korean item clipboard text and trade identities', () => {
  const report: Record<string, ReturnType<typeof audit>[]> = {}
  const expectedFull = process.env.ITEM_AUDIT_FULL && !process.env.ITEM_AUDIT_DISCOVERY
    ? JSON.parse(readFileSync(new URL('../../docs/analysis/phase2/12-item-audit-details.json', import.meta.url), 'utf8')) as Record<string, Listing['expectedAudit'][]>
    : undefined
  function audit (listing: Listing, index: number) {
    const row = { index, name: listing.name, base: listing.baseType, parsed: false, category: '', error: '', unknown: [] as string[], mismatched: [] as unknown[], missing: [] as string[], requestError: '', enabled: [] as string[] }
    const result = parseClipboard(clipboardText(listing.extended.text))
    if (result.isErr()) { row.error = result.error; return row }
    const item = result.value
    row.parsed = true
    row.category = item.category ?? ''
    row.unknown = item.unknownModifiers.map(mod => mod.text)
    const expected = new Set(Object.values(listing.extended.hashes ?? {}).flatMap(entries => entries.map(([id]) => id)))
    const recognized = new Set<string>()
    for (const calc of item.statsByType) {
      const ids = calc.stat.trade.ids[calc.type] ?? []
      ids.forEach(id => recognized.add(id))
      if (ids.length && !ids.some(id => expected.has(id))) row.mismatched.push({ ref: calc.stat.ref, ids, type: calc.type })
    }
    row.missing = [...expected].filter(id => !recognized.has(id))
    try {
      const presets = createPresets(item, options)
      const preset = presets.presets.find(preset => preset.id === presets.active)!
      const request = createTradeRequest(preset.filters, preset.stats)
      row.enabled = request.query.stats.flatMap(group => group.filters).filter(filter => !filter.disabled).map(filter => filter.id)
    } catch (error) { row.requestError = String(error) }
    return row
  }
  for (const file of readdirSync(dir).filter(file => file.endsWith('.json') && file !== 'summary.json').sort()) {
    const listings: Listing[] = JSON.parse(readFileSync(new URL(file, dir), 'utf8'))
    if (!listings.length) continue
    if (!process.env.ITEM_AUDIT_FULL) {
      expect(listings.length).toBeGreaterThanOrEqual(3)
      expect(listings.length).toBeLessThanOrEqual(5)
      for (const listing of listings) {
        expect(Object.keys(listing).sort()).toEqual(['baseType', 'expectedAudit', 'extended', 'name', 'sourceIndex'])
        expect(Object.keys(listing.extended).sort()).toEqual(listing.extended.hashes ? ['hashes', 'text'] : ['text'])
        expect(Buffer.from(listing.extended.text, 'base64').toString('utf8')).not.toMatch(/(?:^|\n)메모:/)
      }
    }
    const type = file.replace('.json', '')
    const rows = listings.map((listing, index) => audit(listing, listing.sourceIndex ?? index))
    report[type] = rows
    if (!process.env.ITEM_AUDIT_DISCOVERY) rows.forEach((row, index) => {
      const known = expectedFull?.[type][index] ?? listings[index].expectedAudit
      expect(known, `${type}[${row.index}] reviewed residual issues`).toBeDefined()
      for (const field of ['category', 'unknown', 'mismatched', 'missing', 'enabled'] as const) expect(row[field], `${type}[${row.index}] ${field}`).toEqual(known![field])
    })
  }
  if (process.env.ITEM_AUDIT_OUTPUT) writeFileSync(process.env.ITEM_AUDIT_OUTPUT, JSON.stringify(report, null, 2) + '\n')
  if (!process.env.ITEM_AUDIT_DISCOVERY) for (const [type, rows] of Object.entries(report)) for (const row of rows) {
    expect(row.parsed, `${type}[${row.index}] ${row.error}`).toBe(true)
    expect(row.category, `${type}[${row.index}] category`).not.toBe('')
    expect(row.requestError, `${type}[${row.index}] request`).toBe('')
  }
  expect(Object.keys(report)).toHaveLength(24)
})
