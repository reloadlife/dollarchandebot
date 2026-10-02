"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BOT_URL } from "@/lib/rates";

const links = [
  { href: "/#plugins", label: "افزونه‌ها" },
  { href: "/dashboard/", label: "داشبورد", match: "/dashboard" },
  { href: "/docs/", label: "راهنما", match: "/docs" },
  { href: "/board/", label: "تابلو", match: "/board" },
  { href: "/developers/", label: "API", match: "/developers" },
];

function current(pathname: string, match?: string) {
  return match ? pathname === match || pathname.startsWith(`${match}/`) : false;
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 rounded-full border border-border bg-card/90 px-2 py-1.5 shadow-[0_16px_40px_-28px_oklch(0_0_0/0.8)] backdrop-blur-md sm:px-3 lg:w-fit lg:gap-1">
        <Link href="/" className="shrink-0 px-2 text-base font-semibold text-foreground">
          دلارچنده
        </Link>
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="صفحه">
          {links.map((link) => {
            const on = current(pathname, link.match);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={on ? "page" : undefined}
                className={`inline-flex h-9 items-center rounded-full px-3 text-sm ${
                  on ? "bg-foreground font-semibold text-background" : "text-foreground/75 hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <a href={BOT_URL} className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold text-brand">
            ربات
          </a>
        </nav>
        <button
          type="button"
          className="inline-flex h-11 items-center rounded-full px-3 text-sm font-semibold text-foreground lg:hidden"
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "بستن" : "منو"}
        </button>
      </div>
      {open ? (
        <nav
          id="site-menu"
          aria-label="صفحه"
          className="mx-auto mt-2 grid max-w-6xl gap-1 rounded-[16px] border border-border bg-card p-2 shadow-[0_16px_40px_-28px_oklch(0_0_0/0.8)] lg:hidden"
        >
          {links.map((link) => {
            const on = current(pathname, link.match);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={on ? "page" : undefined}
                className={`flex h-11 items-center rounded-[16px] px-3 text-sm ${
                  on ? "bg-foreground font-semibold text-background" : "text-foreground hover:bg-muted"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <a href={BOT_URL} className="flex h-11 items-center rounded-[16px] px-3 text-sm font-semibold text-brand">
            ربات
          </a>
        </nav>
      ) : null}
    </header>
  );
}
