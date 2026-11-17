import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config.mts'

export default defineConfig({
  resolve: viteConfig.resolve,
  test: {
    // Vitest exposes import.meta.env through its worker environment.
    env: { BASE_URL: new URL('./public/', import.meta.url).href },
    environment: 'node',
    include: ['test/*.test.ts'],
    globalSetup: [fileURLToPath(new URL('./test/global-setup.mts', import.meta.url))],
    setupFiles: ['./test/setup.ts'],
    isolate: true
  }
})
