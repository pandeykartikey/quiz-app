import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: 'public',
    emptyOutDir: false, // Don't empty the directory since we have static assets
    rollupOptions: {
      input: {
        main: 'src/main.js'
      }
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  }
}) 