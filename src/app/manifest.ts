import type { MetadataRoute } from "next";

/** Rende l'app installabile su Android (Chrome) e iPhone (Safari: "Aggiungi alla schermata Home"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Adaptive Coach AI",
    short_name: "Coach",
    description: "Il tuo allenatore personale per corsa, bici, nuoto e palestra.",
    lang: "it",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0d12",
    theme_color: "#0a0d12",
    categories: ["sports", "health", "fitness"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Registra un allenamento", url: "/allenamenti/nuova", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Coach AI", url: "/coach", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
