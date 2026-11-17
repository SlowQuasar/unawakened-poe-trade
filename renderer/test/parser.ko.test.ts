import { beforeAll, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseClipboard, ItemCategory, ItemRarity } from '@/parser'
import { ModifierType } from '@/parser/modifiers'
import { createFilters } from '@/web/price-check/filters/create-item-filters'
import { mapProps } from '@/web/price-check/filters/pseudo/maps'
import { createTradeRequest } from '@/web/price-check/trade/pathofexile-trade'
import type { FiltersCreationContext } from '@/web/price-check/filters/create-stat-filters'

vi.mock('@/web/Config', () => ({ AppConfig: () => ({}) }))
vi.mock('@/web/background/IPC', () => ({ Host: {} }))
import { init } from '@/assets/data'
import * as data from '@/assets/data'
import { amulet, cloak, fixtureTests, nebulis } from './parser-cases'

describe('Korean real clipboard samples', () => {
  beforeAll(async () => { await init('ko') })

  fixtureTests('ko', 'unique-body-cloak-of-flame.txt', cloak)
  fixtureTests('ko', 'rare-amulet-anointed-crafted.txt', amulet)
  fixtureTests('ko', 'unique-synthesised-sceptre-nebulis.txt', nebulis)
})

const filterOptions = {
  league: 'Standard', merchantOnly: false, currency: null,
  collapseListings: 'app' as const, activateStockFilter: false, exact: true, useEn: true
}

function sample330 (file: string) {
  const result = parseClipboard(readFileSync(new URL(`./fixtures/ko/3.30-${file}.txt`, import.meta.url), 'utf8'))
  expect(result.isOk(), result.isErr() ? result.error : undefined).toBe(true)
  if (result.isErr()) throw new Error(result.error)
  return result.value
}

describe('Korean 3.30 real clipboard samples', () => {
  beforeAll(async () => { await init('ko') })

  it('unidentified corrupted rare mace preserves its implicit', () => {
    const item = sample330('rare-twohand-mace-unidentified-corrupted')
    expect(item.info.refName).toBe('Karui Maul')
    expect(item.rarity).toBe(ItemRarity.Rare)
    expect(item.category).toBe(ItemCategory.TwoHandedMace)
    expect(item.isUnidentified).toBe(true)
    expect(item.isCorrupted).toBe(true)
    expect(item.newMods.map(mod => [mod.info.type, mod.stats.map(stat => stat.stat.ref)])).toEqual([
      [ModifierType.Implicit, ['#% increased Stun Duration on Enemies']]
    ])
    expect(item.unknownModifiers).toEqual([])
  })

  it('Atlas Drops parses and generates map_bonus while retaining map_iiq', () => {
    const item = sample330('rare-map-atlas-drops')
    expect(item.category).toBe(ItemCategory.Map)
    expect(item.areaAtlasDrops).toBe(64)
    expect(item.areaItemQuantity).toBeUndefined()
    expect(item.areaItemRarity).toBe(37)
    expect(item.areaPackSize).toBe(24)
    expect(item.newMods).toHaveLength(4)
    expect(item.unknownModifiers).toEqual([])
    const ctx: FiltersCreationContext = { item, searchInRange: 0, filters: [], groups: [], statsByType: item.statsByType }
    mapProps(false, ctx)
    const atlas = ctx.filters.find(filter => filter.tradeId.includes('item.map_atlas_drops'))!
    expect(atlas.disabled).toBe(true)
    expect(createTradeRequest(createFilters(item, filterOptions), ctx.filters).query.filters.map_filters?.filters.map_bonus).toBeUndefined()
    atlas.disabled = false
    expect(atlas.roll?.value).toBe(64)
    atlas.roll!.min = 60
    atlas.roll!.max = 80
    const request = createTradeRequest(createFilters(item, filterOptions), ctx.filters)
    expect(request.query.filters.map_filters?.filters.map_bonus).toEqual({ min: 60, max: 80 })
    expect(request.query.filters.map_filters?.filters.map_iiq).toBeUndefined()
    const legacyCtx = { ...ctx, item: { ...item, areaItemQuantity: 50 }, filters: [] }
    mapProps(false, legacyCtx)
    expect(createTradeRequest(createFilters(item, filterOptions), legacyCtx.filters).query.filters.map_filters?.filters.map_iiq?.min).toBe(50)
  })

  it('Royal Astrolabe', () => {
    const item = sample330('currency-royal-astrolabe')
    expect(item.info.refName).toBe('Royal Astrolabe')
    expect(item.category).toBe(ItemCategory.Currency)
    expect(item.stackSize).toEqual({ value: 1, max: 10 })
  })

  it('Expedition Thread', () => {
    const item = sample330('thread-expedition')
    expect(item.info.refName).toBe('Expedition Thread')
    expect(item.rarity).toBe(ItemRarity.Normal)
    expect(item.stackSize).toEqual({ value: 73, max: 100 })
  })

  for (const [file, slot, level, refName] of [
    ['viscera-arm-gargantuan-claw', 'arm', 83, 'Gargantuan Claws'],
    ['viscera-arm-lesser-swordsman-blade', 'arm', 38, "Swordmaster's Blade"],
    ['viscera-head-hungry-skull', 'head', 73, 'Ravenous Skull']
  ] as const) {
    it(file, () => {
      const item = sample330(file)
      expect(item.category).toBe(ItemCategory.Viscera)
      expect(item.rarity).toBeUndefined()
      expect(item.info.refName).toBe(refName)
      expect(item.visceraSlot).toBe(slot)
      expect(item.itemLevel).toBe(level)
      expect(item.newMods).toHaveLength(1)
      expect(item.newMods[0].info.type).toBe(ModifierType.Implicit)
      if (slot === 'head') {
        // 3.30 "within 5 metres" wording, provided by the generated stats data
        expect(item.unknownModifiers).toEqual([])
        expect(item.newMods[0].stats.map(stat => stat.stat.trade.ids.implicit)).toEqual([
          ['implicit.stat_3764198549'],
          ['implicit.stat_1645957840']
        ])
      } else {
        expect(item.unknownModifiers).toEqual([])
        expect(item.newMods[0].stats.map(stat => stat.stat.ref)).toEqual([
          file.includes('claw') ? '#% increased Attack Speed with Claws' : '#% increased Attack Speed with Swords'
        ])
      }
      const filters = createFilters(item, filterOptions)
      expect(createTradeRequest(filters, []).query.filters.type_filters?.filters.category?.option).toBe(`viscera.${slot}`)
      filters.visceraSlot = undefined
      expect(createTradeRequest(filters, []).query.filters.type_filters?.filters.category?.option).toBe('viscera')
    })
  }
})

