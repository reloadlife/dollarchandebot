"use client";

import { Freshness } from "@/components/freshness";

import { useEffect, useState } from "react";
import { Marquee } from "@/components/vibefarsi/marquee";
import { fetchLatest, quoteLabel, type Quote } from "@/lib/rates";
import { faNumber } from "@/lib/utils";

const PREFER = ["USD", "EUR", "GBP", "AED", "TRY", "USDT", "GOLD18", "EMAMI", "AZADI", "NIM"];

export function RateMarquee() {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);

  useEffect(() => {
    let stop = false;
    const load = () => {
      fetchLatest()
        .then((data) => {
          if (!stop) setQuotes(data.quotes);
        })
        .catch(() => {
          if (!stop) setQuotes([]);
        });
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  const picked = PREFER.map((id) => quotes?.find((quote) => quote.id === id)).filter(
    (quote): quote is Quote => quote?.price != null,
  );

  return (
    <div className="relative border-y border-border bg-card/50 py-3">
      {picked.length === 0 ? (
        <p className="px-4 text-center text-sm text-muted-foreground">
          {quotes === null ? "در حال خواندن نرخ‌ها" : "نرخ‌ها الان در دسترس نیستند."}
        </p>
      ) : (
        <Marquee duration={42} gap="0.5rem">
          {picked.map((quote) => (
            <span key={quote.id} className="inline-flex items-baseline gap-2 px-5 text-sm">
              <span className="text-muted-foreground">{quoteLabel(quote)}</span>
              <span className="font-semibold tabular-nums text-foreground">{faNumber(quote.price!)}</span>
              <span className="text-xs text-muted-foreground">تومان</span><Freshness updatedAt={quote.updated_at} />
            </span>
          ))}
        </Marquee>
      )}
    </div>
  );
}
