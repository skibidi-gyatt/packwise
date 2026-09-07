import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: path('./'),
  base: './',
  publicDir: path('../public'),
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': path('../'), 'next/image': path('./Image.tsx') } },
  build: { outDir: path('../mobile-dist'), emptyOutDir: true },
  server: { host: '127.0.0.1', port: 3001, strictPort: true },
});
