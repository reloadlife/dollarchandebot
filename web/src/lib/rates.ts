export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://api.dollarchande.live";

export const BOT_URL = "https://t.me/DollarChandeBot";
export const CHANNEL_URL = "https://t.me/AlanDollarChande";

export type Kind = "fx" | "gold" | "coin" | "crypto";

export interface Quote {
  id: string;
  name: string;
  label_fa: string | null;
  kind: Kind | null;
  emoji: string | null;
  price: number | null;
  prev_price: number | null;
  buy: number | null;
  sell: number | null;
  source: string | null;
  updated_at: number | null;
  unit: "toman";
}

export interface Venue {
  exchange: string;
  name: string;
  buy: number | null;
  sell: number | null;
  mid: number | null;
  updated_at: number;
}

export interface Tick {
  ts: number;
  price: number;
}

export interface OhlcDay {
  day: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function quoteLabel(q: { id: string; label_fa: string | null; name: string }): string {
  return q.label_fa ?? q.name;
}

export function changePct(price: number | null, prev: number | null): number | null {
  if (price == null || prev == null || prev === 0) return null;
  return ((price - prev) / prev) * 100;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export function fetchLatest() {
  return getJson<{ unit: string; count: number; quotes: Quote[] }>("/api/v1/latest");
}

export function fetchExchanges() {
  return getJson<{ count: number; venues: Venue[] }>("/api/v1/exchanges");
}

export function fetchTicks(id: string) {
  return getJson<{ ticks: Tick[] }>(`/api/v1/symbols/${encodeURIComponent(id)}/ticks`);
}

export function fetchOhlc(id: string) {
  return getJson<{ days: OhlcDay[] }>(`/api/v1/symbols/${encodeURIComponent(id)}/ohlc?days=14`);
}

export function chartUrl(id: string, range: "24h" | "7d" = "24h"): string {
  const q = range === "7d" ? "?r=7d" : "";
  return `${API_BASE}/chart/${encodeURIComponent(id)}.png${q}`;
}
