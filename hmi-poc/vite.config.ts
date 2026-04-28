import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import checker from 'vite-plugin-checker'

export default defineConfig({
  plugins: [
    react(),
    checker({ typescript: true }),
  ],
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('three') || id.includes('@react-three')) return 'three';
        },
      },
    },
  },
})
