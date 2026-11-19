import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_ID__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z'),
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://mock-api:8001',
        changeOrigin: true,
      },
    },
  },
})
