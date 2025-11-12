import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react', 'date-fns'],
          'vendor-scanner': ['html5-qrcode'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable']
        }
      }
    },
    chunkSizeWarningLimit: 500, // Warn if chunk > 500KB
    sourcemap: false // Disable source maps in production for size
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000', // For local dev: proxy to backend Docker container (127.0.0.1 for Windows Docker)
        changeOrigin: true,
      },
    },
  },
});
