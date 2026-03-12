import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',       // Required for BigInt literals (5000n etc.)
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  esbuild: {
    target: 'es2020',       // Match esbuild transform target
  },
  server: {
    port: 5173,
    open: true,
  },
})
