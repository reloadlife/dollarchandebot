import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyBlock } from "@/components/copy-block";
import { SymbolPrice } from "@/components/symbol-price";
import { API_BASE, BOT_URL } from "@/lib/rates";
import { jsonLd, pageMeta, SITE } from "@/lib/seo";
import { SHARE_SYMBOLS, sharePath, shareSymbol, shareUnit } from "@/lib/share";

export const dynamicParams = false;

export function generateStaticParams() {
  return SHARE_SYMBOLS.map((symbol) => ({ symbol: symbol.id.toLowerCase() }));
}

function load(raw: string) {
  return shareSymbol(raw);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  const def = load(symbol);
  if (!def) return {};
  const unit = shareUnit(def);
  const path = sharePath(def.id);
  return pageMeta({
    title: `${def.label} · دلارچنده`,
    description: `نرخ ${def.label} بازار آزاد، به ${unit}. نمودار و لینک ربات برای فرستادن.`,
    path,
    image: {
      url: `${API_BASE}/chart/${def.id}.png`,
      alt: `نمودار ${def.label}`,
    },
  });
}

export default async function SymbolPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const def = load(symbol);
  if (!def) notFound();
  const unit = shareUnit(def);
  const path = sharePath(def.id);
  const pageUrl = `${SITE}${path}`;
  const chart = `${API_BASE}/chart/${def.id}.png`;
  const digits = def.dollars ? 4 : def.id === "USD" || def.id === "EUR" || def.id === "USDT" ? 6 : 8;
  const graph = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${def.label} · دلارچنده`,
    url: pageUrl,
    inLanguage: "fa-IR",
    description: `نرخ ${def.label} بازار آزاد، به ${unit}.`,
    primaryImageOfPage: chart,
    isPartOf: { "@id": `${SITE}/#website` },
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph) }} />
      <p className="text-sm font-medium text-foreground/70">بازار آزاد · {unit}</p>
      <h1 className="mt-2 text-3xl font-semibold">{def.label}</h1>
      <div className="mt-6 rounded-[29px] border border-border bg-card p-3 sm:p-4">
        <SymbolPrice id={def.id} label={def.label} unit={unit} digits={digits} />
      </div>
      <img src={chart} alt={`نمودار ${def.label}`} className="mt-4 w-full rounded-[16px] border border-border" />
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={`${BOT_URL}?start=${def.id}`}
          className="inline-flex h-11 items-center justify-center rounded-[16px] bg-brand px-4 text-sm font-semibold text-brand-foreground"
        >
          ربات
        </a>
        <Link
          href="/board/"
          className="inline-flex h-11 items-center justify-center rounded-[16px] border border-border bg-card px-4 text-sm font-semibold"
        >
          تابلو
        </Link>
      </div>
      <p className="mb-2 mt-8 text-sm text-foreground/70">برای فرستادن</p>
      <CopyBlock text={pageUrl} label="کپی لینک" caption={path} />
    </main>
  );
}
