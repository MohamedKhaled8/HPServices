import { createRequire } from 'module'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const require = createRequire(import.meta.url)

function telemetryDevMiddlewarePlugin(): Plugin {
  const attach = (middlewares: { use: (fn: unknown) => void }) => {
    const enginePath = require.resolve('./backend_service/telemetryEngine.js')
    delete require.cache[enginePath]
    const { createViteTelemetryMiddleware } = require(enginePath) as {
      createViteTelemetryMiddleware: () => unknown
    }
    middlewares.use(createViteTelemetryMiddleware())
  }

  return {
    name: 'hp-telemetry-local-api',
    configureServer(server) {
      attach(server.middlewares)
    },
    configurePreviewServer(server) {
      attach(server.middlewares)
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [
    telemetryDevMiddlewarePlugin(),
    react(),
    nodePolyfills({
      include: ['buffer', 'stream', 'util', 'crypto', 'path', 'fs'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].[hash].js`,
        chunkFileNames: `assets/[name].[hash].js`,
        assetFileNames: `assets/[name].[hash].[ext]`
      }
    }
  },
  server: {
    port: 5173,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        bypass(req) {
          if (req.url?.startsWith('/api/telemetry')) {
            return req.url
          }
          return undefined
        },
      }
    }
  }
})
