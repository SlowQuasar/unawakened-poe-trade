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
    expect(config.configVersion).toBe(19)
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
    expect(config.configVersion).toBe(19)
    expect(config).not.toHaveProperty('realm')
    expect(upgradeConfig(config)).toEqual(config)
  })
})
