import { defineConfig } from 'vitest/config'

// The emulator answers the first requests slowly while it warms up.
export default defineConfig({ test: { testTimeout: 20_000, hookTimeout: 30_000, fileParallelism: false } })
