import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// root is set explicitly so the dev server works whether launched
// from this directory or from a parent (e.g. via launch.json).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: path.resolve(__dirname),
})
