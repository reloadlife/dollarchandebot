import type { Metadata } from "next";
import { CopyBlock } from "@/components/copy-block";
import { API_BASE, BOT_URL } from "@/lib/rates";
import { fa } from "@/lib/utils";

export const metadata: Metadata = { title: "API · دلارچنده" };

const steps = [
  "ربات را باز کن و /key را بفرست.",
  "کلید را یک بار می‌بینی. همان را نگه دار.",
  "در درخواست، Authorization: Bearer یا X-Api-Key را بگذار.",
];

const routes = [
  ["/api/v1/latest", "آخرین قیمت همه نمادها"],
  ["/api/v1/symbols/USD", "یک نماد. شناسه را عوض کن."],
  ["/api/v1/symbols/USD/ticks", "تیک‌های ۲۴ ساعت"],
  ["/api/v1/symbols/USD/ohlc?days=30", "کندل روزانه، حداکثر ۹۰ روز"],
  ["/api/v1/exchanges", "خرید و فروش تتر در صرافی‌ها"],
  ["/chart/USD.png", "نمودار ۲۴ ساعت. برای ۷ روز ?r=7d را اضافه کن. این مسیر کلید نمی‌خواهد."],
];

const fields = [
  ["price", "آخرین قیمت، تومان"],
  ["prev_price", "قیمت قبلی، برای دیدن تغییر"],
  ["buy و sell", "دو سوی همان منبع. در صرافی، buy تومانی است که برای یک تتر می‌پردازی."],
  ["unit", "همیشه toman"],
  ["updated_at", "زمان یونیکس"],
];

export default function DevelopersPage() {
  const curl = `curl -H "Authorization: Bearer KEY" \\\n  ${API_BASE}/api/v1/symbols/USD`;
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">همان نرخ، برای کد</h1>
      <p className="mt-3 max-w-[48ch] text-muted-foreground">
        قیمت‌ها تومان‌اند. پاسخ حدود یک دقیقه می‌ماند. هر کلید حدود ۶۰ درخواست در دقیقه.
      </p>
      <p className="mt-3 max-w-[48ch] text-sm leading-7 text-muted-foreground">
        تابلو در سایت کلید نمی‌فرستد. افزونه و هر برنامه دیگری کلید می‌خواهد.
      </p>

      <ol className="mt-8 space-y-2 text-sm leading-7">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="w-5 shrink-0 text-muted-foreground">{fa(index + 1)}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <a href={BOT_URL} className="mt-4 inline-flex text-sm font-semibold text-brand">
        باز کردن ربات
      </a>

      <h2 className="mt-12 text-2xl font-semibold">آدرس</h2>
      <div className="mt-4">
        <CopyBlock text={API_BASE} label="کپی آدرس" />
      </div>

      <h2 className="mt-12 text-2xl font-semibold">یک نماد</h2>
      <div className="mt-4">
        <CopyBlock text={curl} label="کپی دستور" />
      </div>

      <h2 className="mt-12 text-2xl font-semibold">مسیرها</h2>
      <ul className="mt-4 overflow-hidden rounded-[16px] border border-border bg-card">
        {routes.map(([path, note], index) => (
          <li key={path} className={index === 0 ? "px-4 py-4" : "border-t border-border px-4 py-4"}>
            <p className="font-mono text-sm" dir="ltr">
              {path}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{note}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-2xl font-semibold">شکل پاسخ</h2>
      <dl className="mt-4 space-y-4">
        {fields.map(([name, note]) => (
          <div key={name}>
            <dt className="font-mono text-sm" dir="ltr">
              {name}
            </dt>
            <dd className="mt-1 text-sm text-muted-foreground">{note}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
