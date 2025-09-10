import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 站点部署在 https://www.yunivera.com/ 根路径，使用 '/' 即可
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
