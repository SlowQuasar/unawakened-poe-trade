import { beforeAll, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { init } from '@/assets/data'
import { parseClipboard, ItemCategory, ItemInfluence, ItemRarity } from '@/parser'
import { ModifierType } from '@/parser/modifiers'
import { tryParseTranslation } from '@/parser/stat-translations'
import { createPresets } from '@/web/price-check/filters/create-presets'
import { createExactStatFilters } from '@/web/price-check/filters/create-stat-filters'
import { createTradeRequest } from '@/web/price-check/trade/pathofexile-trade'
import type { StatFilter } from '@/web/price-check/filters/interfaces'

vi.mock('@/web/Config', () => ({ AppConfig: () => ({}) }))
vi.mock('@/web/background/IPC', () => ({ Host: {} }))

beforeAll(async () => { await init('ko') })
const options = {
  league: 'Standard', merchantOnly: false, currency: null,
  collapseListings: 'app' as const, activateStockFilter: false, useEn: true, searchStatRange: 0
}
function sample (file: string) {
  const result = parseClipboard(readFileSync(new URL(`./fixtures/ko/3.30-${file}.txt`, import.meta.url), 'utf8'))
  if (result.isErr()) throw new Error(result.error)
  return result.value
}
function activePreset (item: ReturnType<typeof sample>) {
  const result = createPresets(item, options)
  return result.presets.find(preset => preset.id === result.active)!
}
function explicitFilters (stats: ReturnType<typeof activePreset>['stats']): StatFilter[] {
  return stats.filter((filter): filter is StatFilter => !('group' in filter) && filter.sources.some(source => source.modifier.info.type === ModifierType.Explicit))
}

it('nightmare default request omits Atlas Drops, searches Threads and exposes unchecked danger mods', () => {
  const item = sample('rare-nightmare-map')
  expect(item.mapMoreScarabs).toBe(95)
  const preset = activePreset(item)
  const request = createTradeRequest(preset.filters, preset.stats)
  expect(request.query.filters.map_filters?.filters.map_bonus).toBeUndefined()
  expect(request.query.stats.flatMap(group => group.filters)).toContainEqual(expect.objectContaining({
    id: 'pseudo.pseudo_map_more_scarab_drops', value: expect.objectContaining({ min: 95 }), disabled: false
  }))
  const explicit = explicitFilters(preset.stats)
  expect(explicit.length).toBeGreaterThan(0)
  expect(explicit.every(filter => filter.disabled && !filter.hidden)).toBe(true)
})

it('hunter default request enables its Citadel and Wildwood while disabling danger mods', () => {
  const item = sample('rare-map-hunter-citadel')
  expect(item.unknownModifiers).toEqual([])
  const preset = activePreset(item)
  for (const id of ['implicit.stat_2563183002|3', 'explicit.stat_1975119765']) {
    expect(preset.stats.find(filter => !('group' in filter) && filter.tradeId.includes(id))).toMatchObject({ disabled: false })
  }
  const request = createTradeRequest(preset.filters, preset.stats)
  expect(request.query.stats.flatMap(group => group.filters)).toContainEqual(expect.objectContaining({
    id: 'implicit.stat_2563183002|3', disabled: false
  }))
  expect(request.query.stats.flatMap(group => group.filters)).toContainEqual(expect.objectContaining({ id: 'explicit.stat_1975119765', disabled: false }))
  expect(explicitFilters(preset.stats).filter(filter => !filter.tradeId.includes('explicit.stat_1975119765')).every(filter => filter.disabled)).toBe(true)
  const bulk = createExactStatFilters(item, item.statsByType, { searchStatRange: 0, mode: 'bulk' })
  // This clipboard lacks a separate influence line, so bulk keeps its normal implicit behavior.
  expect(bulk.some(filter => filter.tradeId.includes('implicit.stat_2563183002|3'))).toBe(true)
  expect(bulk.some(filter => filter.tradeId.includes('explicit.stat_1975119765'))).toBe(false)
  const rareMonsters = item.statsByType.find(calc => calc.stat.ref === '#% increased number of Rare Monsters')
  expect(rareMonsters?.sources[0].stat.roll).toMatchObject({ value: 25, min: 20, max: 30 })
})

it('strips only literal textual ranges and recognizes every Citadel option', () => {
  for (const [name, option] of [['바란', 1], ['베리타니아', 2], ['알-헤즈민', 3], ['드록스', 4]] as const) {
    const parsed = tryParseTranslation({ string: `지도에 ${name}의 시타델(...) 등장`, unscalable: true }, ModifierType.Implicit, ItemCategory.Map)
    expect(parsed?.stat.trade.ids.implicit).toEqual([`implicit.stat_2563183002|${option}`])
  }
  expect(tryParseTranslation({ string: '지도에 알-헤즈민의 시타델(다른 설명) 등장', unscalable: false }, ModifierType.Implicit, ItemCategory.Map)).toBeUndefined()
})

it('enables each requested map content modifier in the props preset', () => {
  const original = readFileSync(new URL('./fixtures/ko/3.30-rare-map-hunter-citadel.txt', import.meta.url), 'utf8')
  for (const text of [
    '지역에 묻힌 대혼란 파수꾼 등장', '지역에 묻힌 거물 파수꾼 등장', '지역에 묻힌 추적자 파수꾼 등장',
    '지역에 베이다트의 환기자 1마리 등장', '지역에 크타쉬의 환기자 1마리 등장', '지역에 고르의 환기자 1마리 등장',
    '지역에 신기루 등장', '지역에 환영의 거울 등장'
  ]) {
    const result = parseClipboard(original.replace('지역에 취록의 야생림 등장', text))
    if (result.isErr()) throw new Error(result.error)
    expect(result.value.unknownModifiers, text).toEqual([])
    const parsed = tryParseTranslation({ string: text, unscalable: false }, ModifierType.Explicit, ItemCategory.Map)!
    expect(explicitFilters(activePreset(result.value).stats).find(filter => filter.statRef === parsed.stat.ref), text).toMatchObject({ disabled: false })
  }
})

it('retains legacy Scarabs parsing alongside Threads', () => {
  const original = readFileSync(new URL('./fixtures/ko/3.30-rare-nightmare-map.txt', import.meta.url), 'utf8')
  const result = parseClipboard(original.replace('실낱 더 많음: ', '갑충석 더 많음: '))
  if (result.isErr()) throw new Error(result.error)
  expect(result.value.mapMoreScarabs).toBe(95)
})

it('includes influenced rare-map implicits only outside bulk and preserves blighted/unique rules', () => {
  const item = { ...sample('rare-map-hunter-citadel'), influences: [ItemInfluence.Hunter] }
  expect(createExactStatFilters(item, item.statsByType, { searchStatRange: 0, mode: 'props' })
    .find(filter => filter.tradeId.includes('implicit.stat_2563183002|3'))).toMatchObject({ disabled: false })
  expect(createExactStatFilters(item, item.statsByType, { searchStatRange: 0, mode: 'bulk' })
    .some(filter => filter.tradeId.includes('implicit.stat_2563183002|3'))).toBe(false)
  const unique = { ...item, rarity: ItemRarity.Unique }
  expect(createExactStatFilters(unique, unique.statsByType, { searchStatRange: 0, mode: 'props' })
    .some(filter => filter.sources.some(source => source.modifier.info.type === ModifierType.Explicit))).toBe(false)
  const blighted = { ...item, info: { ...item.info, area: { ...item.info.area!, blighted: true } } }
  expect(createExactStatFilters(blighted, blighted.statsByType, { searchStatRange: 0, mode: 'props' })).toEqual([])
})
