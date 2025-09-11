import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 根目录构建，静态站点在 Render 上无需设置 base
export default defineConfig({
  plugins: [react()],
})
