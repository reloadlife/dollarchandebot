import type { Metadata } from "next";
import { BOT_URL, CHANNEL_URL } from "@/lib/rates";

export const SITE = "https://dollarchande.live";
export const SITE_NAME = "دلارچنده";
export const HOME_TITLE = "دلارچنده — نرخ دلار، طلا و ارز بازار آزاد";
export const HOME_DESCRIPTION =
  "نرخ لحظه‌ای دلار، یورو، تتر، طلا و سکه بازار آزاد به تومان. افزونه رایگان وردپرس، ووکامرس و WHMCS.";

const social = {
  url: "/social-card.png",
  width: 1200,
  height: 630,
  alt: "دلارچنده — نرخ بازار آزاد",
} as const;

/** Shared title, description, canonical, Open Graph, and Twitter tags. */
export function pageMeta({
  title,
  description,
  path,
  markdown = "/llms.txt",
  image,
}: {
  title: string;
  description: string;
  path: string;
  markdown?: string;
  image?: { url: string; alt: string };
}): Metadata {
  const picture = image ?? social;
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: path,
      languages: { "fa-IR": path },
      types: { "text/markdown": markdown },
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "fa_IR",
      type: "website",
      images: [picture],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: picture.url, alt: picture.alt }],
    },
  };
}

export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export const siteGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      name: SITE_NAME,
      url: `${SITE}/`,
      inLanguage: "fa-IR",
      description: HOME_DESCRIPTION,
      publisher: { "@id": `${SITE}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: SITE_NAME,
      url: `${SITE}/`,
      logo: `${SITE}/icon.png`,
      sameAs: [BOT_URL, CHANNEL_URL],
    },
    {
      "@type": "SoftwareApplication",
      name: "افزونه دلارچنده",
      applicationCategory: "BusinessApplication",
      operatingSystem: "WordPress, WooCommerce, WHMCS",
      offers: { "@type": "Offer", price: "0", priceCurrency: "IRR" },
      url: `${SITE}/#plugins`,
      description: "افزونه رایگان وردپرس، ووکامرس و WHMCS. قیمت فروشگاه از نرخ بازار آزاد به تومان نوشته می‌شود.",
      provider: { "@id": `${SITE}/#organization` },
      isAccessibleForFree: true,
    },
  ],
};

export const webApiGraph = {
  "@context": "https://schema.org",
  "@type": "WebAPI",
  name: "DollarChande API",
  url: "https://api.dollarchande.live/api/v1",
  documentation: `${SITE}/developers/`,
  description: "نرخ بازار آزاد به تومان. هر کلاینت کلید ربات را می‌فرستد. بدون کلید پاسخ ۴۰۱ است.",
  inLanguage: "fa-IR",
  provider: { "@id": `${SITE}/#organization` },
};

export function docsGraph(description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "راهنمای نصب دلارچنده",
    url: `${SITE}/docs/`,
    inLanguage: "fa-IR",
    description,
    author: { "@id": `${SITE}/#organization` },
    publisher: { "@id": `${SITE}/#organization` },
  };
}
