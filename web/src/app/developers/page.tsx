import type { Metadata } from "next";
import Link from "next/link";
import { CopyBlock } from "@/components/copy-block";
import { PageWash } from "@/components/page-wash";
import { GirihBackground } from "@/components/vibefarsi/girih";
import { ShineButton } from "@/components/vibefarsi/shine-button";
import { API_BASE, BOT_URL } from "@/lib/rates";
import { jsonLd, pageMeta, webApiGraph } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "API · دلارچنده",
  description: "مسیرهای عمومی نرخ تومان. هر کلاینت کلید ربات را می‌فرستد. بدون کلید پاسخ ۴۰۱ است.",
  path: "/developers/",
  markdown: "/developers.md",
});

const routes = [
  ["GET /api/v1/latest", "آخرین قیمت همه نمادها."],
  ["GET /api/v1/symbols", "فهرست نمادها."],
  ["GET /api/v1/symbols/:id", "یک نماد. به‌جای :id شناسه را بگذار، مثل USD."],
  ["GET /api/v1/symbols/:id/ticks", "تیک‌های ۲۴ ساعت همان نماد."],
  ["GET /api/v1/symbols/:id/ohlc", "کندل روزانه. پارامتر days بین 1 و 90 می‌ماند. بیرون این بازه همان سقف یا کف است."],
  ["GET /api/v1/exchanges", "خرید و فروش تتر در صرافی‌ها، به تومان."],
  ["GET /chart/{ID}.png", "نمودار ۲۴ ساعت. برای ۷ روز ?r=7d را اضافه کن. این مسیر کلید نمی‌خواهد."],
] as const;

const fields = [
  ["price", "آخرین قیمت، تومان"],
  ["prev_price", "قیمت قبلی، برای دیدن تغییر"],
  ["buy", "سوی خرید، تومان"],
  ["sell", "سوی فروش، تومان"],
  ["unit", "همیشه toman"],
  ["updated_at", "زمان یونیکس"],
] as const;

export default function DevelopersPage() {
  const curl = `curl -H "Authorization: Bearer KEY" \\\n  ${API_BASE}/api/v1/symbols/USD`;
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(webApiGraph) }} />
      <section className="totem-scene relative overflow-hidden">
        <PageWash />
        <GirihBackground className="opacity-30" />
        <div className="relative z-10 mx-auto max-w-3xl px-4 py-12 lg:py-16">
          <p className="text-sm font-medium text-foreground/70">API · نسخه ۱</p>
          <h1 className="mt-3 text-4xl font-semibold leading-[1.35]">همان نرخ، برای کد.</h1>
          <p className="mt-4 max-w-[48ch] leading-8 text-foreground/75">
            قیمت‌ها تومان‌اند. پاسخ حدود یک دقیقه در لبه می‌ماند. هر کلید حدود ۶۰ درخواست در دقیقه دارد.
          </p>
          <div className="mt-6">
            <ShineButton href={BOT_URL}>گرفتن کلید</ShineButton>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-12">
        <section>
          <h2 className="text-2xl font-semibold">کلید</h2>
          <p className="mt-4 leading-8 text-foreground/75">
            هر کلاینت، از جمله هر سه افزونه، باید کلید ربات را در Authorization: Bearer یا X-Api-Key بفرستد. بدون کلید پاسخ 401 است. افزونه بدون کلید کار نمی‌کند.
          </p>
          <ol className="mt-5 space-y-2 text-sm leading-7 text-foreground/80">
            <li>ربات را باز کن و /key را بفرست.</li>
            <li>کلید را یک بار می‌بینی. همان را نگه دار. در پایگاه فقط درهم آن می‌ماند.</li>
            <li>در درخواست، Authorization: Bearer یا X-Api-Key را بگذار.</li>
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">آدرس</h2>
          <div className="mt-4">
            <CopyBlock text={API_BASE} label="کپی آدرس" caption={API_BASE} />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">یک نماد</h2>
          <div className="mt-4">
            <CopyBlock text={curl} label="کپی دستور" caption="GET /api/v1/symbols/USD" />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">مسیرها</h2>
          <ul className="mt-4 overflow-hidden rounded-[16px] border border-border bg-card">
            {routes.map(([path, note], index) => (
              <li key={path} className={index === 0 ? "px-4 py-4" : "border-t border-border px-4 py-4"}>
                <p className="font-mono text-sm" dir="ltr">
                  {path}
                </p>
                <p className="mt-1 text-sm leading-7 text-foreground/75">{note}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">شکل پاسخ</h2>
          <dl className="mt-4 overflow-hidden rounded-[16px] border border-border bg-card">
            {fields.map(([name, note], index) => (
              <div key={name} className={index === 0 ? "px-4 py-4" : "border-t border-border px-4 py-4"}>
                <dt className="font-mono text-sm text-brand">{name}</dt>
                <dd className="mt-1 text-sm text-foreground/75">{note}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm leading-7 text-foreground/75">
            واحد در فیلد unit همیشه toman است. این عدد توصیه مالی نیست.
          </p>
          <p className="mt-6">
            <Link href="/docs/" className="text-sm font-semibold text-brand">
              راهنمای افزونه و هشدار
            </Link>
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">MCP</h2>
          <p className="mt-4 leading-8 text-foreground/75">
            عامل‌ها همان کلید را به POST /mcp می‌فرستند. پروتکل Streamable HTTP است و نشست ذخیره نمی‌شود. ابزارها list_symbols، get_quote، get_latest، get_ticks، get_ohlc و get_exchanges هستند. سقف با API مشترک است.
          </p>
          <div className="mt-4">
            <CopyBlock
              text={`curl -H "Authorization: Bearer KEY" -H "Accept: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \\\n  ${API_BASE}/mcp`}
              label="کپی دستور"
              caption="POST /mcp"
            />
          </div>
          <p className="mt-4 text-sm">
            <Link href="/disclaimer/" className="font-semibold text-brand">
              سلب مسئولیت
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
