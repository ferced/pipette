import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pipette",
    short_name: "Pipette",
    description: "Today's science, one drop at a time. Made by Ferced.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef2f0",
    theme_color: "#14201c",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
