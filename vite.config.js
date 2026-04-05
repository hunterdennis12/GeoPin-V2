import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/GeoPin-V2/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: parseInt(process.env.PORT) || 5173,
    strictPort: false,
  },
})
