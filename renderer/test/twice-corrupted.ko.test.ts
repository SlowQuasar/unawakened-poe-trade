import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { parseClipboard } from '@/parser/Parser'
import { createFilters } from '@/web/price-check/filters/create-item-filters'
import { createTradeRequest } from '@/web/price-check/trade/pathofexile-trade'
vi.mock('@/web/Config', () => ({ AppConfig: () => ({}) }))
vi.mock('@/web/background/IPC', () => ({ Host: {} }))
import { init } from '@/assets/data'

// Real game text of a Covens listing (trade site "extended.text"), seller note removed.
// Non-advanced format; the last section reads "두 번 타락" instead of "타락".
const opts = { league: 'Covens', merchantOnly: false, currency: null, collapseListings: 'app' as const, activateStockFilter: false, exact: true, useEn: false }

describe('Twice Corrupted (3.30)', () => {
  beforeAll(async () => { await init('ko') })

  it('parses the "두 번 타락" section and searches with twice_corrupted', () => {
    const r = parseClipboard(readFileSync(new URL('./fixtures/ko/3.30-rare-map-twice-corrupted.txt', import.meta.url), 'utf8'))
    expect(r.isOk()).toBe(true)
    const item = r._unsafeUnwrap()
    expect(item.isCorrupted).toBe(true)
    expect(item.isTwiceCorrupted).toBe(true)
    const filters = createFilters(item, opts)
    expect(filters.corrupted).toMatchObject({ value: true, twice: true })
    const req = createTradeRequest(filters, [])
    expect(req.query.filters.misc_filters?.filters.twice_corrupted).toEqual({ option: 'true' })
  })

  it('a normally corrupted item does not send twice_corrupted', () => {
    const r = parseClipboard(readFileSync(new URL('./fixtures/ko/3.30-rare-twohand-mace-unidentified-corrupted.txt', import.meta.url), 'utf8'))
    const item = r._unsafeUnwrap()
    expect(item.isCorrupted).toBe(true)
    expect(item.isTwiceCorrupted).toBeFalsy()
    expect(createTradeRequest(createFilters(item, opts), []).query.filters.misc_filters?.filters.twice_corrupted).toBeUndefined()
  })
})
