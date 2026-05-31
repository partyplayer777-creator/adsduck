import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import process from 'node:process'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // base는 환경변수로 오버라이드 가능 (GitHub Pages: VITE_BASE_PATH=/adsduck/)
  base: process.env.VITE_BASE_PATH ?? '/',
})
