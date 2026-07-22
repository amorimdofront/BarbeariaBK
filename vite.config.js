
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Toda vez que o React chamar '/api/asaas', o Vite redireciona para o Sandbox
      '/api/asaas': {
        target: 'https://api.asaas.com/v3',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/asaas/, '')
      }
    }
  }
})