// Isolate parser behavior while the separately maintained 3.30 item database is pending.
// These test-only records are not evidence of the official English item names.
describe('Viscera parser with synthetic lookup records', () => {
  beforeAll(async () => { await init('ko') })

  it('reuses base lookup, retains absent rarity, and routes implicit mods and all slots', () => {
    const lookup = data.ITEM_BY_TRANSLATED
    const spy = vi.spyOn(data, 'ITEM_BY_TRANSLATED').mockImplementation((ns, name) => {
      if (ns === 'ITEM' && name === '검술가의 칼날') {
        return [{ name, refName: 'Synthetic Viscera Blade', namespace: 'ITEM', icon: '', craftable: { category: ItemCategory.Viscera } }]
      }
      return lookup(ns, name)
    })
    try {
      const original = readFileSync(new URL('./fixtures/ko/3.30-viscera-arm-lesser-swordsman-blade.txt', import.meta.url), 'utf8')
      for (const [label, slot] of [['상지', 'arm'], ['머리', 'head'], ['몸통', 'body'], ['하지', 'leg'], ['unknown slot', undefined]] as const) {
        const result = parseClipboard(original.replace('상지', label))
        expect(result.isOk(), result.isErr() ? result.error : undefined).toBe(true)
        if (result.isErr()) throw new Error(result.error)
        const item = result.value
        expect(item.info.refName).toBe('Synthetic Viscera Blade')
        expect(item.rarity).toBeUndefined()
        expect(item.category).toBe(ItemCategory.Viscera)
        expect(item.visceraSlot).toBe(slot)
        expect(item.newMods).toHaveLength(1)
        expect(item.newMods[0].info.type).toBe(ModifierType.Implicit)
        expect(item.unknownModifiers.every(mod => mod.type === ModifierType.Implicit)).toBe(true)
        expect(createTradeRequest(createFilters(item, filterOptions), []).query.filters.type_filters?.filters.category?.option).toBe(slot ? `viscera.${slot}` : 'viscera')
      }
    } finally {
      spy.mockRestore()
    }
  })
})
