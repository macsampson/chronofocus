import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "popup.html"),
        background: resolve(__dirname, "src/background.ts"),
        content: resolve(__dirname, "src/content.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep JS files in root
          return "[name].js"
        },
        chunkFileNames: "[name].js",
        assetFileNames: (assetInfo) => {
          // Put HTML files in root and rename main.html to popup.html
          if (assetInfo.name && assetInfo.name.endsWith(".html")) {
            if (assetInfo.name === "main.html") {
              return "popup.html"
            }
            return "[name].[ext]"
          }
          return "[name].[ext]"
        },
      },
    },
    copyPublicDir: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  publicDir: "public",
  base: "./",
})
