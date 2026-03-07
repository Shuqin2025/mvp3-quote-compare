import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        demo: 'internal-demo.html'
      }
    }
  }
})
