import { beforeAll, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { init } from '@/assets/data'
import { parseClipboard, ItemCategory } from '@/parser'
import { ModifierType } from '@/parser/modifiers'
import { tryParseTranslation } from '@/parser/stat-translations'
import { createPresets } from '@/web/price-check/filters/create-presets'
import { createTradeRequest } from '@/web/price-check/trade/pathofexile-trade'

vi.mock('@/web/Config', () => ({ AppConfig: () => ({}) }))
vi.mock('@/web/background/IPC', () => ({ Host: {} }))
beforeAll(async () => { await init('ko') })
it('searches the real corrupted Kaom implicit with the 3.30 effect identity', () => {
  const text = readFileSync(new URL('./fixtures/ko/3.30-unique-corrupted-implicit-kaoms-primacy.txt', import.meta.url), 'utf8')
  const result = parseClipboard(text)
  if (result.isErr()) throw new Error(result.error)
  expect(result.value.unknownModifiers).toEqual([])
  const options = { league: 'Covens', merchantOnly: false, currency: null, collapseListings: 'app' as const, activateStockFilter: false, useEn: true, searchStatRange: 0 }
  const presets = createPresets(result.value, options)
  const preset = presets.presets.find(preset => preset.id === presets.active)!
  // Corrupted implicits are optional in the existing unique-item preset.
  const support = preset.stats.find(filter => !('group' in filter) && filter.tradeId.includes('implicit.effect_3512123051'))!
  support.disabled = false
  const request = createTradeRequest(preset.filters, preset.stats)
  expect(request.query.stats.flatMap(group => group.filters)).toContainEqual(expect.objectContaining({ id: 'implicit.effect_3512123051', disabled: false }))
})
it('retains old Rage wording and handles linked names in ordinary implicit text', () => {
  for (const text of ['장착된 젬에 10레벨 격노 보조 효과 적용', '장착된 젬에 10레벨 격노 보조 보조 효과 적용']) {
    expect(tryParseTranslation({ string: text, unscalable: false }, ModifierType.Implicit, ItemCategory.TwoHandedAxe)?.stat.trade.ids.implicit?.[0]).toBe('implicit.effect_3512123051')
  }
  const text = readFileSync(new URL('./fixtures/ko/3.30-unique-corrupted-implicit-kaoms-primacy.txt', import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n').replace('{ 타락 고정 속성 부여 — 젬 }\n', '').replace('격노 보조 보조 효과 적용 — 변경이 불가능한 값', '\u200B격노 보조 보조 효과 적용 (implicit)')
  const result = parseClipboard(text)
  if (result.isErr()) throw new Error(result.error)
  expect(result.value.statsByType.some(s => s.type === ModifierType.Implicit && s.stat.trade.ids.implicit?.includes('implicit.effect_3512123051'))).toBe(true)
})
