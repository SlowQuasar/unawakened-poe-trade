import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { parseClipboard } from '@/parser/Parser'
import { createPresets } from '@/web/price-check/filters/create-presets'
vi.mock('@/web/Config', () => ({ AppConfig: () => ({}) }))
vi.mock('@/web/background/IPC', () => ({ Host: {} }))
import { init } from '@/assets/data'

describe('rare blighted map (user report)', () => {
  beforeAll(async () => { await init('ko') })

  it('lists its map mods in the pseudo preset, unchecked by default', () => {
    const item = parseClipboard(readFileSync(new URL('./fixtures/ko/3.30-rare-blighted-map.txt', import.meta.url), 'utf8'))._unsafeUnwrap()
    expect(item.info.area?.blighted).toBe(true)
    expect(item.unknownModifiers).toEqual([])
    const p = createPresets(item, { league: 'Covens', merchantOnly: false, currency: null, collapseListings: 'app', activateStockFilter: false, searchStatRange: 10, useEn: false } as any)
    expect(p.active).toBe('filters.preset_pseudo')
    const stats = p.presets.find(x => x.id === p.active)!.stats.flatMap((s: any) => 'filters' in s ? s.filters : [s])
    const mods = stats.filter((s: any) => s.tradeId.some((id: string) => id.startsWith('explicit.')))
    expect(mods.map((s: any) => s.statRef)).toContain('Monsters have #% increased Area of Effect')
    expect(mods.every((s: any) => s.disabled)).toBe(true)
  })
})
