import { describe, expect, it } from 'vitest'
import { hasPriceHistory } from '@/web/price-check/trends/confidence'

describe('poe.ninja price confidence', () => {
  it('treats an empty graph as no history (low-confidence entry)', () => {
    // real Covens entry: {"name":"Paua Amulet","variant":"83, Elder","chaos":650.6,"graph":[]}
    expect(hasPriceHistory([])).toBe(false)
    expect(hasPriceHistory([null, null, null])).toBe(false)
    expect(hasPriceHistory(undefined)).toBe(false)
  })

  it('accepts entries with at least one tracked point', () => {
    // real Covens entry: {"name":"Paua Amulet","variant":"85, Elder","chaos":2.00,"graph":[null,null,null,0,-29.41,-60.78,-21.57]}
    expect(hasPriceHistory([null, null, null, 0, -29.41, -60.78, -21.57])).toBe(true)
  })
})
