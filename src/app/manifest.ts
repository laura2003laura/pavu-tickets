import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PAVU tickets",
    short_name: "PAVU",
    start_url: "/",
    display: "standalone",
    background_color: "#1e1230",
    theme_color: "#1e1230",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
