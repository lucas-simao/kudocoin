import { defineConfig } from 'vitest/config'

// The flow runs in order against one set of emulators: scripts/e2e.sh.
export default defineConfig({ test: { include: ['e2e/**/*.e2e.ts'], testTimeout: 30_000, hookTimeout: 60_000, sequence: { concurrent: false } } })
