import { beforeAll, expect, it, vi } from 'vitest'
import { init } from '@/assets/data'
import { parseClipboard } from '@/parser'

vi.mock('@/web/Config', () => ({ AppConfig: () => ({}) }))
vi.mock('@/web/background/IPC', () => ({ Host: {} }))
beforeAll(async () => { await init('ko') })

const ITEM = `아이템 종류: 목걸이
아이템 희귀도: 고유
용송곳니의 비상 모조품
오닉스 목걸이
--------
요구사항:
레벨: 56
--------
아이템 레벨: 83
--------
{ 고정 속성 부여 — 능력치 }
모든 능력치 +14(10-16)
("능력치"는 힘, 민첩, 지능입니다)
--------
{ 고유 속성 부여 }
모든 번개 첨탑 덫(...) 젬 레벨 +3
{ 고유 속성 부여 — 원소, 저항 }
모든 원소 저항 +7(5-10)%
{ 고유 속성 부여 }
스킬의 점유 효율 9(5-10)% 증가
{ 고유 속성 부여 }
아이템 및 젬의 능력치 요구사항 8(10-5)% 감소
("능력치"는 힘, 민첩, 지능입니다)
--------
"우리가 이렇게 한 것인가? 왜 이에 대한 기록이 없는 것일까? 뼈아픈 결과가 뒤따를 것이라고 경고를 받았거늘..."
- 사무관 쿼트라
`

it('recognizes the random skill gem level on a Replica Dragonfang\'s Flight', () => {
  const result = parseClipboard(ITEM)
  if (result.isErr()) throw new Error(String(result.error))
  expect(result.value.unknownModifiers).toEqual([])
  const gem = result.value.statsByType.find(s => s.stat.ref === '+# to Level of all Lightning Spire Trap Gems (Random Skill Gem)')
  expect(gem?.stat.trade.ids.explicit).toEqual(['explicit.indexable_skill_168'])
  expect(gem?.sources[0].contributes?.value).toBe(3)
})

// Raise Spectre also exists as a fixed mod with the same plain text; the
// "(...)" in advanced text must pick the random skill gem stat.
it('keeps random skill gem mods apart from fixed mods with the same text', () => {
  const result = parseClipboard(ITEM.replace('모든 번개 첨탑 덫(...) 젬 레벨 +3', '모든 망령 소환(...) 젬 레벨 +2'))
  if (result.isErr()) throw new Error(String(result.error))
  expect(result.value.unknownModifiers).toEqual([])
  expect(result.value.statsByType.map(s => s.stat.ref)).toContain('+# to Level of all Raise Spectre Gems (Random Skill Gem)')
})

it('has no 3.29-style textual ranges left in advanced matchers', async () => {
  const { readFileSync } = await import('node:fs')
  for (const lang of ['en', 'ko']) {
    const text = readFileSync(`public/data/${lang}/stats.ndjson`, 'utf8')
    expect(text.match(/"advanced":"[^"]*\([^()\d#"]+-[^()\d#"]+\)/g) ?? []).toEqual([])
  }
})

// Trade API text and some clipboards drop the "(...)"; the plain text still
// finds the random skill gem stat when no fixed mod shares the wording.
it('falls back to plain text when "(...)" is missing', () => {
  const result = parseClipboard(ITEM.replace('모든 번개 첨탑 덫(...) 젬 레벨 +3', '모든 얼음 덫 젬 레벨 +3'))
  if (result.isErr()) throw new Error(String(result.error))
  expect(result.value.unknownModifiers).toEqual([])
  expect(result.value.statsByType.map(s => s.stat.ref)).toContain('+# to Level of all Ice Trap Gems (Random Skill Gem)')
})
