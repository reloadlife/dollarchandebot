"use client";

import { useEffect, useState } from "react";
import { SegmentReadout } from "@/components/segments";
import { fetchLatest, quoteLabel, type Quote } from "@/lib/rates";
import { fa } from "@/lib/utils";

const STACK = [
  { id: "USDT", digits: 6 },
  { id: "GOLD18", digits: 8 },
] as const;

function tehranClock(unix: number): string {
  const ms = unix < 1e12 ? unix * 1000 : unix;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms));
}

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

export function Totem() {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [failed, setFailed] = useState(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stop = false;
    const load = () => {
      fetchLatest()
        .then((data) => {
          if (!stop) {
            setQuotes(data.quotes);
            setFailed(false);
          }
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

  const byId = (id: string) => quotes?.find((q) => q.id === id);
  const lead = byId("USD");
  const leadPrice = lead?.price != null ? String(Math.round(lead.price)) : "";
  const leadName = lead ? quoteLabel(lead) : "دلار";
  const leadLabel = leadPrice ? `${leadPrice} تومان` : "در حال خواندن نرخ دلار";
  const stamp = lead?.updated_at ? fa(tehranClock(lead.updated_at)) : null;

  return (
    <div className="rounded-[16px] border border-border bg-card p-3 shadow-[0_22px_40px_-26px_oklch(0.1_0.04_45)] sm:p-4">
      <div className="totem-well rounded-[16px] px-4 py-5 sm:px-6 sm:py-7">
        <p className="totem-dim mb-3 text-sm">
          {leadName} <span dir="ltr">USD</span>
        </p>
        <Readout value={leadPrice} label={leadLabel} mobile={52} desktop={84} digits={6} />
        <p className="totem-dim mt-3 text-sm">{stamp ? `آخرین نرخ، ${stamp}` : "تومان"}</p>
        {failed ? (
          <p className="mt-3 text-sm text-destructive">
            نرخ الان نرسید.{" "}
            <button type="button" onClick={() => setAttempt((value) => value + 1)} className="font-semibold text-brand">
              دوباره بخوان
            </button>
          </p>
        ) : null}
        <div className="totem-rule mt-6 flex flex-col gap-5 pt-5">
          {STACK.map((row) => {
            const q = byId(row.id);
            const price = q?.price != null ? String(Math.round(q.price)) : "";
            const name = q ? quoteLabel(q) : row.id;
            return (
              <div key={row.id}>
                <p className="totem-dim mb-2 text-sm">
                  {name} <span dir="ltr">{row.id}</span>
                </p>
                <Readout
                  value={price}
                  label={price ? `${price} تومان` : row.id}
                  mobile={34}
                  desktop={44}
                  digits={row.digits}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
