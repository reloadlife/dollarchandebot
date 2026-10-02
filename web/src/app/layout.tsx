import type { Metadata, Viewport } from "next";
import "./globals.css";
import { vazirmatn } from "./fonts";
import { MotionRoot } from "@/components/motion-root";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HOME_DESCRIPTION, HOME_TITLE, SITE, jsonLd, pageMeta, siteGraph } from "@/lib/seo";

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1e2a" },
  ],
};

export const metadata: Metadata = {
  ...pageMeta({ title: HOME_TITLE, description: HOME_DESCRIPTION, path: "/" }),
  metadataBase: new URL(SITE),
  applicationName: "دلارچنده",
  title: { default: HOME_TITLE, template: "%s · دلارچنده" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  formatDetection: { telephone: false, email: false, address: false },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(siteGraph) }} />
        <MotionRoot>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </MotionRoot>
      </body>
    </html>
  );
}
