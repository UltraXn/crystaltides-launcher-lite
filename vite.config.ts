import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  esbuild: {
    drop: (process.env.NODE_ENV === "production"
      ? ["console", "debugger"]
      : []) as ("console" | "debugger")[],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
        },
      },
    },
  },
  clearScreen: false,
  server: {
    port: 14300,
    strictPort: true,
    host: "0.0.0.0",
  },
});
