/** Canonical symbol registry — lives in code, not D1 (zero DB cost). */

export type SymbolKind = "fx" | "coin" | "gold" | "crypto";

export interface SymbolDef {
  /** internal id, uppercase for bot queries */
  id: string;
  /** bonbast raw key (usd, emami1, mithqal, …) or USDT */
  sourceKey: string;
  source: "bonbast" | "tetherland";
  name: string;
  emoji: string;
  kind: SymbolKind;
  /** aliases users may type */
  aliases: string[];
  /** include in 15m channel list */
  channelList: boolean;
}

export const SYMBOLS: SymbolDef[] = [
  // —— FX (bonbast) ——
  { id: "USD", sourceKey: "usd", source: "bonbast", name: "US Dollar", emoji: "💲", kind: "fx", aliases: ["dollar", "دلار"], channelList: true },
  { id: "EUR", sourceKey: "eur", source: "bonbast", name: "Euro", emoji: "🇪🇺", kind: "fx", aliases: ["euro", "یورو"], channelList: true },
  { id: "GBP", sourceKey: "gbp", source: "bonbast", name: "British Pound", emoji: "💷", kind: "fx", aliases: ["pound", "پوند"], channelList: true },
  { id: "CHF", sourceKey: "chf", source: "bonbast", name: "Swiss Franc", emoji: "🇨🇭", kind: "fx", aliases: ["franc"], channelList: true },
  { id: "CAD", sourceKey: "cad", source: "bonbast", name: "Canadian Dollar", emoji: "🇨🇦", kind: "fx", aliases: [], channelList: true },
  { id: "AUD", sourceKey: "aud", source: "bonbast", name: "Australian Dollar", emoji: "🇦🇺", kind: "fx", aliases: [], channelList: false },
  { id: "TRY", sourceKey: "try", source: "bonbast", name: "Turkish Lira", emoji: "🇹🇷", kind: "fx", aliases: ["lira", "لیر"], channelList: true },
  { id: "AED", sourceKey: "aed", source: "bonbast", name: "UAE Dirham", emoji: "🇦🇪", kind: "fx", aliases: ["dirham", "درهم"], channelList: false },
  { id: "CNY", sourceKey: "cny", source: "bonbast", name: "Chinese Yuan", emoji: "🇨🇳", kind: "fx", aliases: ["yuan"], channelList: false },
  { id: "JPY", sourceKey: "jpy", source: "bonbast", name: "10 Japanese Yen", emoji: "🇯🇵", kind: "fx", aliases: ["yen"], channelList: false },
  { id: "SEK", sourceKey: "sek", source: "bonbast", name: "Swedish Krona", emoji: "🇸🇪", kind: "fx", aliases: [], channelList: false },
  { id: "NOK", sourceKey: "nok", source: "bonbast", name: "Norwegian Krone", emoji: "🇳🇴", kind: "fx", aliases: [], channelList: false },
  { id: "DKK", sourceKey: "dkk", source: "bonbast", name: "Danish Krone", emoji: "🇩🇰", kind: "fx", aliases: [], channelList: false },
  { id: "RUB", sourceKey: "rub", source: "bonbast", name: "Russian Ruble", emoji: "🇷🇺", kind: "fx", aliases: ["ruble"], channelList: false },
  { id: "THB", sourceKey: "thb", source: "bonbast", name: "Thai Baht", emoji: "🇹🇭", kind: "fx", aliases: [], channelList: false },
  { id: "SGD", sourceKey: "sgd", source: "bonbast", name: "Singapore Dollar", emoji: "🇸🇬", kind: "fx", aliases: [], channelList: false },
  { id: "HKD", sourceKey: "hkd", source: "bonbast", name: "Hong Kong Dollar", emoji: "🇭🇰", kind: "fx", aliases: [], channelList: false },
  { id: "AZN", sourceKey: "azn", source: "bonbast", name: "Azerbaijani Manat", emoji: "🇦🇿", kind: "fx", aliases: [], channelList: false },
  { id: "AMD", sourceKey: "amd", source: "bonbast", name: "10 Armenian Dram", emoji: "🇦🇲", kind: "fx", aliases: [], channelList: false },
  { id: "SAR", sourceKey: "sar", source: "bonbast", name: "Saudi Riyal", emoji: "🇸🇦", kind: "fx", aliases: [], channelList: false },
  { id: "INR", sourceKey: "inr", source: "bonbast", name: "Indian Rupee", emoji: "🇮🇳", kind: "fx", aliases: [], channelList: false },
  { id: "MYR", sourceKey: "myr", source: "bonbast", name: "Malaysian Ringgit", emoji: "🇲🇾", kind: "fx", aliases: [], channelList: false },
  { id: "AFN", sourceKey: "afn", source: "bonbast", name: "Afghan Afghani", emoji: "🇦🇫", kind: "fx", aliases: [], channelList: false },
  { id: "KWD", sourceKey: "kwd", source: "bonbast", name: "Kuwaiti Dinar", emoji: "🇰🇼", kind: "fx", aliases: [], channelList: true },
  { id: "IQD", sourceKey: "iqd", source: "bonbast", name: "100 Iraqi Dinar", emoji: "🇮🇶", kind: "fx", aliases: [], channelList: false },
  { id: "BHD", sourceKey: "bhd", source: "bonbast", name: "Bahraini Dinar", emoji: "🇧🇭", kind: "fx", aliases: [], channelList: true },
  { id: "OMR", sourceKey: "omr", source: "bonbast", name: "Omani Rial", emoji: "🇴🇲", kind: "fx", aliases: [], channelList: false },
  { id: "QAR", sourceKey: "qar", source: "bonbast", name: "Qatari Rial", emoji: "🇶🇦", kind: "fx", aliases: [], channelList: false },

  // —— Gold ——
  { id: "MITHQAL", sourceKey: "mithqal", source: "bonbast", name: "Gold Mithqal", emoji: "🥇", kind: "gold", aliases: ["mesghal", "مثقال"], channelList: true },
  { id: "GOLD18", sourceKey: "gol18", source: "bonbast", name: "Gold Gram (18k)", emoji: "🥇", kind: "gold", aliases: ["gold", "geram", "گرم", "gol18"], channelList: true },
  { id: "OUNCE", sourceKey: "ounce", source: "bonbast", name: "Gold Ounce (USD)", emoji: "🟡", kind: "gold", aliases: ["ons"], channelList: false },

  // —— Coins ——
  { id: "EMAMI", sourceKey: "emami1", source: "bonbast", name: "Emami Coin", emoji: "🪙", kind: "coin", aliases: ["emami", "امامی"], channelList: true },
  { id: "AZADI", sourceKey: "azadi1", source: "bonbast", name: "Azadi Coin", emoji: "🪙", kind: "coin", aliases: ["azadi", "آزادی"], channelList: true },
  { id: "HALF", sourceKey: "azadi1_2", source: "bonbast", name: "½ Azadi", emoji: "🪙", kind: "coin", aliases: ["half", "nim"], channelList: true },
  { id: "QUARTER", sourceKey: "azadi1_4", source: "bonbast", name: "¼ Azadi", emoji: "🪙", kind: "coin", aliases: ["quarter", "rob"], channelList: true },
  { id: "GERAMI", sourceKey: "azadi1g", source: "bonbast", name: "Gerami Coin", emoji: "🪙", kind: "coin", aliases: ["gerami", "گرمی"], channelList: true },

  // —— Crypto (tetherland, Toman) ——
  { id: "USDT", sourceKey: "USDT", source: "tetherland", name: "Tether USDT", emoji: "💰", kind: "crypto", aliases: ["tether", "تتر"], channelList: true },
];

