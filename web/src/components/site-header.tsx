"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOT_URL } from "@/lib/rates";

const links = [
  { href: "/#plugins", label: "افزونه‌ها" },
  { href: "/dashboard/", label: "داشبورد", match: "/dashboard" },
  { href: "/docs/", label: "راهنما", match: "/docs" },
  { href: "/board/", label: "تابلو", match: "/board", desktop: true },
  { href: "/developers/", label: "API", match: "/developers", desktop: true },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="shrink-0 text-base font-semibold text-foreground">
          دلارچنده
        </Link>
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
          {links.map((link) => {
            const on = link.match ? pathname === link.match || pathname.startsWith(`${link.match}/`) : false;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={on ? "page" : undefined}
                className={`${link.desktop ? "hidden sm:inline-flex" : "inline-flex"} h-9 items-center rounded-[16px] px-3 ${
                  on ? "bg-muted font-semibold text-foreground" : "text-foreground/80 hover:bg-muted hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <a
            href={BOT_URL}
            className="ms-1 inline-flex h-9 items-center rounded-[16px] bg-brand px-3 font-semibold text-brand-foreground"
          >
            ربات
          </a>
        </nav>
      </div>
    </header>
  );
}
