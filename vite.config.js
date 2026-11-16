import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 3000, target: 'es2019' }
});
