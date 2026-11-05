import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dirname=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig(({command})=>({
  base:command==='serve'?'/':'/Gnozian-Remastered/',
  plugins:[react(),tailwindcss()],
  resolve:{alias:{'@':path.resolve(dirname,'src')}},
  build:{target:'es2022',assetsInlineLimit:4096,chunkSizeWarningLimit:1600},
}));
