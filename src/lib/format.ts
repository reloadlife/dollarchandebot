/** Number/text helpers — pure, no deps. */

export function formatPrice(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function formatDelta(curr: number, prev: number | null | undefined): string {
  if (prev == null || prev === 0) return "0 🔀";
  const d = curr - prev;
  if (d === 0) return "0 🔀";
  const pct = (d / prev) * 100;
  const arrow = d > 0 ? "🟢 ▲" : "🔴 ▼";
  const sign = d > 0 ? "+" : "";
  return `${arrow} ${sign}${formatPrice(d)} (${sign}${pct.toFixed(2)}%)`;
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
