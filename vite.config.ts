import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// root is set explicitly so the dev server works whether launched
// from this directory or from a parent (e.g. via launch.json).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: path.resolve(__dirname),
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        preview: path.resolve(__dirname, 'preview.html'),
      },
      output: {
        // Split stable vendor deps into their own chunks so browser
        // cache survives app-code deploys. React and Supabase both
        // update rarely; TaskPanelsApp changes nearly every push.
        // Vite 8 / Rolldown wants a function, not an object map.
        manualChunks(id: string) {
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/@supabase/')) {
            return 'supabase-vendor';
          }
          return undefined;
        },
      },
    },
  },
})
