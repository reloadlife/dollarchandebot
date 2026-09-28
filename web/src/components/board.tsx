"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  changePct,
  chartUrl,
  fetchExchanges,
  fetchLatest,
  fetchOhlc,
  quoteLabel,
  type Kind,
  type OhlcDay,
  type Quote,
  type Venue,
} from "@/lib/rates";
import { cn, en, fa, faNumber, faPercent } from "@/lib/utils";

const LEAD = ["USD", "USDT", "EUR", "GBP", "GOLD18", "EMAMI"];

const KINDS: Array<{ id: Kind | "all"; label: string }> = [
  { id: "all", label: "همه" },
  { id: "fx", label: "ارز" },
  { id: "gold", label: "طلا" },
  { id: "coin", label: "سکه" },
  { id: "crypto", label: "تتر" },
];

function deltaText(price: number | null, prev: number | null): { text: string; up: boolean } | null {
  const pct = changePct(price, prev);
  if (price == null || prev == null || pct == null) return null;
  const diff = price - prev;
  if (Math.abs(diff) < 1) return null;
  const sign = diff >= 0 ? "+" : "−";
  return { text: `${sign}${faNumber(Math.abs(diff))} (${faPercent(Math.abs(pct), 2)})`, up: diff >= 0 };
}

function tehranClock(unix: number): string {
  const ms = unix < 1e12 ? unix * 1000 : unix;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms));
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Board() {
  const detailRef = useRef<HTMLElement>(null);
  const [tab, setTab] = useState("rates");
  const [kind, setKind] = useState<Kind | "all">("all");
  const [query, setQuery] = useState("");
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [selected, setSelected] = useState("USD");
  const [range, setRange] = useState<"24h" | "7d">("24h");
  const [days, setDays] = useState<OhlcDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stop = false;
    const load = () => {
      Promise.all([fetchLatest(), fetchExchanges()])
        .then(([latest, book]) => {
          if (stop) return;
          setQuotes(latest.quotes);
          setVenues(book.venues);
          setError(null);
        })
        .catch(() => {
          if (!stop) setError("نرخ تازه نرسید.");
        });
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [attempt]);

  useEffect(() => {
    let stop = false;
    setDays(null);
    fetchOhlc(selected)
      .then((data) => {
        if (!stop) setDays(data.days);
      })
      .catch(() => {
        if (!stop) setDays([]);
      });
    return () => {
      stop = true;
    };
  }, [selected]);

  const needle = en(query.trim().toLowerCase());
  const rows = useMemo(() => {
    const list = (quotes ?? []).filter((quote) => {
      if (kind !== "all" && quote.kind !== kind) return false;
      if (!needle) return true;
      const blob = `${quote.id} ${quote.name} ${quote.label_fa ?? ""}`.toLowerCase();
      return blob.includes(needle);
    });
    return list.sort((a, b) => {
      const ar = LEAD.indexOf(a.id);
      const br = LEAD.indexOf(b.id);
      const ao = ar === -1 ? 100 : ar;
      const bo = br === -1 ? 100 : br;
      if (ao !== bo) return ao - bo;
      return quoteLabel(a).localeCompare(quoteLabel(b), "fa");
    });
  }, [quotes, kind, needle]);

  const current = quotes?.find((quote) => quote.id === selected);
  const currentLabel = current ? quoteLabel(current) : selected;

  function pick(id: string) {
    setSelected(id);
    setRange("24h");
    if (window.matchMedia("(max-width: 1023px)").matches) {
      detailRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <aside ref={detailRef} className="scroll-mt-20 lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1 lg:self-start">
        <p className="text-sm text-muted-foreground">{currentLabel}</p>
        <div aria-live="polite">
          {current?.price != null ? (
            <Price amount={current.price} size="lg" />
          ) : error && !quotes ? (
            <p className="mt-2 text-sm text-destructive">نرخ نرسید.</p>
          ) : quotes ? (
            <p className="mt-2 text-sm text-muted-foreground">این نماد نرسیده.</p>
          ) : (
            <Skeleton className="mt-2 h-10 w-40" />
          )}
        </div>
        {current?.updated_at ? (
          <p className="mt-1 text-sm text-muted-foreground">ساعت {fa(tehranClock(current.updated_at))} به وقت تهران</p>
        ) : null}
        <div className="mt-4 flex gap-2">
          {(["24h", "7d"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={range === item}
              onClick={() => setRange(item)}
              className={cn(
                "inline-flex h-11 items-center rounded-[16px] px-4 text-sm",
                range === item ? "bg-brand font-semibold text-brand-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {item === "24h" ? "۲۴ ساعت" : "۷ روز"}
            </button>
          ))}
        </div>
        <img
          key={`${selected}-${range}`}
          src={chartUrl(selected, range)}
          alt={`نمودار ${range === "24h" ? "۲۴ ساعت" : "۷ روز"} ${currentLabel}`}
          className="mt-4 min-h-40 w-full rounded-[16px] border border-border bg-card"
        />
        {days && days.length > 0 ? (
          <table className="mt-4 hidden w-full text-sm sm:table">
            <tbody>
              {days.slice(-5).map((day) => (
                <tr key={day.day} className="border-t border-border">
                  <td className="py-2 text-muted-foreground" dir="ltr">
                    {fa(day.day.slice(5))}
                  </td>
                  <td className="py-2 text-end tabular-nums">{faNumber(day.close)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </aside>

      <div className="lg:col-start-1 lg:row-start-1">
        {error && !quotes ? (
          <EmptyState
            title="نرخ‌ها نرسید"
            description="اتصال قطع شد. دوباره بخوان."
            action={
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="inline-flex h-11 items-center rounded-[16px] bg-brand px-4 text-sm font-semibold text-brand-foreground"
              >
                دوباره بخوان
              </button>
            }
          />
        ) : (
          <>
            {error ? <p className="mb-3 text-sm text-destructive">{error} عدد قبلی مانده است.</p> : null}
            <Tabs value={tab} defaultValue="rates" onValueChange={setTab}>
              <TabsList aria-label="بخش تابلو">
                <TabsTrigger value="rates">نرخ‌ها</TabsTrigger>
                <TabsTrigger value="usdt">صرافی‌های تتر</TabsTrigger>
              </TabsList>
            </Tabs>

            {tab === "rates" ? (
              <div className="mt-4">
                <label htmlFor="board-search" className="text-sm text-muted-foreground">
                  جستجو
                </label>
                <input
                  id="board-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="دلار، یورو، سکه"
                  className="mt-2 h-11 w-full rounded-[16px] border border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground"
                />
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="دسته">
                  {KINDS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={kind === item.id}
                      onClick={() => setKind(item.id)}
                      className={cn(
                        "inline-flex h-11 items-center rounded-[16px] px-4 text-sm",
                        kind === item.id
                          ? "bg-brand font-semibold text-brand-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {!quotes ? (
                  <Skeleton className="mt-4 h-64 w-full" />
                ) : rows.length === 0 ? (
                  <div className="mt-4">
                    <EmptyState
                      title="چیزی با این نام نیست"
                      action={
                        kind !== "all" ? (
                          <button type="button" onClick={() => setKind("all")} className="text-sm font-semibold text-brand">
                            جستجو در همه دسته‌ها
                          </button>
                        ) : null
                      }
                    />
                  </div>
                ) : (
                  <ul className="mt-4 overflow-hidden rounded-[16px] border border-border bg-card">
                    {rows.map((quote) => {
                      const delta = deltaText(quote.price, quote.prev_price);
                      const on = quote.id === selected;
                      return (
                        <li key={quote.id} className="border-t border-border first:border-t-0">
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => pick(quote.id)}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 px-4 py-3 text-start",
                              on ? "bg-brand/15" : "hover:bg-muted/60",
                            )}
                          >
                            <span>
                              <span className="block font-medium">{quoteLabel(quote)}</span>
                              <span className="text-xs text-muted-foreground" dir="ltr">
                                {quote.id}
                              </span>
                            </span>
                            <span className="text-end">
                              {quote.price == null ? (
                                <span className="text-sm text-muted-foreground">نیامده</span>
                              ) : (
                                <Price amount={quote.price} size="sm" unit="" />
                              )}
                              {delta ? (
                                <Badge variant={delta.up ? "success" : "destructive"} className="mt-0.5">
                                  {delta.text}
                                </Badge>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : (
              <div className="mt-4">
                {!venues ? (
                  <Skeleton className="h-64 w-full" />
                ) : venues.length === 0 ? (
                  <EmptyState title="صرافی زنده‌ای نیست" description="نیم‌ساعت است که هیچ صرافی جواب نداده." />
                ) : (
                  <ul className="overflow-hidden rounded-[16px] border border-border bg-card">
                    {venues.map((venue) => (
                      <li
                        key={venue.exchange}
                        className="flex items-baseline justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0"
                      >
                        <span className="font-medium">{venue.name}</span>
                        <span className="text-end text-sm tabular-nums">
                          <span className="text-muted-foreground">خرید </span>
                          {venue.buy == null ? "نیامده" : faNumber(venue.buy)}
                          <span className="text-muted-foreground"> فروش </span>
                          {venue.sell == null ? "نیامده" : faNumber(venue.sell)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-sm text-muted-foreground">خرید، تومان پرداختی برای یک تتر است. فروش، تومان دریافتی است.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
