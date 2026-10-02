"use client";
import { useState } from "react";
import { calculatePrice } from "@/lib/calculator";
import { type Quote, quoteLabel } from "@/lib/rates";
import { faNumber } from "@/lib/utils";
import { Freshness } from "./freshness";
export function ShopCalculator({ quotes, failed }: { quotes: Quote[] | null; failed: boolean }) {
  const [symbol, setSymbol] = useState("USD");
  const [base, setBase] = useState("100");
  const [factor, setFactor] = useState("1");
  const [unit, setUnit] = useState("toman");
  const quote = quotes?.find((q) => q.id === symbol);
  const price = calculatePrice(base, quote?.price, factor);
  const output = price == null ? null : price * (unit === "rial" ? 10 : 1);
  const inputClass = "mt-2 h-11 w-full rounded-[16px] border border-border bg-card px-3";
  return <section className="mt-8 border-t border-border pt-6" aria-labelledby="calculator-title">
    <h2 id="calculator-title" className="text-xl font-semibold">حساب قیمت فروشگاه</h2>
    <p className="mt-2 text-sm text-muted-foreground">قیمت پایه × نرخ بازار × ضریب. این محاسبه قیمت کالا را در فروشگاه تغییر نمی‌دهد.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label>ارز پایه<select className={inputClass} value={symbol} onChange={(e) => setSymbol(e.target.value)}>{(quotes ?? []).filter((q) => q.kind === "fx" || q.kind === "crypto").map((q) => <option key={q.id} value={q.id}>{quoteLabel(q)} ({q.id})</option>)}{!quotes?.length ? <option value="USD">دلار (USD)</option> : null}</select></label>
      <label>قیمت پایه<input type="number" min="0" step="any" dir="ltr" className={inputClass} value={base} onChange={(e) => setBase(e.target.value)} /></label>
      <label>ضریب<input type="number" min="0.0001" step="any" dir="ltr" className={inputClass} value={factor} onChange={(e) => setFactor(e.target.value)} /></label>
      <label>واحد خروجی<select className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)}><option value="toman">تومان</option><option value="rial">ریال</option></select></label>
    </div>
    <Freshness updatedAt={quote?.updated_at} failed={failed} />
    <p className="mt-3 text-xl font-semibold" aria-live="polite">{output != null && Number.isSafeInteger(output) ? `${faNumber(output)} ${unit === "rial" ? "ریال" : "تومان"}` : "نرخ و ورودی معتبر لازم است."}</p>
    <p className="mt-2 text-sm text-muted-foreground">نرخ مبنا: {quote?.price != null ? `${faNumber(quote.price)} تومان` : "در دسترس نیست"}</p>
  </section>;
}
