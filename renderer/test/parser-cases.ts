import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseClipboard } from '@/parser/Parser'
import { ItemRarity } from '@/parser/ParsedItem'
import { ItemCategory } from '@/parser/meta'
import { ModifierType } from '@/parser/modifiers'

// Fixed expectations from samples + static data comparison (localization §8).
// Never derive expected refs from the parser or the runtime lookup tables.
export const cloak = {
  rarity: ItemRarity.Unique,
  category: ItemCategory.BodyArmour,
  refName: 'Cloak of Flame',
  namespace: 'UNIQUE',
  base: "Scholar's Robe",
  mods: [
    { type: ModifierType.Explicit, refs: ['+#% to Fire Resistance'] },
    { type: ModifierType.Explicit, refs: ['#% increased Ignite Duration on Enemies'] },
    { type: ModifierType.Explicit, refs: ['#% of Physical Damage taken as Fire Damage'] },
    { type: ModifierType.Explicit, refs: ['Reflects # Fire Damage to Melee Attackers'] }
  ]
}

export const amulet = {
  rarity: ItemRarity.Rare,
  category: ItemCategory.Amulet,
  refName: 'Turquoise Amulet',
  namespace: 'ITEM',
  mods: [
    { type: ModifierType.Enchant, refs: ['Allocates Disciple of the Unyielding'] },
    { type: ModifierType.Implicit, refs: ['+# to Dexterity and Intelligence'] },
    { type: ModifierType.Explicit, refs: ['+# to maximum Life'] },
    { type: ModifierType.Explicit, refs: ['Adds # to # Lightning Damage to Attacks'] },
    { type: ModifierType.Explicit, refs: ['+#% to Damage over Time Multiplier'] },
    { type: ModifierType.Explicit, refs: ['#% increased Global Critical Strike Chance'] },
    { type: ModifierType.Crafted, refs: ['+#% to Fire and Chaos Resistances'] }
  ]
}

export const nebulis = {
  rarity: ItemRarity.Unique,
  category: ItemCategory.Sceptre,
  refName: 'Nebulis',
  namespace: 'UNIQUE',
  base: 'Void Sceptre',
  mods: [
    { type: ModifierType.Implicit, refs: ['#% increased maximum Energy Shield'] },
    { type: ModifierType.Implicit, refs: ['Gain # Life per Enemy Killed'] },
    { type: ModifierType.Implicit, refs: ['#% of Physical Attack Damage Leeched as Life'] },
    { type: ModifierType.Explicit, refs: ['#% increased Implicit Modifier magnitudes'] },
    { type: ModifierType.Explicit, refs: ['#% increased Cast Speed'] },
    { type: ModifierType.Explicit, refs: ['#% increased Elemental Damage per 1% Fire, Cold, or Lightning Resistance above 75%'] }
  ]
}

interface ExpectedItem {
  rarity: ItemRarity
  category: ItemCategory
  refName: string
  namespace: string
  base?: string
  mods: Array<{ type: ModifierType, refs: string[] }>
}

export function fixtureTests (lang: 'ko' | 'en', file: string, expected: ExpectedItem) {
  const original = readFileSync(new URL(`./fixtures/${lang}/${file}`, import.meta.url), 'utf8')
  const label = file.startsWith('synthetic-') ? '[synthetic] ' : ''
  for (const newline of ['LF', 'CRLF'] as const) {
    it(`${label}${file} (${newline})`, () => {
      // Preserve every other character, including trailing spaces in real samples.
      const text = original.replace(/\r?\n/g, newline === 'LF' ? '\n' : '\r\n')
      const result = parseClipboard(text)
      expect(result.isOk(), result.isErr() ? result.error : undefined).toBe(true)
      if (result.isErr()) throw new Error(result.error)
      const item = result.value
      expect(item.rarity).toBe(expected.rarity)
      expect(item.category).toBe(expected.category)
      expect(item.info.refName).toBe(expected.refName)
      expect(item.info.namespace).toBe(expected.namespace)
      if (expected.base) expect(item.uniqueBase?.refName).toBe(expected.base)
      expect(item.newMods.map(mod => ({
        type: mod.info.type,
        refs: mod.stats.map(stat => stat.stat.ref)
      }))).toEqual(expected.mods)
      expect(item.unknownModifiers).toEqual([])
    })
  }
}
