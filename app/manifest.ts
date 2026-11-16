import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KAMIFY",
    short_name: "KAMIFY",
    description: "Rastreador de vendas e campanhas",
    id: "/painel",
    start_url: "/painel",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f1326",
    theme_color: "#2f6bff",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Campanhas", url: "/painel/campanhas" },
      { name: "Vendas", url: "/painel/vendas" },
    ],
  };
}
