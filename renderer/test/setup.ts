import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { afterAll, vi } from 'vitest'

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))

vi.stubGlobal('fetch', async (input: string) => {
  const file = fileURLToPath(input)
  const relative = path.relative(publicDir, file)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Test fetch outside public directory: ${input}`)
  }
  const data = await readFile(file)
  return new Response(data)
})

afterAll(() => { vi.unstubAllGlobals() })
