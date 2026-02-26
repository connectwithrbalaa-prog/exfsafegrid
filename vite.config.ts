import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      // In dev (Lovable IDE or local), forward /api/* to the FastAPI backend.
      // Set VITE_API_TARGET to override (e.g. https://your-vps-ip:8000).
      // In production the Nginx reverse proxy handles this instead.
      "/api": {
        target: process.env.VITE_API_TARGET ?? "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  define: {
    // Fallback values when .env is missing (auto-generated file can disappear after restores)
    ...(process.env.VITE_SUPABASE_URL ? {} : {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify("https://efutjtbgcqbprgtefcfy.supabase.co"),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmdXRqdGJnY3FicHJndGVmY2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NzQwNjMsImV4cCI6MjA4NjM1MDA2M30.loqmdVDIwPLEtCVDZ6M8fozqe-xjPwyVHR6LM8Db6IA"),
      'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify("efutjtbgcqbprgtefcfy"),
    }),
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
