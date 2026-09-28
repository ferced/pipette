import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/search?", "/es/search?"] }],
    sitemap: "https://pipette.day/sitemap.xml",
    host: "https://pipette.day",
  };
}
