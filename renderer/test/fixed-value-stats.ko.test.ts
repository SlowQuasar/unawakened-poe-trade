import { beforeAll, expect, it, vi } from 'vitest'
import { init } from '@/assets/data'
import { parseClipboard } from '@/parser'
import { translateStatWithRoll } from '@/parser/modifiers'

vi.mock('@/web/Config', () => ({ AppConfig: () => ({}) }))
vi.mock('@/web/background/IPC', () => ({ Host: {} }))
beforeAll(async () => { await init('ko') })

const TARYNS_SHIVER = `아이템 종류: 전쟁지팡이
아이템 희귀도: 고유
타린의 오한
마엘스트롬 지팡이
--------
전쟁지팡이
물리 피해: 71-147
치명타 확률: 8.10%
초당 공격 횟수: 1.31 (augmented)
무기 범위: 1.3미터
--------
요구사항:
레벨: 64
힘: 113
지능: 113
--------
홈: W-W-W-W
--------
아이템 레벨: 83
--------
{ 타락 고정 속성 부여 — 공격, 속도 }
공격 속도 5(5-7)% 증가
--------
{ 고유 속성 부여 — 시전, 속도 }
시전 속도 18(10-20)% 증가
{ 고유 속성 부여 — 피해, 원소, 냉기 }
냉기 피해 87(80-140)% 증가
{ 고유 속성 부여 — 원소, 냉기, 시전, 젬 }
모든 냉기 주문 스킬 젬 레벨 +2(2-4)
{ 고유 속성 부여 — 원소, 냉기, 상태 이상 }
32(25-50)%의 확률로 동결 유발
("동결"은 적의 동작 속도를 0으로 만들어 동작 자체를 방지합니다. 지속시간은 동결 적용 시의 냉기 피해량에 의해 결정됩니다)
{ 고유 속성 부여 — 피해 }
동결된 적이 받는 피해 20% 증가 — 변경이 불가능한 값
{ 고유 속성 부여 — 원소, 냉기, 상태 이상 }
원통한 서리 — 변경이 불가능한 값
--------
밤의 날개 달린 짐승이 벗어낸
비늘 위에 서리가 덮인 가시.
겨울빛을 느끼는 자 모두
얼어붙은 새벽의 고통에 몸서리를 친다.
--------
타락
`

function parse () {
  const result = parseClipboard(TARYNS_SHIVER)
  if (result.isErr()) throw new Error(String(result.error))
  return result.value
}

// Korean words the fixed 20% differently from the ranged stat, so the line
// arrives without a roll and the flag-merge group used to give up on it.
it('recognizes the fixed 20% frozen damage on Taryn\'s Shiver', () => {
  const item = parse()
  expect(item.unknownModifiers).toEqual([])
  const frozen = item.statsByType.find(s => s.stat.ref === 'Enemies Frozen by you take #% increased Damage')!
  expect(frozen.sources[0].contributes?.value).toBe(20)
  expect(frozen.stat.trade.ids.explicit.map(id => id.replace(/^\{[^}]+\}/, ''))).toContain('explicit.stat_849085925')
})

it('labels a freeze chance roll with its own wording, not "always freezes"', () => {
  const freeze = parse().statsByType.find(s => s.stat.ref === '#% chance to Freeze')!
  const roll = { value: 32, min: 25, max: 50, dp: false }
  expect(translateStatWithRoll(freeze, roll as any).string).toBe('#%의 확률로 동결 유발')
})
