import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { itemListingToClipboard, ordinaryClipboard, type ItemListing } from './helpers/listing-to-clipboard'

const listings = (type: string): ItemListing[] => JSON.parse(readFileSync(new URL(`./fixtures/listings-items/${type}.json`, import.meta.url), 'utf8'))

it('preserves the real nameplate, properties, requirements and sockets before item level', () => {
  for (const type of ['rare-armour', 'rare-weapon', 'magic-flask', 'tincture', 'viscera']) {
    for (const item of listings(type)) {
      expect(itemListingToClipboard(item).split(/아이템 레벨:/)[0]).toBe(ordinaryClipboard(item.extended.text).split(/아이템 레벨:/)[0])
    }
  }
})

it('uses crafted domain inside explicitMods and reunites named compound modifiers', () => {
  const armour = listings('rare-armour')[2]
  expect(itemListingToClipboard(armour)).toContain('{ 대가의 제작 접두어 속성 부여 "개량된" }\n공격 시 번개 피해 1~34 추가')
  const flask = listings('magic-flask')[0]
  expect(itemListingToClipboard(flask)).toContain('{ 접두어 속성 부여 "끓어오르는" (등급: 1) }\n회복량 66% 감소\n즉시 회복')
})

it('keeps gem skill descriptions and logbook area sections intact', () => {
  for (const type of ['gem-active', 'gem-support']) for (const item of listings(type)) {
    expect(itemListingToClipboard(item)).toBe(ordinaryClipboard(item.extended.text))
  }
  for (const item of listings('logbook')) for (const area of ordinaryClipboard(item.extended.text).split('\n--------\n').filter(section => section.includes(' (implicit)'))) {
    expect(itemListingToClipboard(item).split('\n--------\n')).toContain(area)
  }
})

it('fails visibly when API modifier text cannot be located in a complete section', () => {
  const item = structuredClone(listings('rare-armour')[0])
  item.explicitMods!.push({ description: '복원할 수 없는 테스트 옵션' })
  expect(() => itemListingToClipboard(item)).toThrow('Modifier section not reconstructed')
})
