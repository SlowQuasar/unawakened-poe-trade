/** Test-only subset of the fetch API. Never pass account/listing metadata here. */
export interface ListingMod {
  description: string
  domain?: string
  flags?: { crafted?: boolean, fractured?: boolean, corrupted?: boolean }
  hash?: string
  mods?: Array<{ name?: string, tier?: string, magnitudes?: unknown[] }>
}
export interface MapListing {
  name: string
  typeLine: string
  baseType: string
  frameType: number
  ilvl: number
  identified: boolean
  corrupted?: boolean
  doubleCorrupted?: boolean
  monsterLevel?: number
  properties?: Array<{ name: string, values: Array<[string, number]>, displayMode?: number }>
  implicitMods?: Array<string | ListingMod>
  explicitMods?: Array<string | ListingMod>
  enchantMods?: Array<string | ListingMod>
  influences?: Record<string, boolean>
  descrText?: string
  unmodifiableExceptChaos?: boolean
  extended?: { hashes?: Record<string, Array<[string, number[]]>> }
}

// API markup is a display label, not a clipboard token.
export const displayText = (text: string) => text.replace(/\[([^\]|]+)\|([^\]]+)\]/g, '$2').replace(/\[([^\]]+)\]/g, '$1')

export interface ItemListing {
  frameType?: number
  implicitMods?: Array<string | ListingMod>
  explicitMods?: Array<string | ListingMod>
  craftedMods?: Array<string | ListingMod>
  fracturedMods?: Array<string | ListingMod>
  enchantMods?: Array<string | ListingMod>
  extended: { text: string, hashes?: Record<string, Array<[string, number[]]>> }
}

export function ordinaryClipboard (encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf8').replace(/\r\n/g, '\n').replace(/\n--------\n메모:[\s\S]*$/, '').trimEnd() + '\n'
}

/** Preserve the actual nameplate/properties/requirements/sockets/help sections.
 * Replace only complete modifier sections, never similarly worded gem skills or
 * logbook area modifiers. No roll ranges, tags or implicit origin are guessed.
 */
export function itemListingToClipboard (item: ItemListing): string {
  const original = ordinaryClipboard(item.extended.text)
  if (original.includes('아이템 희귀도: 젬\n')) return original
  const text = (mod: string | ListingMod) => displayText(typeof mod === 'string' ? mod : mod.description).replace(/\u200B/g, '')
  const clean = (line: string) => displayText(line).replace(/\u200B/g, '').replace(/ \((?:implicit|enchant|crafted|fractured)\)$/, '').trimEnd()
  const pools = (['enchant', 'implicit', 'explicit', 'fractured', 'crafted'] as const).flatMap(kind =>
    (item[`${kind}Mods`] ?? []).map(mod => ({
      kind: typeof mod !== 'string' && (mod.flags?.crafted || mod.domain === 'crafted') ? 'crafted' as const
        : typeof mod !== 'string' && (mod.flags?.fractured || mod.domain === 'fractured') ? 'fractured' as const : kind,
      mod,
      lines: text(mod).split('\n')
    })))
  const used = new Set<typeof pools[number]>()
  const sections = original.trimEnd().split('\n--------\n').map(section => {
    const lines = section.split('\n')
    const selected: typeof pools = []
    for (let i = 0; i < lines.length;) {
      const found = pools.find(entry => !used.has(entry) && !selected.includes(entry) && entry.lines.every((line, offset) => clean(lines[i + offset] ?? '') === clean(line)))
      if (!found) return section
      selected.push(found)
      i += found.lines.length
    }
    selected.forEach(entry => used.add(entry))
    const groups = new Map<string, { header: string, lines: string[] }>()
    for (const [index, entry] of selected.entries()) {
      const { kind, mod } = entry
      if (kind === 'enchant') {
        groups.set(`enchant:${index}`, { header: '', lines: entry.lines.map(line => `${line} (enchant)`) })
        continue
      }
      const meta = typeof mod === 'string' ? undefined : mod.mods?.[0]
      const generation = meta?.tier?.startsWith('S') ? '접미어' : meta?.tier?.startsWith('P') ? '접두어' : undefined
      // Crafted/fractured generation cannot be recovered without P/S metadata.
      if ((kind === 'crafted' || kind === 'fractured') && !generation) throw new Error(`Missing ${kind} generation: ${text(mod)}`)
      const type = kind === 'implicit' ? (typeof mod !== 'string' && mod.flags?.corrupted ? '타락 고정 속성 부여' : '고정 속성 부여')
        : kind === 'crafted' ? `대가의 제작 ${generation} 속성 부여`
          : kind === 'fractured' ? `분열된 ${generation} 속성 부여`
            : item.frameType === 3 ? '고유 속성 부여' : generation ? `${generation} 속성 부여` : '속성 부여'
      const name = kind !== 'implicit' && meta?.name ? ` "${meta.name}"` : ''
      const tier = meta?.tier?.match(/^[PS][1-9]\d*$/) ? ` (등급: ${meta.tier.slice(1)})` : ''
      const key = meta?.name ? `${kind}|${meta.name}|${meta.tier ?? ''}` : `${kind}:${index}`
      const group = groups.get(key) ?? { header: `{ ${type}${name}${tier} }`, lines: [] }
      group.lines.push(...entry.lines)
      groups.set(key, group)
    }
    return [...groups.values()].map(group => [group.header, ...group.lines].filter(Boolean).join('\n')).join('\n')
  })
  for (const entry of pools) if (!used.has(entry)) throw new Error(`Modifier section not reconstructed: ${entry.kind}: ${text(entry.mod)}`)
  return sections.join('\n--------\n') + '\n'
}

