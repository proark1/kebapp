import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kebapp",
    short_name: "Kebapp",
    description: "Gruppeneinkauf und Betriebsübersicht für Dönerläden",
    start_url: "/app",
    display: "standalone",
    background_color: "#f3f5ef",
    theme_color: "#132019",
    lang: "de",
  };
}
