import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vouch",
    short_name: "Vouch",
    description: "Pay when it's delivered. Get paid when it's verified.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
