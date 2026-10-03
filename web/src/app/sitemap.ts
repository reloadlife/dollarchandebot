import type { MetadataRoute } from "next";
import { SHARE_SYMBOLS } from "@/lib/share";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "board", "dashboard", "docs", "developers", "privacy", "terms", "disclaimer", "woocommerce"];
  const symbols = SHARE_SYMBOLS.map((symbol) => symbol.id.toLowerCase());
  return [...pages, ...symbols].map((path) => ({
    url: `https://dollarchande.live/${path ? `${path}/` : ""}`,
  }));
}
