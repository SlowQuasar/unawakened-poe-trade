import { beforeAll, expect, it, vi } from 'vitest'
import { init } from '@/assets/data'
import { parseClipboard } from '@/parser'
import { createPresets } from '@/web/price-check/filters/create-presets'
import { createTradeRequest } from '@/web/price-check/trade/pathofexile-trade'

vi.mock('@/web/Config', () => ({ AppConfig: () => ({}) }))
vi.mock('@/web/background/IPC', () => ({ Host: {} }))
beforeAll(async () => { await init('ko') })

const options = { league: 'Covens', merchantOnly: false, currency: null, collapseListings: 'app' as const, activateStockFilter: false, useEn: true, searchStatRange: 0 }

it('parses an unidentified Fated rare with an unidentified tier', () => {
  const result = parseClipboard([
    '아이템 종류: 반지',
    '아이템 희귀도: 희귀',
    '예견된 다면의 반지',
    '--------',
    '아이템 레벨: 85',
    '--------',
    '{ 고정 속성 부여 }',
    '접두어 속성 부여의 최대 개수 +1개',
    '접미어 속성 부여의 최대 개수 -2개',
    '고정 속성 변경 불가 — 변경이 불가능한 값',
    '접두어 속성 규모 50% 증가 — 변경이 불가능한 값',
    '--------',
    '미확인 (5등급)',
    ''
  ].join('\n'))
  if (result.isErr()) throw new Error(result.error)
  const item = result.value
  expect(item.info.refName).toBe('Manifold Ring')
  expect(item.isFated).toBe(true)
  expect(item.isUnidentified).toBe(true)
  expect(item.unidentifiedTier).toBe(5)
  expect(item.unknownModifiers).toEqual([])

  const presets = createPresets(item, options)
  const preset = presets.presets.find(preset => preset.id === presets.active)!
  const query = createTradeRequest(preset.filters, preset.stats).query
  expect(query.type).toBe('Manifold Ring')
  expect(query.filters.misc_filters?.filters.unidentified_tier).toEqual({ min: 5 })
  expect(query.filters.misc_filters?.filters.fated).toEqual({ option: 'true' })
  expect(query.stats[0].filters.map(filter => filter.id)).toEqual([
    'implicit.stat_3182714256', 'implicit.stat_718638445', 'implicit.stat_532463031', 'implicit.stat_1794120699'
  ])
})

it('keeps the unique named "예견된 최후" (Fated End)', () => {
  const result = parseClipboard([
    '아이템 종류: 반지',
    '아이템 희귀도: 고유',
    '예견된 최후',
    '파우아 반지',
    '--------',
    '아이템 레벨: 80',
    ''
  ].join('\n'))
  if (result.isErr()) throw new Error(result.error)
  expect(result.value.info.refName).toBe('Fated End')
  expect(result.value.isFated).toBeUndefined()
})
