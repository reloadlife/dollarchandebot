"use client";

import { useEffect, useState } from "react";
import { Freshness } from "@/components/freshness";
import { SegmentReadout } from "@/components/segments";
import { API_BASE, type Quote } from "@/lib/rates";

export function SymbolPrice({
  id,
  label,
  unit,
  digits,
}: {
  id: string;
  label: string;
  unit: string;
  digits: number;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stop = false;
    const load = () => {
      fetch(`${API_BASE}/api/v1/symbols/${encodeURIComponent(id)}`, { cache: "no-store" })
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
          return res.json() as Promise<Quote>;
        })
        .then((data) => {
          if (!stop) {
            setQuote(data);
            setFailed(false);
          }
        })
        .catch(() => {
          if (!stop) setFailed(true);
        });
    };
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [id, attempt]);

  const price = quote?.price != null ? String(Math.round(quote.price)) : "";
  const readable = price ? `${price} ${unit}` : `در حال خواندن ${label}`;

  return (
    <div className="totem-well rounded-[16px] px-4 py-6 sm:px-6">
      <p className="totem-dim mb-3 text-sm">
        {label} <span dir="ltr">{id}</span>
      </p>
      <Freshness updatedAt={quote?.updated_at} failed={failed} />
      <div className="sm:hidden">
        <SegmentReadout value={price} height={52} ghostDigits={digits} label={readable} />
      </div>
      <div className="hidden sm:block">
        <SegmentReadout value={price} height={84} ghostDigits={digits} label={readable} />
      </div>
      <p className="totem-dim mt-3 text-sm">{unit}</p>
      {failed ? (
        <p className="mt-3 text-sm text-destructive">
          نرخ الان نرسید.{" "}
          <button type="button" onClick={() => setAttempt((value) => value + 1)} className="font-semibold text-brand">
            دوباره بخوان
          </button>
        </p>
      ) : null}
    </div>
  );
}
