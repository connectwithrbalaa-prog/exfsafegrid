import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

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
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "placeholder.svg"],
      manifest: {
        name: "ExfSafeGrid",
        short_name: "ExfSafeGrid",
        description: "Wildfire-aware utility operations platform",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/favicon.ico", sizes: "64x64", type: "image/x-icon" },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/v1\/.*/,
            handler: "NetworkFirst",
            options: { cacheName: "edge-functions", expiration: { maxEntries: 50, maxAgeSeconds: 300 } },
          },
          {
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/,
            handler: "CacheFirst",
            options: { cacheName: "mapbox-tiles", expiration: { maxEntries: 200, maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
