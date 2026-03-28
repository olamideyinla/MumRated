import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(({ mode }) => {
  const isAnalyze = mode === 'analyze'

  return {
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        includeAssets: ['favicon.ico', 'icons/*.svg', 'icons/*.png'],
        manifest: false,
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        },
      }),
      // Bundle analysis: run with `npm run build:analyze`
      visualizer({
        open: isAnalyze,
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
        template: 'treemap',
      }) as Plugin,
    ],

    resolve: {
      alias: { '@': '/src' },
    },

    build: {
      // Target modern browsers — matches our PWA audience
      target: 'es2020',

      // Hidden source maps: generated but URL stripped from bundle (safe for Sentry upload)
      sourcemap: mode === 'production' || mode === 'staging' ? 'hidden' : true,

      // Warn for chunks > 600KB (before gzip)
      chunkSizeWarningLimit: 600,

      rollupOptions: {
        output: {
          // Deterministic asset names with content hashing for long-term caching
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',

          // Split vendor dependencies into stable chunks so users don't re-download
          // unchanged vendor code on every app update
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined

            // React ecosystem — very stable, cache aggressively
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router'))
              return 'vendor-react'

            // Charts — recharts + d3 sub-packages are large, isolate them
            if (id.includes('/recharts/') || id.includes('/d3-') || id.includes('/victory'))
              return 'vendor-charts'

            // Database layer — changes rarely
            if (id.includes('/dexie'))
              return 'vendor-db'

            // Supabase client — auth + realtime, isolate for easy updates
            if (id.includes('/@supabase/'))
              return 'vendor-supabase'

            // TanStack — query + virtual, usually updated together
            if (id.includes('/@tanstack/'))
              return 'vendor-query'

            // PDF/export — heavy, only loaded on report pages
            if (id.includes('/jspdf') || id.includes('/jszip') || id.includes('/papaparse'))
              return 'vendor-export'

            // Form validation — loaded with every form
            if (id.includes('/react-hook-form') || id.includes('/@hookform/') || id.includes('/zod'))
              return 'vendor-forms'

            // Icons — tree-shaken per import, keep separate so icon updates don't bust other chunks
            if (id.includes('/lucide-react'))
              return 'vendor-icons'

            // Sentry — monitoring, keep isolated so it doesn't affect app chunk hashes
            if (id.includes('/@sentry/'))
              return 'vendor-sentry'

            // Everything else goes to a misc vendor chunk
            return 'vendor-misc'
          },
        },
      },
    },
  }
})
