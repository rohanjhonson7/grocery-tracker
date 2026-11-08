import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the app from /grocery-tracker/; locally it runs at /.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  server: { port: 5173, host: true },
});
