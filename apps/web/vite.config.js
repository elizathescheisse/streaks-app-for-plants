import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
    // Forward /api/* to a `vercel dev` instance running the serverless
    // functions (see api/chat.js). Lets us keep Vite's own dev server —
    // fast, reliable, the one we already use — for everything else,
    // instead of relying on `vercel dev` to correctly run this monorepo's
    // frontend itself.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
