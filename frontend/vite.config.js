import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 与 ExcelJS 搭配的最小配置：
// 1) 预优化依赖里包含 exceljs（避免首次导入时的解析开销/偶发报错）
// 2) define 里关掉 NODE_DEBUG，防止少量依赖读取 process.env 报错
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_DEBUG': false
  },
  optimizeDeps: {
    include: ['exceljs']
  }
})
