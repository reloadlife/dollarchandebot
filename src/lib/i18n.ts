import type { Lang } from "../db/settings";

const en = {
  rateLimited: "⏳ Slow down — try again in a minute.",
  unknown: "Unknown command. /help",
  alertAdded: "🔔 Alert set",
  alertDeleted: "🗑 Alert removed",
  alertNone: "No alerts. Use /alert USD above 180000",
  settings: "Settings",
  langSet: "Language set to",
  feeSet: "Default fee set to",
  needPrice: "No price yet — wait for next scrape.",
} as const;

const fa: Record<keyof typeof en, string> = {
  rateLimited: "⏳ کمی صبر کن — یک دقیقه بعد دوباره تلاش کن.",
  unknown: "دستور ناشناخته. /help",
  alertAdded: "🔔 هشدار ثبت شد",
  alertDeleted: "🗑 هشدار حذف شد",
  alertNone: "هشداری نیست. مثال: /alert USD above 180000",
  settings: "تنظیمات",
  langSet: "زبان تنظیم شد:",
  feeSet: "کارمزد پیش‌فرض:",
  needPrice: "هنوز قیمتی نیست — اسکرپ بعدی را صبر کن.",
};

export type MsgKey = keyof typeof en;

export function t(lang: Lang, key: MsgKey): string {
  if (lang === "fa") return fa[key] ?? en[key];
  return en[key];
}
