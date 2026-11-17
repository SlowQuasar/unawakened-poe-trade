import { beforeAll, expect, it } from 'vitest'
import { init } from '@/assets/data'
import { ItemCategory } from '@/parser'
import { ModifierType } from '@/parser/modifiers'
import { tryParseTranslation } from '@/parser/stat-translations'

beforeAll(async () => { await init('en') })

it('matches all four English Citadels with textual ranges and stable trade options', () => {
  for (const [name, option] of [['Baran', 1], ['Veritania', 2], ['Al-Hezmin', 3], ['Drox', 4]] as const) {
    const parsed = tryParseTranslation({ string: `Map contains ${name}'s Citadel(...)`, unscalable: true }, ModifierType.Implicit, ItemCategory.Map)
    expect(parsed?.stat.trade.ids.implicit).toEqual([`implicit.stat_2563183002|${option}`])
  }
})
