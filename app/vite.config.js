import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 手机同网段可访问
    fs: { allow: ['..'] }, // 允许引用 app/ 之外的共享素材与模块
  },
})
