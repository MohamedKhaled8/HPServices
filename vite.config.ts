import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // تفعيل polyfills لمكتبات Node.js التي تُستخدم في المتصفح
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].[hash].js`,
        chunkFileNames: `assets/[name].[hash].js`,
        assetFileNames: `assets/[name].[hash].[ext]`,
        // تقسيم الكود لتحسين الأداء
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          react: ['react', 'react-dom', 'react-router-dom'],
        }
      },
      // تجاهل المكتبات التي لا تعمل في المتصفح
      external: []
    }
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  // تعريف متغيرات البيئة الأساسية كـ fallback لو لم تكن موجودة - تم إيقافها لأنها تسبب مشاكل في production مع polyfills
  // define: {
  //   'process.env': {}
  // }
})
