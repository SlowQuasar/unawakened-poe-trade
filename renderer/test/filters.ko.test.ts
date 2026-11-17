import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { init } from '@/assets/data'
import { parseClipboard, ItemCategory } from '@/parser'
import { initUiModFilters } from '@/web/price-check/filters/create-stat-filters'

function sample (file: string) {
  const r = parseClipboard(readFileSync(new URL(`./fixtures/ko/${file}`, import.meta.url), 'utf8'))
  if (r.isErr()) throw new Error(r.error)
  return r.value
}

describe('Korean stat filters', () => {
  beforeAll(async () => { await init('ko') })

  it('Viscera keep the exact resistance stat instead of a pseudo total', () => {
    const item = sample('3.30-viscera-body-elemental-essence.txt')
    expect(item.category).toBe(ItemCategory.Viscera)
    expect(item.visceraSlot).toBe('body')
    const filters = initUiModFilters(item, { searchStatRange: 10 })
      .flatMap(f => ('filters' in f) ? f.filters : [f])
    const refs = filters.map(f => f.statRef)
    expect(refs).toContain('+#% to Cold Resistance')
    expect(refs.some(ref => ref.includes('total'))).toBe(false)
  })

  it('rare equipment still uses the pseudo total resistance', () => {
    const item = sample('rare-amulet-anointed-crafted.txt')
    const refs = initUiModFilters(item, { searchStatRange: 10 })
      .flatMap(f => ('filters' in f) ? f.filters : [f])
      .map(f => f.statRef)
    expect(refs.some(ref => ref.includes('total'))).toBe(true)
  })
})
