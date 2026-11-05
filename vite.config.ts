import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'serve' ? '/' : '/Gnozian-Remastered/',
  build: { target: 'es2022', assetsInlineLimit: 4096 },
}));
