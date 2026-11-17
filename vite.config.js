import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(process.env.BUILD_NUMBER || 'local')
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 3000, target: 'es2019' }
});
