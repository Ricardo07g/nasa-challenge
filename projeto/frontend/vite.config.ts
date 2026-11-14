import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Para onde o proxy manda as chamadas /api.
// Local: http://localhost:8000. No docker compose: http://backend:8000.
// Não usa o prefixo VITE_, então NÃO vai para o navegador.
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
