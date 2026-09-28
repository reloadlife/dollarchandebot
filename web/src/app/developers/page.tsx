import type { Metadata } from "next";
import { API_BASE } from "@/lib/rates";

export const metadata: Metadata = { title: "API · دلارچنده" };

const endpoints = [
  ["GET", "/api/v1", "فهرست مسیرها"],
  ["GET", "/api/v1/latest", "آخرین قیمت همه‌ی نمادها"],
  ["GET", "/api/v1/symbols", "شناسه‌ها، نام و نام فارسی"],
  ["GET", "/api/v1/symbols/USD", "یک نماد"],
  ["GET", "/api/v1/symbols/USD/ticks", "تیک‌های ۲۴ ساعت"],
  ["GET", "/api/v1/symbols/USD/ohlc?days=30", "کندل روزانه، حداکثر ۹۰ روز"],
  ["GET", "/api/v1/exchanges", "خرید و فروش تتر در صرافی‌ها"],
  ["GET", "/chart/USD.png", "نمودار ۲۴ ساعت. برای ۷ روز: ?r=7d"],
];

export default function DevelopersPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl">API</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        خواندنی است و کلید نمی‌خواهد. قیمت‌ها تومان‌اند. پاسخ حدود یک دقیقه cache می‌شود.
      </p>
      <p className="mt-4 text-sm" dir="ltr">
        {API_BASE}
      </p>

      <pre className="mt-6 overflow-x-auto rounded-xl border border-border bg-card p-4 text-xs leading-6" dir="ltr">
        {`curl ${API_BASE}/api/v1/symbols/USD`}
      </pre>

      <table className="mt-8 w-full text-sm">
        <tbody>
          {endpoints.map(([method, path, note]) => (
            <tr key={path} className="border-t border-border">
              <td className="py-2 pe-3 text-xs text-muted-foreground">{method}</td>
              <td className="py-2 pe-3" dir="ltr">
                <code>{path}</code>
              </td>
              <td className="py-2 text-muted-foreground">{note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-10 text-lg">یک قیمت</h2>
      <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-card p-4 text-xs leading-6" dir="ltr">
        {`{
  "id": "USD",
  "name": "US Dollar",
  "label_fa": "دلار",
  "price": 178850,
  "prev_price": 178730,
  "buy": 178800,
  "sell": 178900,
  "unit": "toman",
  "updated_at": 1710000000
}`}
      </pre>
      <p className="mt-3 text-sm text-muted-foreground">
        buy و sell سمت خرید و فروش همان منبع‌اند. در صرافی‌ها، buy تومانی است که برای خریدن یک تتر می‌پردازید.
      </p>
    </main>
  );
}
