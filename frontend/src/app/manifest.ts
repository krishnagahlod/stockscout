import type { MetadataRoute } from "next";

// Lets phones "install" StockScout to the home screen; it opens full-screen like an app. No offline mode: every page needs fresh data.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StockScout",
    short_name: "StockScout",
    description: "Facts about Indian shares and funds, in plain words. End-of-day data, never tips.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
