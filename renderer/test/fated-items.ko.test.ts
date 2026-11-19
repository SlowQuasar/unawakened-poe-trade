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
  expect(query.filters.misc_filters?.filters.unidentified_tier).toBeUndefined()
  expect(query.filters.misc_filters?.filters.identified).toEqual({ option: 'false' })
  preset.filters.unidentifiedTier!.disabled = false
  expect(createTradeRequest(preset.filters, preset.stats).query.filters.misc_filters?.filters.unidentified_tier).toEqual({ min: 5 })
  expect(query.filters.misc_filters?.filters.fated).toBeUndefined()
  preset.filters.fated!.disabled = false
  expect(createTradeRequest(preset.filters, preset.stats).query.filters.misc_filters?.filters.fated).toEqual({ option: 'true' })
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

it('reads the tier of unidentified magic and Fated rare drops', () => {
  const cases: Array<[string, string, boolean | undefined, number]> = [
    ['아이템 종류: 양손 검\n아이템 희귀도: 마법\n정교한 검\n--------\n양손 검\n물리 피해: 67-112\n치명타 확률: 5.70%\n초당 공격 횟수: 1.35\n무기 범위: 1.3미터\n--------\n요구사항:\n힘: 119\n민첩: 131 (unmet)\n--------\n홈: W-G-W-W \n--------\n아이템 레벨: 85\n--------\n{ 고정 속성 부여 — 피해, 치명타 }\n일반 치명타 피해 배율 +50%\n--------\n미확인 (4등급)\n', 'Exquisite Blade', undefined, 4],
    ['아이템 종류: 장갑\n아이템 희귀도: 희귀\n예견된 은신 장갑\n--------\n회피: 245\n--------\n요구사항:\n민첩: 97\n--------\n홈: W-W-W-W \n--------\n아이템 레벨: 85\n--------\n미확인 (4등급)\n', 'Stealth Gloves', true, 4],
    ['아이템 종류: 투구\n아이템 희귀도: 희귀\n예견된 압도적인 가죽모\n--------\n회피: 644\n--------\n요구사항:\n민첩: 224 (unmet)\n--------\n홈: W-W W \n--------\n아이템 레벨: 85\n--------\n미확인 (2등급)\n', 'Majestic Pelt', true, 2],
    ['아이템 종류: 반지\n아이템 희귀도: 희귀\n예견된 쌍보석 반지\n--------\n아이템 레벨: 85\n--------\n{ 고정 속성 부여 — 원소, 화염, 번개, 저항 }\n화염 및 번개 저항 +14(12-16)%\n--------\n미확인 (2등급)\n', 'Two-Stone Ring', true, 2]
  ]
  for (const [text, refName, fated, tier] of cases) {
    const result = parseClipboard(text)
    if (result.isErr()) throw new Error(result.error)
    expect(result.value.info.refName).toBe(refName)
    expect(result.value.isFated).toBe(fated)
    expect(result.value.unidentifiedTier).toBe(tier)
    expect(result.value.unknownModifiers).toEqual([])
    const presets = createPresets(result.value, options)
    const preset = presets.presets.find(preset => preset.id === presets.active)!
    const misc = createTradeRequest(preset.filters, preset.stats).query.filters.misc_filters?.filters
    expect(misc?.identified).toEqual({ option: 'false' })
    expect(misc?.unidentified_tier).toBeUndefined()
    expect(preset.filters.unidentifiedTier).toEqual({ value: tier, disabled: true })
  }
})
