import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/env";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Stare medicală și pregătire fizică pentru cluburi de fotbal.",
    lang: "ro",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#12305a",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Chestionarul de azi", url: "/chestionar" }, { name: "Planul de azi", url: "/azi" }],
  };
}
