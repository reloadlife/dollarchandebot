import type { Metadata } from "next";
import "./globals.css";
import { vazirmatn } from "./fonts";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "دلارچنده",
  description: "نرخ بازار آزاد به تومان، تابلو و API.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <SiteHeader />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
