import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/*.png"],
      manifest: {
        name: "MoodSwipe",
        short_name: "MoodSwipe",
        description: "A little perspective. One swipe at a time.",
        theme_color: "#131815",
        background_color: "#131815",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,webp,woff2,json,txt}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { proxy: { "/api": "http://localhost:8787" } },
  build: { sourcemap: false },
});
