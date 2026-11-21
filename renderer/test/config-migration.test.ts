import { describe, expect, it, vi } from 'vitest'

vi.mock('@/web/background/IPC', () => ({ Host: {} }))
vi.mock('@/web/overlay/widget-registry.js', () => ({ registry: { widgets: [] } }))

import { Config, defaultConfig, upgradeConfig } from '@/web/Config'

function savedConfig (language: string, version = 18, useIntlSite = true, realm = 'pc-garena') {
  return {
    ...defaultConfig(),
    configVersion: version,
    language,
    useIntlSite,
    realm,
    leagueId: 'Standard',
    widgets: [{ wmType: 'price-check' }]
  } as unknown as Config
}

describe('language configuration migration', () => {
  it.each(['ru', 'cmn-Hant', 'zh_TW'])('moves %s to Korean and clears obsolete settings', (language) => {
    const config = upgradeConfig(savedConfig(language))
    expect(config.language).toBe('ko')
    expect(config.configVersion).toBe(20)
    expect(config.useIntlSite).toBe(false)
    expect(config).not.toHaveProperty('realm')
    expect(config).not.toHaveProperty('leagueId')
  })

  it.each(['en', 'ko'])('preserves %s and its international site preference', (language) => {
    const config = upgradeConfig(savedConfig(language))
    expect(config.language).toBe(language)
    expect(config.useIntlSite).toBe(true)
    expect(config.leagueId).toBe('Standard')
    expect(config).not.toHaveProperty('realm')
  })

  it('upgrades version 17 through the previous international site migration', () => {
    const config = upgradeConfig(savedConfig('cmn-Hant', 17, false, 'pc-ggg'))
    expect(config.language).toBe('ko')
    expect(config.useIntlSite).toBe(false)
    expect(config.configVersion).toBe(20)
    expect(config).not.toHaveProperty('realm')
    expect(upgradeConfig(config)).toEqual(config)
  })
})

describe('price check stat range migration', () => {
  const withRange = (searchStatRange?: number) => ({
    ...savedConfig('ko', 19),
    widgets: [{ wmType: 'price-check', searchStatRange }]
  } as unknown as Config)
  const range = (config: Config) => (config.widgets[0] as any).searchStatRange

  it('switches the old +-10% default to exact rolls', () => {
    const config = upgradeConfig(withRange(10))
    expect(range(config)).toBe(0)
    expect(config.configVersion).toBe(20)
  })

  it.each([5, 20, 0])('keeps a custom range of %d', (value) => {
    expect(range(upgradeConfig(withRange(value)))).toBe(value)
  })
})
