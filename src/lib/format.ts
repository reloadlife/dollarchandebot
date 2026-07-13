/** Number/text helpers — pure, no deps. */

export function formatPrice(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export type DeltaTone = "up" | "down" | "flat";

export function deltaTone(curr: number, prev: number | null | undefined): DeltaTone {
  if (prev == null || prev === 0 || curr === prev) return "flat";
  return curr > prev ? "up" : "down";
}

export function formatDelta(
  curr: number,
  prev: number | null | undefined,
  emojis?: { up: string; down: string; flat: string },
): string {
  const up = emojis?.up ?? "📈";
  const down = emojis?.down ?? "📉";
  const flat = emojis?.flat ?? "➖";
  if (prev == null || prev === 0) return `${flat} 0`;
  const d = curr - prev;
  if (d === 0) return `${flat} 0`;
  const pct = (d / prev) * 100;
  const icon = d > 0 ? up : down;
  const sign = d > 0 ? "+" : "";
  return `${icon} ${sign}${formatPrice(d)} (${sign}${pct.toFixed(2)}%)`;
}

export function formatTimeTehran(tsSec: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(tsSec * 1000));
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
