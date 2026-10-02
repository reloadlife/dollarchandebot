"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Freshness } from "@/components/freshness";
import { PriceChart, type CandlePoint } from "@/components/price-chart";
import { bucketForTicks, candlesFromTicks } from "@/lib/candles";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  changePct,
  fetchExchanges,
  fetchLatest,
  fetchOhlc,
  fetchTicks,
  quoteLabel,
  type Kind,
  type OhlcDay,
  type Quote,
  type Tick,
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
  const [history, setHistory] = useState<{ symbol: string; days: OhlcDay[] | null; ticks: Tick[] | null; dayError: boolean; tickError: boolean } | null>(null);
  const days = history?.symbol === selected ? history.days : null;
  const ticks = history?.symbol === selected ? history.ticks : null;
  const chartError = history?.symbol === selected && (range === "24h" ? history.tickError : history.dayError);
  const [venueError, setVenueError] = useState(false);
  const [chartAttempt, setChartAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stop = false;
    const load = () => {
      fetchLatest()
        .then((latest) => {
          if (stop) return;
          setQuotes(latest.quotes);
          setError(null);
        })
        .catch(() => {
          if (!stop) setError("نرخ تازه نرسید.");
        });
      fetchExchanges().then((book) => {
        if (!stop) { setVenues(book.venues); setVenueError(false); }
      }).catch(() => { if (!stop) setVenueError(true); });
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
    const load = async () => {
      const [ohlc, series] = await Promise.allSettled([fetchOhlc(selected), fetchTicks(selected)]);
      if (stop) return;
      setHistory((previous) => ({
        symbol: selected,
        days: ohlc.status === "fulfilled" ? ohlc.value.days : previous?.symbol === selected ? previous.days : null,
        ticks: series.status === "fulfilled" ? series.value.ticks : previous?.symbol === selected ? previous.ticks : null,
        dayError: ohlc.status === "rejected",
        tickError: series.status === "rejected",
      }));
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => { stop = true; window.clearInterval(timer); };
  }, [selected, chartAttempt]);

  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      const symbol = params.get("symbol") ?? "USD";
      setSelected(/^[A-Z0-9_]{1,20}$/.test(symbol) ? symbol : "USD");
      setRange(params.get("range") === "7d" ? "7d" : "24h");
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  function selectView(symbol: string, nextRange: "24h" | "7d") {
    setSelected(symbol);
    setRange(nextRange);
    const url = new URL(window.location.href);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("range", nextRange);
    window.history.pushState(null, "", url);
  }

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
  const points = useMemo<CandlePoint[] | null>(() => {
    if (range === "24h") {
      if (!ticks) return null;
      return candlesFromTicks(ticks).map((bar) => ({
        t: fa(tehranClock(bar.ts)),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }));
    }
    if (!days) return null;
    return days.slice(-7).flatMap((day) => {
      if (![day.open, day.high, day.low, day.close].every((value) => Number.isFinite(value))) return [];
      return [
        {
          t: fa(day.day.slice(5)),
          open: day.open,
          high: Math.max(day.high, day.open, day.close),
          low: Math.min(day.low, day.open, day.close),
          close: day.close,
        },
      ];
    });
  }, [range, ticks, days]);
  const candleHint =
    points && points.length > 0
      ? range === "7d"
        ? "هر کندل یک روز"
        : bucketForTicks(ticks ?? []) >= 60 * 60
          ? "هر کندل یک ساعت"
          : `هر کندل ${fa(bucketForTicks(ticks ?? []) / 60)} دقیقه`
      : null;

  function pick(id: string) {
    selectView(id, "24h");
    if (window.matchMedia("(max-width: 1023px)").matches) {
      detailRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {currentLabel}
            {candleHint ? <span className="text-xs"> · {candleHint}</span> : null}
          </p>
          <div className="flex gap-2">
            {(["24h", "7d"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={range === item}
                onClick={() => selectView(selected, item)}
                className={cn(
                  "inline-flex h-11 items-center rounded-[16px] px-4 text-sm",
                  range === item ? "bg-brand font-semibold text-brand-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {item === "24h" ? "۲۴ ساعت" : "۷ روز"}
              </button>
            ))}
          </div>
        </div>
        {chartError ? <p role="status" className="mt-3 text-sm text-destructive">نمودار تازه نرسید. {points ? "نمودار قبلی مانده است." : ""} <button type="button" className="font-semibold text-brand" onClick={() => setChartAttempt((n) => n + 1)}>تلاش دوباره</button></p> : null}
        {!(chartError && !points) ? <PriceChart key={`${selected}-${range}`}
          points={points}
          label={`کندل ${range === "24h" ? "۲۴ ساعت" : "۷ روز"} ${currentLabel}`}
        /> : null}
      </section>
      <aside ref={detailRef} className="min-w-0 scroll-mt-20 lg:sticky lg:top-20 lg:col-start-2 lg:row-start-2 lg:self-start">
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
        <Freshness updatedAt={current?.updated_at} failed={Boolean(error)} />

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

      <div className="lg:col-start-1 lg:row-start-2">
        <>
            {error ? <p className="mb-3 text-sm text-destructive">{error} عدد قبلی مانده است.</p> : null}
            <Tabs value={tab} defaultValue="rates" onValueChange={setTab}>
              <TabsList aria-label="بخش تابلو">
                <TabsTrigger value="rates">نرخ‌ها</TabsTrigger>
                <TabsTrigger value="usdt">صرافی‌های تتر</TabsTrigger>
              </TabsList>

            {tab === "rates" ? (
              <TabsContent value="rates" className="mt-4">
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
                {!quotes && error ? <EmptyState title="نرخ‌ها نرسید" description="اتصال قطع شد." action={<button type="button" onClick={() => setAttempt((n) => n + 1)} className="text-brand">دوباره بخوان</button>} /> : !quotes ? (
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
                              <Freshness updatedAt={quote.updated_at} failed={Boolean(error)} />
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
              </TabsContent>
            ) : (
              <TabsContent value="usdt" className="mt-4">
                {venueError ? <p role="status" className="mb-3 text-sm text-destructive">صرافی‌ها نرسیدند. {venues ? "عدد قبلی مانده است." : ""} <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-semibold text-brand">تلاش دوباره</button></p> : null}
                {!venues && venueError ? null : !venues ? (
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
                        <span><span className="font-medium">{venue.name}</span><Freshness updatedAt={venue.updated_at} failed={venueError} /></span>
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
              </TabsContent>
            )}
            </Tabs>
        </>
      </div>
    </div>
  );
}
