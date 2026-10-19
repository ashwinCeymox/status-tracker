import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const omnirouteUrl = env.OMNIROUTE_URL || 'http://127.0.0.1:20128'
  const apiKey = env.OMNIROUTE_API_KEY || ''

  return {
    base: './',
    plugins: [react()],
    build: {
      outDir: '../plugin/token-moniter-planner/viewer',
      emptyOutDir: true,
    },
    server: {
      proxy: {
        '/api/omniroute': {
          target: omnirouteUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/omniroute/, ''),
          headers: apiKey
            ? {
                Authorization: `Bearer ${apiKey}`,
              }
            : {},
        },
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  }
})
