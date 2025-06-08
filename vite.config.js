import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
  publicDir: 'client', // Serve assets from client directory
  build: {
    outDir: 'dist/client', // Output build to dist/client
    emptyOutDir: true, // It's generally better to clean the outDir
    rollupOptions: {
      input: {
        main: 'client/index.html',
        host: 'client/host.html',
        display: 'client/display.html',
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