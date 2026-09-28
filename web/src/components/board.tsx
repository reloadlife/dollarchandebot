"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { fa, faNumber, faPercent } from "@/lib/utils";

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
  const sign = diff >= 0 ? "+" : "−";
  return { text: `${sign}${faNumber(Math.abs(diff))} (${faPercent(Math.abs(pct), 2)})`, up: diff >= 0 };
}

export function Board() {
  const [tab, setTab] = useState("rates");
  const [kind, setKind] = useState<Kind | "all">("all");
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [selected, setSelected] = useState("USD");
  const [days, setDays] = useState<OhlcDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          if (!stop) setError("خواندن نرخ‌ها ناموفق بود.");
        });
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

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

  const rows = useMemo(() => {
    const list = quotes ?? [];
    return kind === "all" ? list : list.filter((q) => q.kind === kind);
  }, [quotes, kind]);

  const current = quotes?.find((q) => q.id === selected);

  if (error) {
    return <EmptyState title="تابلو خالی است" description={error} />;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <Tabs value={tab} defaultValue="rates" onValueChange={setTab}>
          <TabsList aria-label="بخش تابلو">
            <TabsTrigger value="rates">نرخ‌ها</TabsTrigger>
            <TabsTrigger value="usdt">صرافی‌های تتر</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "rates" ? (
          <div className="mt-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={
                    kind === k.id ? "text-sm font-semibold text-foreground" : "text-sm text-muted-foreground"
                  }
                >
                  {k.label}
                </button>
              ))}
            </div>
            {!quotes ? (
              <Skeleton className="h-64 w-full" />
            ) : rows.length === 0 ? (
              <EmptyState title="نمادی در این دسته نیست" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نماد</TableHead>
                    <TableHead>قیمت</TableHead>
                    <TableHead>تغییر</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((q) => {
                    const d = deltaText(q.price, q.prev_price);
                    return (
                      <TableRow
                        key={q.id}
                        data-state={q.id === selected ? "selected" : undefined}
                        onClick={() => setSelected(q.id)}
                        className="cursor-pointer"
                      >
                        <TableCell>
                          <span className="font-medium">{quoteLabel(q)}</span>
                          <span className="ms-2 text-xs text-muted-foreground" dir="ltr">
                            {q.id}
                          </span>
                        </TableCell>
                        <TableCell numeric>{q.price == null ? "—" : <Price amount={q.price} size="sm" unit="" />}</TableCell>
                        <TableCell>
                          {d ? (
                            <Badge variant={d.up ? "success" : "destructive"}>{d.text}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        ) : (
          <div className="mt-4">
            {!venues ? (
              <Skeleton className="h-64 w-full" />
            ) : venues.length === 0 ? (
              <EmptyState title="صرافی زنده‌ای نیست" description="نیم‌ساعت است که هیچ صرافی جواب نداده." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>صرافی</TableHead>
                    <TableHead>خرید</TableHead>
                    <TableHead>فروش</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venues.map((v) => (
                    <TableRow key={v.exchange}>
                      <TableCell>{v.name}</TableCell>
                      <TableCell numeric>{v.buy == null ? "—" : faNumber(v.buy)}</TableCell>
                      <TableCell numeric>{v.sell == null ? "—" : faNumber(v.sell)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="mt-2 text-xs text-muted-foreground">خرید = تومانِ پرداختی برای یک تتر. فروش = تومانِ دریافتی.</p>
          </div>
        )}
      </div>

      <aside className="lg:pt-12">
        <p className="text-sm text-muted-foreground">{current ? quoteLabel(current) : selected}</p>
        {current?.price != null ? <Price amount={current.price} size="md" /> : <Skeleton className="mt-2 h-8 w-32" />}
        <img
          src={chartUrl(selected, "24h")}
          alt=""
          className="mt-4 w-full rounded-xl border border-border bg-card"
        />
        <p className="mt-2 text-xs text-muted-foreground">۲۴ ساعت</p>
        {days && days.length > 0 && (
          <table className="mt-4 w-full text-xs">
            <tbody>
              {days.slice(-5).map((d) => (
                <tr key={d.day} className="border-t border-border">
                  <td className="py-1 text-muted-foreground" dir="ltr">
                    {fa(d.day.slice(5))}
                  </td>
                  <td className="py-1 text-end tabular-nums">{faNumber(d.close)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </aside>
    </div>
  );
}
