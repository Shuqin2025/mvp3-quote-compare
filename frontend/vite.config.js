// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',                // 线上域名根路径发布，一定写 '/'
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
  publicDir: 'public',      // 保证 public/ 下的 ui-enhance.* 会被原样拷贝到 dist 根
})
