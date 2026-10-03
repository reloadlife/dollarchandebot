/** Pages people can forward. Ids match the worker symbol list. */

export type ShareSymbol = {
  id: string;
  label: string;
  dollars: boolean;
};

export const SHARE_SYMBOLS: ShareSymbol[] = [
  { id: "USD", label: "دلار", dollars: false },
  { id: "EUR", label: "یورو", dollars: false },
  { id: "GBP", label: "پوند", dollars: false },
  { id: "CHF", label: "فرانک سوئیس", dollars: false },
  { id: "CAD", label: "دلار کانادا", dollars: false },
  { id: "AUD", label: "دلار استرالیا", dollars: false },
  { id: "TRY", label: "لیر", dollars: false },
  { id: "AED", label: "درهم", dollars: false },
  { id: "CNY", label: "یوان", dollars: false },
  { id: "JPY", label: "ین", dollars: false },
  { id: "SEK", label: "کرون سوئد", dollars: false },
  { id: "NOK", label: "کرون نروژ", dollars: false },
  { id: "DKK", label: "کرون دانمارک", dollars: false },
  { id: "RUB", label: "روبل", dollars: false },
  { id: "THB", label: "بات", dollars: false },
  { id: "SGD", label: "دلار سنگاپور", dollars: false },
  { id: "HKD", label: "دلار هنگ‌کنگ", dollars: false },
  { id: "AZN", label: "منات", dollars: false },
  { id: "AMD", label: "درام", dollars: false },
  { id: "SAR", label: "ریال عربستان", dollars: false },
  { id: "INR", label: "روپیه", dollars: false },
  { id: "MYR", label: "رینگیت", dollars: false },
  { id: "AFN", label: "افغانی", dollars: false },
  { id: "KWD", label: "دینار کویت", dollars: false },
  { id: "IQD", label: "دینار عراق", dollars: false },
  { id: "BHD", label: "دینار بحرین", dollars: false },
  { id: "OMR", label: "ریال عمان", dollars: false },
  { id: "QAR", label: "ریال قطر", dollars: false },
  { id: "MITHQAL", label: "مثقال", dollars: false },
  { id: "GOLD18", label: "گرم ۱۸", dollars: false },
  { id: "OUNCE", label: "انس طلا", dollars: true },
  { id: "GOLD24", label: "طلا ۲۴", dollars: false },
  { id: "SILVER", label: "نقره", dollars: false },
  { id: "XAG", label: "انس نقره", dollars: true },
  { id: "XPT", label: "پلاتین", dollars: true },
  { id: "EMAMI", label: "امامی", dollars: false },
  { id: "AZADI", label: "آزادی", dollars: false },
  { id: "HALF", label: "نیم سکه", dollars: false },
  { id: "QUARTER", label: "ربع سکه", dollars: false },
  { id: "GERAMI", label: "سکه گرمی", dollars: false },
  { id: "USDT", label: "تتر", dollars: false },
];

export function shareSymbol(raw: string): ShareSymbol | undefined {
  const id = raw.trim().toLowerCase();
  return SHARE_SYMBOLS.find((s) => s.id.toLowerCase() === id);
}

export function sharePath(id: string): string {
  return `/${id.toLowerCase()}/`;
}

export function shareUnit(symbol: ShareSymbol): "دلار" | "تومان" {
  return symbol.dollars ? "دلار" : "تومان";
}