const byId = new Map<string, SymbolDef>();
const byAlias = new Map<string, SymbolDef>();

for (const s of SYMBOLS) {
  byId.set(s.id, s);
  byAlias.set(s.id.toLowerCase(), s);
  byAlias.set(s.sourceKey.toLowerCase(), s);
  for (const a of s.aliases) byAlias.set(a.toLowerCase(), s);
}

/**
 * Normalize user input so these all mean the same symbol:
 *   USD  |  usd  |  $USD  |  /USD  |  /usd@BotName
 */
export function normalizeSymbolQuery(raw: string): string {
  let q = raw.trim();
  if (!q) return "";

  // /USD@DollarChandeBot extra → USD
  if (q.startsWith("/")) {
    q = q.slice(1);
    q = (q.split(/\s+/)[0] ?? "").split("@")[0] ?? "";
  } else {
    // first token only: "$USD please" → $USD
    q = q.split(/\s+/)[0] ?? "";
  }

  // strip one or more leading $ (and optional spaces after $)
  q = q.replace(/^\$+\s*/u, "");
  // leftover slash forms like /$USD
  q = q.replace(/^\/+/, "");
  q = q.replace(/^\$+\s*/u, "");

  return q.trim().toLowerCase();
}

export function resolveSymbol(raw: string): SymbolDef | null {
  const q = normalizeSymbolQuery(raw);
  if (!q) return null;
  return byAlias.get(q) ?? byId.get(q.toUpperCase()) ?? null;
}

export function channelSymbols(): SymbolDef[] {
  return SYMBOLS.filter((s) => s.channelList);
}

export function allSymbolIds(): string[] {
  return SYMBOLS.map((s) => s.id);
}
