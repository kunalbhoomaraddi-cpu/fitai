/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, /api is proxied to FastAPI so the browser never needs CORS or API keys.
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', css: false, restoreMocks: true },
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.VITE_API_PROXY || 'http://127.0.0.1:8000', changeOrigin: true } },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        // Long-lived libraries get their own files so browsers keep them cached between releases.
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|cookie|set-cookie-parser)[\\/]/ },
            { name: 'markdown', test: /node_modules[\\/](react-markdown|remark-[a-z-]+|micromark[a-z-]*|mdast-[a-z-]+|unified|unist-[a-z-]+|hast-[a-z-]+|vfile[a-z-]*|property-information|space-separated-tokens|comma-separated-tokens|decode-named-character-reference|character-entities[a-z-]*|devlop|bail|trough|is-plain-obj|ccount|longest-streak|markdown-table|zwitch|trim-lines|html-url-attributes|estree-util-is-identifier-name|style-to-[a-z-]+|inline-style-parser|extend)[\\/]/ },
          ],
        },
      },
    },
  },
})
