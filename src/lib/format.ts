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

/** Tehran wall-clock parts from unix seconds. */
export function tehranDateParts(tsSec: number): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(tsSec * 1000));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

const JALALI_MONTHS = [
  "",
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

/** Gregorian Y-M-D → Jalali Y-M-D (algorithm). */
export function gregorianToJalali(
  gy: number,
  gm: number,
  gd: number,
): { jy: number; jm: number; jd: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  if (gy > 1600) {
    jy = 979;
    gy -= 1600;
  } else {
    jy = 0;
    gy -= 621;
  }
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1]!;
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return { jy, jm, jd };
}

/** e.g. "22 تیر 1405 · 11:47" */
export function formatJalaliTehran(tsSec: number): string {
  const { year, month, day, hour, minute } = tehranDateParts(tsSec);
  const { jy, jm, jd } = gregorianToJalali(year, month, day);
  const mon = JALALI_MONTHS[jm] ?? String(jm);
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${jd} ${mon} ${jy} · ${hh}:${mm}`;
}

/** Delta only when moved; null when flat/missing (for quiet channel boards). */
export function formatDeltaQuiet(
  curr: number,
  prev: number | null | undefined,
): string | null {
  if (prev == null || prev === 0 || curr === prev) return null;
  const d = curr - prev;
  const pct = (d / prev) * 100;
  const icon = d > 0 ? "📈" : "📉";
  const sign = d > 0 ? "+" : "";
  return `${icon} ${sign}${formatPrice(d)} · ${sign}${pct.toFixed(2)}%`;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
