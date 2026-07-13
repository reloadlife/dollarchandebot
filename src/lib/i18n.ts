import type { Lang } from "../db/settings";

const en = {
  rateLimited: "⏳ Slow down — try again in a minute.",
  unknown: "Unknown command. Try /help",
  alertAdded: "🔔 Alert set",
  alertDeleted: "🗑 Alert removed",
  alertNone: "No alerts yet.\n<code>/alert USD above 180000</code>",
  settings: "Settings",
  langSet: "Language set to",
  feeSet: "Default fee set to",
  needPrice: "No price yet — wait for the next scrape (~5 min).",
  usageCompare: "Usage: <code>/compare USD USDT</code>",
  usageHistory: "Usage: <code>/history USD</code>",
  usage7d: "Usage: <code>/7d USD</code>",
  usageFee: "Usage: <code>/fee 2</code>",
  usageUnalert: "Usage: <code>/unalert 3</code>",
  usageAlert:
    "Usage:\n<code>/alert USD above 180000</code>\n<code>/alert USDT below 170000</code>\n<code>/alert USD move 2</code> (2%)",
  maxAlerts: "Max 10 alerts. Remove one with <code>/unalert ID</code>.",
  alertNotFound: "Alert not found.",
  unknownSymbol: "Unknown symbol",
  alertsTitle: "Alerts",
} as const;

const fa: Record<keyof typeof en, string> = {
  rateLimited: "⏳ کمی صبر کن — یک دقیقه بعد دوباره تلاش کن.",
  unknown: "دستور ناشناخته. /help را ببین.",
  alertAdded: "🔔 هشدار ثبت شد",
  alertDeleted: "🗑 هشدار حذف شد",
  alertNone: "هشداری نیست.\n<code>/alert USD above 180000</code>",
  settings: "تنظیمات",
  langSet: "زبان تنظیم شد:",
  feeSet: "کارمزد پیش‌فرض:",
  needPrice: "هنوز قیمتی نیست — اسکرپ بعدی (~۵ دقیقه).",
  usageCompare: "مثال: <code>/compare USD USDT</code>",
  usageHistory: "مثال: <code>/history USD</code>",
  usage7d: "مثال: <code>/7d USD</code>",
  usageFee: "مثال: <code>/fee 2</code>",
  usageUnalert: "مثال: <code>/unalert 3</code>",
  usageAlert:
    "مثال:\n<code>/alert USD above 180000</code>\n<code>/alert USDT below 170000</code>\n<code>/alert USD move 2</code> (٪۲)",
  maxAlerts: "حداکثر ۱۰ هشدار. با <code>/unalert ID</code> یکی را حذف کن.",
  alertNotFound: "هشدار پیدا نشد.",
  unknownSymbol: "نماد ناشناخته",
  alertsTitle: "هشدارها",
};

export type MsgKey = keyof typeof en;

export function t(lang: Lang, key: MsgKey): string {
  if (lang === "fa") return fa[key] ?? en[key];
  return en[key];
}
