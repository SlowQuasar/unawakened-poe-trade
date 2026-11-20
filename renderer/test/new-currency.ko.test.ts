import { beforeAll, expect, it, vi } from 'vitest'
import { init } from '@/assets/data'
import { parseClipboard } from '@/parser'
import { tradeTag } from '@/web/price-check/trade/common'

vi.mock('@/web/Config', () => ({ AppConfig: () => ({}) }))
vi.mock('@/web/background/IPC', () => ({ Host: {} }))
beforeAll(async () => { await init('ko') })

// Added mid-league: the Korean client shows them in English, and Kakao trade
// lists them under these exchange tags.
it('recognizes the mid-league Exalted Orbs', () => {
  const cases: Array<[string, string, string]> = [
    ["Originator's Exalted Orb", 'Removes a random Suffix modifier and adds a random\nrare-only modifier to a rare map item', 'originators-exalted-orb'],
    ['Primordial Exalted Orb', 'A collection of unknown exotic Exalted Orbs', 'primordial-exalted-orb']
  ]
  for (const [name, text, tag] of cases) {
    const result = parseClipboard([
      '아이템 종류: 중첩 가능 화폐',
      '아이템 희귀도: 화폐',
      name,
      '--------',
      '중첩 개수: 1/20',
      '--------',
      text,
      ''
    ].join('\n'))
    if (result.isErr()) throw new Error(`${name}: ${result.error}`)
    expect(result.value.info.refName).toBe(name)
    expect(tradeTag(result.value)).toBe(tag)
  }
})
