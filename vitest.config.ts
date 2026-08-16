import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['ohmyvul/**', 'node_modules/**', 'lib/**'],
  },
})
