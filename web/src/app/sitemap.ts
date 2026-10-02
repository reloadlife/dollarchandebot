import type { MetadataRoute } from "next";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "board", "dashboard", "docs", "developers", "privacy", "terms", "disclaimer"].map((path) => ({ url: `https://dollarchande.live/${path ? `${path}/` : ""}` }));
}
