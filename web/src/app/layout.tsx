import type { Metadata } from "next";
import "./globals.css";
import { vazirmatn } from "./fonts";
import { MotionRoot } from "@/components/motion-root";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
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
        </MotionRoot>
      </body>
    </html>
  );
}
