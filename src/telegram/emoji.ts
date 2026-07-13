/**
 * Emoji helpers for rich cards.
 *
 * Premium custom emoji: set IDs below (from @RawDataBot / getCustomEmojiStickers)
 * or pass via env later. HTML:
 *   <tg-emoji emoji-id="ID">fallback</tg-emoji>
 */

/** Keys we use in the symbol card — provide premium IDs for these. */
export type EmojiSlot =
  | "up" // last tick / 24h up
  | "down" // last tick / 24h down
  | "flat" // no change
  | "chart" // chart caption
  | "buy"
  | "sell"
  | "high" // day high
  | "low" // day low
  | "price" // mid / spot marker
  | "clock" // datetime row
  | "channel"
  | "sparkle"; // free market / polish

/** Unicode fallbacks (used until you paste premium IDs). */
export const EMOJI_FALLBACK: Record<EmojiSlot, string> = {
  up: "📈",
  down: "📉",
  flat: "➖",
  chart: "📊",
  buy: "🟢",
  sell: "🔴",
  high: "🔺",
  low: "🔻",
  price: "💵",
  clock: "⏰",
  channel: "📣",
  sparkle: "✨",
};

/**
 * Premium custom emoji IDs (document IDs from Telegram).
 * clock + channel still use unicode until provided.
 */
export const CUSTOM_EMOJI_IDS: Partial<Record<EmojiSlot, string>> = {
  up: "5429651785352501917",
  down: "5429518319243775957",
  chart: "5203993413346680064",
  flat: "5231265631042548053",
  buy: "5215522595922779944",
  sell: "6044112265102235520",
  high: "5282735423901146555",
  low: "5416090563554320480",
  price: "5255981634527704754",
  sparkle: "5472164874886846699",
  clock: "5368295871131695793",
  channel: "5839406384243807787",
};

/** Render emoji — premium custom if ID set, else unicode. */
export function em(slot: EmojiSlot): string {
  const fallback = EMOJI_FALLBACK[slot];
  const id = CUSTOM_EMOJI_IDS[slot];
  if (id) return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
  return fallback;
}

/** List for the human: which custom emoji IDs to collect. */
export const CUSTOM_EMOJI_WISHLIST: Array<{ slot: EmojiSlot; meaning: string; fallback: string }> = [
  { slot: "up", meaning: "Price up / green arrow / rocket", fallback: EMOJI_FALLBACK.up },
  { slot: "down", meaning: "Price down / red arrow", fallback: EMOJI_FALLBACK.down },
  { slot: "flat", meaning: "No change / neutral dash", fallback: EMOJI_FALLBACK.flat },
  { slot: "chart", meaning: "Chart / candlestick / pulse line", fallback: EMOJI_FALLBACK.chart },
  { slot: "buy", meaning: "Buy side (green pill / cart in)", fallback: EMOJI_FALLBACK.buy },
  { slot: "sell", meaning: "Sell side (red pill / cart out)", fallback: EMOJI_FALLBACK.sell },
  { slot: "high", meaning: "Day high / peak", fallback: EMOJI_FALLBACK.high },
  { slot: "low", meaning: "Day low / trough", fallback: EMOJI_FALLBACK.low },
  { slot: "price", meaning: "Spot / mid price / cash", fallback: EMOJI_FALLBACK.price },
  { slot: "clock", meaning: "Updated at / live clock", fallback: EMOJI_FALLBACK.clock },
  { slot: "channel", meaning: "Channel / megaphone / broadcast", fallback: EMOJI_FALLBACK.channel },
  { slot: "sparkle", meaning: "Free market badge / sparkle", fallback: EMOJI_FALLBACK.sparkle },
];
