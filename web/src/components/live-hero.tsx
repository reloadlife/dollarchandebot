"use client";

import { useEffect, useState } from "react";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { changePct, fetchLatest, quoteLabel, type Quote } from "@/lib/rates";
import { faPercent } from "@/lib/utils";

const WANT = ["USD", "USDT", "GOLD18", "EMAMI"];

export function LiveHero() {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = () => {
      fetchLatest()
        .then((data) => {
          if (!stop) setQuotes(data.quotes);
        })
        .catch(() => {
          if (!stop) setError(true);
        });
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  const picked = WANT.map((id) => quotes?.find((q) => q.id === id)).filter((q): q is Quote => Boolean(q));
  const lead = picked[0];

  if (error) {
    return <p className="text-sm text-muted-foreground">نرخ‌ها الان در دسترس نیستند.</p>;
  }
  if (!lead || lead.price == null) {
    return <Skeleton className="h-16 w-64" />;
  }

  const delta = changePct(lead.price, lead.prev_price);

  return (
    <div>
      <p className="text-sm text-muted-foreground">{quoteLabel(lead)}</p>
      <Price amount={lead.price} size="lg" />
      {delta != null && (
        <p className={delta >= 0 ? "text-sm text-success" : "text-sm text-destructive"}>
          {delta >= 0 ? "+" : "−"}
          {faPercent(Math.abs(delta), 2)} از تیک قبل
        </p>
      )}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {picked.slice(1).map((q) =>
          q.price == null ? null : (
            <div key={q.id} className="min-w-0">
              <p className="text-xs text-muted-foreground">{quoteLabel(q)}</p>
              <Price amount={q.price} size="sm" />
            </div>
          ),
        )}
      </div>
    </div>
  );
}
