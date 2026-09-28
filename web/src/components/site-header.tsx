import Link from "next/link";
import { BOT_URL, CHANNEL_URL } from "@/lib/rates";

const links = [
  { href: "/board/", label: "تابلو" },
  { href: "/developers/", label: "API" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          دلارچنده
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
          <a href={CHANNEL_URL} className="hover:text-foreground">
            کانال
          </a>
          <a href={BOT_URL} className="hover:text-foreground">
            ربات
          </a>
        </nav>
      </div>
    </header>
  );
}