/**
 * Approximation of Korean advanced Ctrl+C, based on the three 3.30 map fixtures.
 * API magnitudes are not clipboard roll ranges; do not fabricate ranges/tags.
 * Missing names use the valid generic explicit header. Named multi-line mods
 * are reunited by name+tier. Ordering within that group follows the API.
 * Reminder text, immutable-value annotations and unknown influence labels are
 * not invented. doubleCorrupted intentionally remains ordinary Corrupted here:
 * its real clipboard label and UI support require a separate product decision.
 */
export function listingToClipboard (item: MapListing): string {
  const sections: string[] = []
  const rarity = ['일반', '마법', '희귀', '고유'][item.frameType]
  if (!rarity) throw new Error(`Unsupported map frameType: ${item.frameType}`)
  sections.push(['아이템 종류: 지도', `아이템 희귀도: ${rarity}`, item.name, item.typeLine].filter(Boolean).join('\n'))
  const props = (item.properties ?? []).map(prop => {
    const value = prop.values.map(([text, colour]) => displayText(text) + (colour === 1 ? ' (augmented)' : '')).join(', ')
    return `${displayText(prop.name)}: ${value}`
  })
  if (props.length) sections.push(props.join('\n'))
  sections.push(`아이템 레벨: ${item.ilvl}`)
  if (item.monsterLevel !== undefined) sections.push(`몬스터 레벨: ${item.monsterLevel}`)
  for (const [kind, mods] of [['enchant', item.enchantMods], ['implicit', item.implicitMods], ['explicit', item.explicitMods]] as const) {
    if (!mods?.length) continue
    if (kind === 'enchant') {
      sections.push(mods.map(mod => displayText(typeof mod === 'string' ? mod : mod.description).split('\n').map(line => `${line} (enchant)`).join('\n')).join('\n'))
      continue
    }
    const groups = new Map<string, { header: string, lines: string[] }>()
    for (const mod of mods) {
      const meta = typeof mod === 'string' ? undefined : mod.mods?.[0]
      const key = kind === 'implicit' ? kind : `${meta?.name ?? ''}|${meta?.tier ?? ''}`
      let group = groups.get(key)
      if (!group) {
        const type = kind === 'implicit' ? '고정 속성 부여' : meta?.tier?.startsWith('S') ? '접미어 속성 부여' : '접두어 속성 부여'
        const name = kind === 'explicit' && meta?.name ? ` "${meta.name}"` : ''
        const tier = kind === 'explicit' && meta?.tier?.match(/^[PS]\d+$/) ? ` (등급: ${meta.tier.slice(1)})` : ''
        group = { header: `{ ${type}${name}${tier} }`, lines: [] }
        groups.set(key, group)
      }
      group.lines.push(displayText(typeof mod === 'string' ? mod : mod.description))
    }
    sections.push([...groups.values()].map(group => [group.header, ...group.lines].join('\n')).join('\n'))
  }
  if (item.descrText) sections.push(displayText(item.descrText))
  if (!item.identified) sections.push('미확인')
  if (item.corrupted) sections.push('타락')
  const influences: Record<string, string> = { shaper: '쉐이퍼 아이템', elder: '엘더 아이템', crusader: '십자군 아이템', redeemer: '대속자 아이템', hunter: '사냥꾼 아이템', warlord: '전쟁군주 아이템' }
  for (const [key, enabled] of Object.entries(item.influences ?? {})) {
    if (enabled && influences[key]) sections.push(influences[key])
  }
  if (item.unmodifiableExceptChaos) sections.push('카오스 오브, 바알 오브, 환영의 오브, 끌로만 속성 부여 가능')
  return sections.join('\n--------\n') + '\n'
}
