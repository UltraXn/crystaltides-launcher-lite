import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  base: "./",
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
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('@tauri-apps')) {
              return 'vendor-tauri';
            }
            if (id.includes('dompurify') || id.includes('jose')) {
              return 'vendor-security';
            }
          }
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
