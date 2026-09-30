"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GradientText } from "@/components/vibefarsi/gradient-text";
import { BOT_URL, CHANNEL_URL } from "@/lib/rates";

const links = [
  { href: "/#plugins", label: "افزونه‌ها" },
  { href: "/board/", label: "تابلو", match: "/board" },
  { href: "/developers/", label: "API", match: "/developers" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border/80 bg-background/75 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="shrink-0 text-sm font-semibold">
          <GradientText duration={8}>دلارچنده</GradientText>
        </Link>
        <nav className="flex items-center gap-4 overflow-x-auto whitespace-nowrap text-sm [scrollbar-width:none]">
          {links.map((link) => {
            const on = link.match ? pathname === link.match || pathname.startsWith(`${link.match}/`) : false;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={on ? "page" : undefined}
                className={on ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}
              >
                {link.label}
              </Link>
            );
          })}
          <a href={CHANNEL_URL} className="text-muted-foreground hover:text-foreground">
            کانال
          </a>
          <a href={BOT_URL} className="text-muted-foreground hover:text-foreground">
            ربات
          </a>
        </nav>
      </div>
    </header>
  );
}
