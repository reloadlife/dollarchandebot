"use client";

import { useEffect, useState } from "react";
import { BorderBeam } from "@/components/magicui/border-beam";
import { SegmentReadout } from "@/components/segments";
import { fetchLatest, quoteLabel, type Quote } from "@/lib/rates";
import { cn } from "@/lib/utils";

const ROWS = [
  { id: "USD", name: "دلار", digits: 6, lead: true },
  { id: "EUR", name: "یورو", digits: 6, lead: false },
  { id: "GBP", name: "پوند", digits: 6, lead: false },
  { id: "AED", name: "درهم", digits: 5, lead: false },
  { id: "TRY", name: "لیر", digits: 5, lead: false },
  { id: "USDT", name: "تتر", digits: 6, lead: false },
  { id: "GOLD18", name: "طلای ۱۸ عیار", digits: 8, lead: false },
  { id: "EMAMI", name: "سکه امامی", digits: 8, lead: false },
] as const;

function Readout({
  value,
  label,
  mobile,
  desktop,
  digits,
}: {
  value: string;
  label: string;
  mobile: number;
  desktop: number;
  digits: number;
}) {
  return (
    <>
      <div className="sm:hidden">
        <SegmentReadout value={value} height={mobile} ghostDigits={digits} label={label} />
      </div>
      <div className="hidden sm:block">
        <SegmentReadout value={value} height={desktop} ghostDigits={digits} label={label} />
      </div>
    </>
  );
}

export function ShopBoard() {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stop = false;
    const load = () => {
      fetchLatest()
        .then((data) => {
          if (stop) return;
          setQuotes(data.quotes);
          setFailed(false);
        })
        .catch(() => {
          if (!stop) setFailed(true);
        });
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [attempt]);

  const byId = (id: string) => quotes?.find((quote) => quote.id === id);

  return (
    <div className="relative mt-8 overflow-hidden rounded-[16px] border border-border bg-card p-3 sm:p-4">
      <BorderBeam colorFrom="#F8E7B0" colorTo="#E6C56A" size={90} duration={12} borderWidth={1.5} />
      {failed && !quotes ? (
        <p className="mb-3 px-1 text-sm text-destructive" role="status">
          نرخ‌ها نرسید.{" "}
          <button type="button" onClick={() => setAttempt((value) => value + 1)} className="font-semibold text-brand">
            دوباره بخوان
          </button>
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROWS.map((row) => {
          const quote = byId(row.id);
          const name = quote ? quoteLabel(quote) : row.name;
          const price = quote?.price != null ? String(Math.round(quote.price)) : "";
          return (
            <article
              key={row.id}
              className={cn("totem-well rounded-[16px] px-4 py-4", row.lead && "sm:col-span-2 lg:col-span-4 sm:py-6")}
            >
              <p className="totem-dim mb-2 text-sm">
                {name}{" "}
                <span dir="ltr">{row.id}</span>
              </p>
              <Readout
                value={price}
                label={price ? `${price} تومان` : `در حال خواندن ${name}`}
                mobile={row.lead ? 44 : 28}
                desktop={row.lead ? 72 : 36}
                digits={row.digits}
              />
            </article>
          );
        })}
      </div>
    </div>
  );
}
