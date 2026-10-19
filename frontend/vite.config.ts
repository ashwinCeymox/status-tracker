import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const omnirouteUrl = env.OMNIROUTE_URL || ''
  const apiKey = env.OMNIROUTE_API_KEY || ''

  const proxyConfig: Record<string, any> = {
    '/api': {
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
    },
  }

  if (omnirouteUrl) {
    proxyConfig['/api/omniroute'] = {
      target: omnirouteUrl,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api\/omniroute/, ''),
      headers: apiKey
        ? {
            Authorization: `Bearer ${apiKey}`,
          }
        : {},
    }
  }

  return {
    base: './',
    plugins: [react()],
    build: {
      outDir: '../plugin/token-moniter-planner/viewer',
      emptyOutDir: true,
    },
    server: {
      proxy: proxyConfig,
    },
  }
})
