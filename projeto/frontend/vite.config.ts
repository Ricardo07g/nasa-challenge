import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

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
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Os testes usam as fixtures de repositories/mocks (sem rede): a API real é o padrão fora daqui.
    // A lavoura de demonstração já marcada em "Onde fica a lavoura" fica fixa (o padrão do app), sem
    // depender da variável da máquina; os testes do controller ligam e desligam pelas dependências.
    env: { VITE_API_MODE: 'mock', VITE_ABRIR_COM_DEMONSTRACAO: 'true' },
  },
})
