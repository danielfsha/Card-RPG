import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: path.resolve(__dirname, "./node_modules/buffer/"),
    },
    dedupe: ["@stellar/stellar-sdk", "react", "react-dom"],
  },
  optimizeDeps: {
    include: [
      "@stellar/stellar-sdk",
      "@stellar/stellar-sdk/contract",
      "@stellar/stellar-sdk/rpc",
      "buffer",
    ],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
})