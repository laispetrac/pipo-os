import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      routesDirectory: 'src/routes',
      generatedRouteTree: 'src/routeTree.gen.ts',
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // The two fixtures are 6 and 7 MB: `JSON.parse` of a string beats a 7 MB
  // object literal, in the browser and under vitest alike.
  json: { stringify: true },
  // WEB_APP_ além do VITE_ padrão: variáveis do observability (ex.: WEB_APP_SENTRY_DSN)
  // não usam o prefixo VITE_.
  envPrefix: ['VITE_', 'WEB_APP_'],
  test: {
    environment: 'jsdom',
    globals: true,
    // The detail route loads on demand: under parallel workers the default 5s
    // ceiling is what the integration suites hit, not the wait they configure.
    testTimeout: 15_000,
    hookTimeout: 15_000,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    env: {
      // Absolute base URL: relative Requests work in browsers but not in
      // undici/jsdom, where they throw at construction time.
      VITE_API_URL: 'http://localhost:3000',
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
