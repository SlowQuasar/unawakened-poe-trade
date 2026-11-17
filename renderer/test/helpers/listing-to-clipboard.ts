/** Test-only subset of the fetch API. Never pass account/listing metadata here. */
export interface ListingMod {
  description: string
  domain?: string
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
