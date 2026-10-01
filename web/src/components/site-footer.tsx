import Link from "next/link";
import { BOT_URL, CHANNEL_URL } from "@/lib/rates";

const links = [
  { href: "/dashboard/", label: "داشبورد" },
  { href: "/docs/", label: "راهنما" },
  { href: "/board/", label: "تابلو" },
  { href: "/developers/", label: "API" },
  { href: CHANNEL_URL, label: "کانال", external: true },
  { href: BOT_URL, label: "ربات", external: true },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-x-5 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
        {links.map((link) =>
          link.external ? (
            <a key={link.label} href={link.href} className="hover:text-foreground">
              {link.label}
            </a>
          ) : (
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ),
        )}
      </div>
    </footer>
  );
}
