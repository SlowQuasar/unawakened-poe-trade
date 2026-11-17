import { beforeAll, describe } from 'vitest'
import { init } from '@/assets/data'
import { amulet, cloak, fixtureTests } from './parser-cases'

describe('English [synthetic] clipboard samples', () => {
  beforeAll(async () => { await init('en') })

  fixtureTests('en', 'synthetic-unique-body-cloak-of-flame.txt', cloak)
  fixtureTests('en', 'synthetic-rare-amulet-anointed-crafted.txt', amulet)
})
