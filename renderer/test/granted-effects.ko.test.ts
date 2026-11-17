import { beforeAll, expect, it, vi } from 'vitest'
import { init } from '@/assets/data'
import { ModifierType } from '@/parser/modifiers'
import { tryParseTranslation } from '@/parser/stat-translations'

vi.mock('@/web/Config', () => ({ AppConfig: () => ({}) }))
vi.mock('@/web/background/IPC', () => ({ Host: {} }))
beforeAll(async () => { await init('ko') })

const parse = (text: string, type: ModifierType) => tryParseTranslation({ string: text, unscalable: false }, type, undefined)

it('recognizes 3.30 skill grants moved onto effect trade IDs', () => {
  const cases: Array<[string, ModifierType, string]> = [
    ['20레벨 고난 부여', ModifierType.Explicit, 'explicit.effect_459241192'],
    ['22레벨 솔라리스의 위상 부여', ModifierType.Explicit, 'explicit.effect_3654111757'],
    ['15레벨 절망 부여', ModifierType.Implicit, 'implicit.effect_2765861847'],
    ['20레벨 흉포한 로아 소환 부여', ModifierType.Explicit, 'explicit.effect_4195991223'],
    // Harbingers are listed without a level (ClientStrings ModGrantsEffect)
    ['시간의 선구자 소환 부여', ModifierType.Explicit, 'explicit.effect_1315696378'],
    ['상위 비전의 선구자 소환 부여', ModifierType.Explicit, 'explicit.effect_293985888']
  ]
  for (const [text, type, id] of cases) {
    expect(parse(text, type)?.stat.trade.ids[type], text).toContain(id)
  }
})

it('takes trade IDs from fixed wording when trade lists only that form', () => {
  const bitterblood = parse('소모한 생명력과 동일한 쓰라린 피 획득', ModifierType.Explicit)
  expect(bitterblood?.stat.trade.ids.explicit).toContain('explicit.stat_3945412713')
  expect(bitterblood?.roll?.value).toBe(100)
  const arc = parse('연쇄 번개가 1회 추가 연쇄', ModifierType.Enchant)
  expect(arc?.stat.trade.ids.enchant).toContain('enchant.stat_2461552986')
  expect(arc?.roll?.value).toBe(1)
})
