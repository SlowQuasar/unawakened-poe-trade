import { beforeAll, describe } from 'vitest'
import { init } from '@/assets/data'
import { amulet, cloak, fixtureTests, nebulis } from './parser-cases'

describe('Korean real clipboard samples', () => {
  beforeAll(async () => { await init('ko') })

  fixtureTests('ko', 'unique-body-cloak-of-flame.txt', cloak)
  fixtureTests('ko', 'rare-amulet-anointed-crafted.txt', amulet)
  fixtureTests('ko', 'unique-synthesised-sceptre-nebulis.txt', nebulis)
})
