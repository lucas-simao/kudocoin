import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const here = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: [{ find: '@', replacement: path.resolve(here, 'src') }],
  },
  plugins: [react(), tailwindcss()],
  server: {
    // brand/theme.css lives above web/.
    fs: { allow: ['..'] },
    port: Number(process.env.KUDOCOIN_WEB_PORT || 18610),
    strictPort: true,
  },
  test: {
    environment: 'node',
  },
})
