/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { crx } from '@crxjs/vite-plugin';
import { visualizer } from 'rollup-plugin-visualizer';
import { resolve } from 'path';
import type { PluginOption } from 'vite';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }) as PluginOption,
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/**/*', 'node_modules/**/*'],
    setupFiles: ['./src/test/setup.ts'],
    typecheck: {
      enabled: false,
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
    preprocessorOptions: {
      scss: {
        api: 'modern',
      },
      sass: {
        api: 'modern',
      },
    },
  },
  optimizeDeps: {
    include: ['jszip', 'react', 'react-dom'],
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/loader.ts'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});
