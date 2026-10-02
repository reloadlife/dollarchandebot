import type { Metadata } from "next";
import "./globals.css";
import { vazirmatn } from "./fonts";
import { MotionRoot } from "@/components/motion-root";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { title: "دلارچنده", description: "نرخ بازار آزاد به تومان و افزونه‌های رایگان فروشگاه", url: "/", siteName: "دلارچنده", locale: "fa_IR", type: "website", images: [{ url: "/social-card.png", width: 1200, height: 630, alt: "دلارچنده — نرخ بازار آزاد" }] },
  twitter: { card: "summary_large_image", title: "دلارچنده", description: "نرخ بازار آزاد به تومان و افزونه‌های رایگان فروشگاه", images: ["/social-card.png"] },
  metadataBase: new URL("https://dollarchande.live"),
  title: "دلارچنده",
  description: "نرخ بازار آزاد به تومان. افزونه رایگان وردپرس، ووکامرس و WHMCS، با کلید از ربات.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <MotionRoot>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </MotionRoot>
      </body>
    </html>
  );
}
