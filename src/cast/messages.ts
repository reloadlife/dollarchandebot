import type { Env } from "../env";
import { getAllLatest, getLatest, getOhlcDays, getTicks24h, type LatestRow } from "../db/prices";
import { listExchanges, type ExchangeRow } from "../db/exchanges";
// getOhlcDays used for 7d charts
import { resolveSymbol, type SymbolDef } from "../symbols";
import {
  escapeHtml,
  formatDelta,
  formatDeltaQuiet,
  formatJalaliTehran,
  formatPrice,
  formatTimeTehran,
} from "../lib/format";
import { calcCoinBubble, COIN_SPECS } from "../lib/coin-bubble";
import { renderLineChartPng } from "../lib/chart";
import { compactTable, type TableCell } from "../lib/rich-table";
import { pinChatMessage, sendMessage, sendPhoto, sendRichMessage, editRichMessage } from "../telegram/api";
import { em } from "../telegram/emoji";

function unit(env: Env): string {
  return env.PRICE_UNIT || "Toman";
}

/** Channel FX board — Farsi names (USDT lives in its own section). */
const FX_TICKER: Array<{ id: string; label: string }> = [
  { id: "USD", label: "دلار" },
  { id: "EUR", label: "یورو" },
  { id: "GBP", label: "پوند" },
  { id: "CHF", label: "فرانک" },
  { id: "CAD", label: "دلار کانادا" },
  { id: "TRY", label: "لیر" },
  { id: "KWD", label: "دینار کویت" },
  { id: "BHD", label: "دینار بحرین" },
];

const GOLD_IDS = ["MITHQAL", "GOLD18"] as const;
const GOLD_LABEL: Record<string, string> = {
  MITHQAL: "مثقال",
  GOLD18: "گرم ۱۸",
};
const COIN_IDS = ["EMAMI", "AZADI", "HALF", "QUARTER", "GERAMI"] as const;
const COIN_LABEL: Record<string, string> = {
  EMAMI: "امامی",
  AZADI: "آزادی",
  HALF: "نیم",
  QUARTER: "ربع",
  GERAMI: "گرمی",
};

/** USDT in Toman should sit roughly here; drop broken scrapes (e.g. 10× rial). */
function saneUsdtToman(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n >= 50_000 && n <= 500_000;
}

function marketMood(map: Map<string, LatestRow>): { emoji: string; label: string; sub: string } {
  const goldMoves: Array<"up" | "down"> = [];
  for (const id of GOLD_IDS) {
    const r = map.get(id);
    if (!r || r.prev_price == null || r.prev_price === 0 || r.price === r.prev_price) continue;
    goldMoves.push(r.price > r.prev_price ? "up" : "down");
  }
  const ups = goldMoves.filter((m) => m === "up").length;
  const downs = goldMoves.filter((m) => m === "down").length;

  if (ups && !downs) {
    return { emoji: "🟢", label: "کمی مثبت", sub: "طلا کمی سبز · بقیه آرام" };
  }
  if (downs && !ups) {
    return { emoji: "🟡", label: "آرام", sub: "بیشتر نمادها بدون تغییر · طلا کمی قرمز" };
  }
  if (ups && downs) {
    return { emoji: "🟡", label: "آرام", sub: "بازار متعادل" };
  }
  return { emoji: "🟡", label: "آرام", sub: "بیشتر نمادها بدون تغییر" };
}

/** Channel deltas use the same premium emoji as the private cards. */
function premiumDelta(delta: string | null): string {
  if (!delta) return "—";
  return delta.replaceAll("📈", em("up")).replaceAll("📉", em("down"));
}

function head(labels: string[]): TableCell[] {
  return labels.map((label, i) => ({
    text: escapeHtml(label),
    header: true,
    align: i === 0 ? "left" : "right",
  }));
}

function quoteRow(
  label: string,
  price: number | undefined,
  prev?: number | null,
): TableCell[] {
  const delta = price != null ? formatDeltaQuiet(price, prev) : null;
  return [
    { text: escapeHtml(label) },
    {
      text: price != null ? formatPrice(price) : "—",
      align: "right",
      bold: price != null,
    },
    { text: premiumDelta(delta), align: "right" },
  ];
}

/** Signed spread / bubble, e.g. +850 or −50 */
function formatSignedSpread(n: number): string {
  const abs = formatPrice(Math.abs(n));
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return "0";
}

/** Compact bubble tag: حباب +12.3M (+7.5%) */
function formatBubbleTag(bubble: number, pct: number): string {
  const sign = bubble > 0 ? "+" : bubble < 0 ? "−" : "";
  const abs = Math.abs(bubble);
  // shorten millions for channel scan
  let amount: string;
  if (abs >= 1_000_000) {
    amount = `${(abs / 1_000_000).toFixed(1)}M`;
  } else if (abs >= 1_000) {
    amount = `${formatPrice(abs / 1_000)}k`;
  } else {
    amount = formatPrice(abs);
  }
  const pctStr = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  return `حباب ${sign}${amount} (${pctStr})`;
}

function coinTable(map: Map<string, LatestRow>): { html: string; note: string } {
  const gold18 = map.get("GOLD18")?.price;
  const note =
    gold18 == null ? "<p><i>گرم ۱۸ در دسترس نیست — حباب محاسبه نشد</i></p>" : "";
  const rows = COIN_IDS.map((id) => {
    const row = map.get(id);
    const base = quoteRow(COIN_LABEL[id] ?? id, row?.price, row?.prev_price);
    const spec = COIN_SPECS[id];
    let bubble = "—";
    if (row && spec && gold18 != null && gold18 > 0) {
      const b = calcCoinBubble(row.price, gold18, spec);
      bubble = formatBubbleTag(b.bubble, b.bubblePct);
    }
    return [...base, { text: escapeHtml(bubble), align: "right" as const }];
  });
  return {
    note,
    html: compactTable([head(["سکه", "قیمت", "تغییر", "حباب"]), ...rows]),
  };
}

type ExMid = ExchangeRow & { midN: number; buyN: number | null; sellN: number | null };

function normalizeExchanges(exchanges: ExchangeRow[]): ExMid[] {
  return exchanges
    .map((e) => {
      const buyN = saneUsdtToman(e.buy) ? e.buy! : null;
      const sellN = saneUsdtToman(e.sell) ? e.sell! : null;
      let midN: number | null = saneUsdtToman(e.mid) ? e.mid! : null;
      if (midN == null && buyN != null && sellN != null) midN = Math.round((buyN + sellN) / 2);
      if (midN == null) midN = buyN ?? sellN;
      return { ...e, midN, buyN, sellN };
    })
    .filter((e): e is ExMid => saneUsdtToman(e.midN));
}

/** Older than this and the tether quote is history, not a price. */
const USDT_STALE_SEC = 30 * 60;

function pairCell(name: string, price: number): TableCell {
  return { text: `${escapeHtml(name)} · ${formatPrice(price)}`, align: "right", bold: true };
}

/**
 * تتر on the channel: price, gap versus دلار, where to buy and sell.
 * The full venue book stays collapsed so the pinned post stays scannable.
 */
export function renderUsdtSection(
  usdtMid: number | undefined,
  usdMid: number | undefined,
  exchanges: ExchangeRow[],
  usdtAgeSec = 0,
): string {
  const stale = usdtAgeSec > USDT_STALE_SEC;
  const summary: TableCell[][] = [];

  if (usdtMid != null) {
    const age = stale ? ` <i>قدیمی · ${Math.round(usdtAgeSec / 60)} دقیقه</i>` : "";
    summary.push([
      { text: "قیمت" },
      { text: `${formatPrice(usdtMid)}${age}`, align: "right", bold: !stale },
    ]);
  } else {
    summary.push([{ text: "قیمت" }, { text: "—", align: "right" }]);
  }

  // A stale tether quote must not be compared with a live dollar.
  if (usdtMid != null && usdMid != null && !stale) {
    const diff = usdtMid - usdMid;
    const hint = diff > 0 ? "گران‌تر" : diff < 0 ? "ارزان‌تر" : "هم‌قیمت";
    summary.push([
      { text: "اختلاف با دلار" },
      { text: `${formatSignedSpread(diff)} · ${hint}`, align: "right", bold: true },
    ]);
  }

  const live = normalizeExchanges(exchanges);
  const buyers = live.filter((e) => e.buyN != null);
  const sellers = live.filter((e) => e.sellN != null);
  const cheapBuy = buyers.length
    ? buyers.reduce((a, b) => (b.buyN! < a.buyN! ? b : a))
    : null;
  const bestSell = sellers.length
    ? sellers.reduce((a, b) => (b.sellN! > a.sellN! ? b : a))
    : null;

  if (cheapBuy?.buyN != null) {
    summary.push([{ text: "ارزان‌ترین خرید" }, pairCell(cheapBuy.name, cheapBuy.buyN)]);
  }
  if (bestSell?.sellN != null) {
    summary.push([{ text: "بهترین فروش" }, pairCell(bestSell.name, bestSell.sellN)]);
  }

  const bookRows = [...live].sort((a, b) => (a.buyN ?? 1e18) - (b.buyN ?? 1e18));
  const book = bookRows.length
    ? `<details><summary>خرید و فروش</summary>${compactTable([
        head(["صرافی", "خرید", "فروش"]),
        ...bookRows.map((e) => [
          { text: escapeHtml(e.name) },
          { text: e.buyN != null ? formatPrice(e.buyN) : "—", align: "right" as const },
          { text: e.sellN != null ? formatPrice(e.sellN) : "—", align: "right" as const },
        ]),
      ])}</details>`
    : "";

  return [`<h3>${em("price")} تتر</h3>`, compactTable(summary), book].filter(Boolean).join("\n");
}

/**
 * Channel list · hybrid v2 (FA)
 * Jalali + FX (fa) + طلا/سکه + تتر block + mood + footer
 */
export async function buildPriceListHtml(env: Env): Promise<string> {
  const [rows, exchanges] = await Promise.all([
    getAllLatest(env.DB),
    listExchanges(env.DB).catch(() => [] as ExchangeRow[]),
  ]);
  const map = new Map(rows.map((r) => [r.symbol, r]));
  const newest = rows.reduce((m, r) => Math.max(m, r.updated_at), 0);
  const ts = newest || Math.floor(Date.now() / 1000);
  const mood = marketMood(map);

  const fxHead = head(["ارز", "قیمت", "تغییر"]);
  const fxOpen = FX_TICKER.filter((x) => x.id === "USD" || x.id === "EUR");
  const fxMore = FX_TICKER.filter((x) => x.id !== "USD" && x.id !== "EUR");
  const fxRow = ({ id, label }: { id: string; label: string }) => {
    const row = map.get(id);
    return quoteRow(label, row?.price, row?.prev_price);
  };
  const fxTable = compactTable([fxHead, ...fxOpen.map(fxRow)]);
  const fxRest = `<details><summary>بقیه ارزها</summary>${compactTable([
    fxHead,
    ...fxMore.map(fxRow),
  ])}</details>`;
  const goldTable = compactTable([
    head(["طلا", "قیمت", "تغییر"]),
    ...GOLD_IDS.map((id) => {
      const row = map.get(id);
      return quoteRow(GOLD_LABEL[id] ?? id, row?.price, row?.prev_price);
    }),
  ]);
  const coins = coinTable(map);

  const usd = map.get("USD")?.price;
  const usdtRow = map.get("USDT");
  const usdt = usdtRow?.price;
  const usdtAgeSec = usdtRow ? Math.max(0, Math.floor(Date.now() / 1000) - usdtRow.updated_at) : 0;

  const out: string[] = [
    `<h2>نرخ بازار آزاد</h2>`,
    `<p>${em("clock")} ${escapeHtml(formatJalaliTehran(ts))} · تومان</p>`,
    `<h3>${em("price")} ارز</h3>`,
    fxTable,
    fxRest,
    `<h3>${em("high")} طلا</h3>`,
    goldTable,
    `<h3>${em("sparkle")} سکه</h3>`,
    coins.note,
    coins.html,
    renderUsdtSection(usdt, usd, exchanges, usdtAgeSec),
    `<p>${mood.emoji === "🟢" ? em("up") : em("flat")} <b>${escapeHtml(mood.label)}</b></p>`,
    `<p><i>${escapeHtml(mood.sub)}</i></p>`,
    channelActionRow(env.BOT_USERNAME),
    `<p>${em("channel")} @${escapeHtml(env.BOT_USERNAME)} · @${escapeHtml(env.CHANNEL_USERNAME)}</p>`,
  ];

  return out.filter(Boolean).join("\n");
}

/** Rich tags stripped, for clients or a failed rich send. */
function htmlToPlain(html: string): string {
  return html
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]{2,}/g, "  ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Channel posts should not ding subscribers. */
const CHANNEL_SILENT = { disable_notification: true } as const;
/** Message id of the single pinned price list. */
const KV_LIST_MSG = "cast:list_msg_id";

/** Opens the bot on a symbol. Works from a channel, where callbacks do not. */
export function channelActionRow(bot: string): string {
  const button = (id: string, label: string) =>
    `<tg-button type="url" url="https://t.me/${escapeHtml(bot)}?start=${id}">${label}</tg-button>`;
  return `<tg-button-row>${button("USD", "دلار")}${button("USDT", "تتر")}${button("GOLD18", "طلا")}${button("EMAMI", "سکه")}</tg-button-row>`;
}

export async function castPriceList(env: Env): Promise<void> {
  if (!env.TELEGRAM_CHANNEL_ID) {
    throw new Error("TELEGRAM_CHANNEL_ID secret is empty — cannot cast price list");
  }
  const text = await buildPriceListHtml(env);
  const chatId = env.TELEGRAM_CHANNEL_ID;
  const existing = await env.CACHE.get(KV_LIST_MSG);
  if (existing && Number(existing) > 0) {
    try {
      await editRichMessage(env, chatId, Number(existing), text);
      return;
    } catch (e) {
      console.error("edit pinned list failed, sending a new one", e);
    }
  }
  let messageId: number;
  try {
    messageId = (await sendRichMessage(env, chatId, text, CHANNEL_SILENT)).message_id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("castPriceList rich failed, plain fallback", { chatId, err: msg });
    messageId = (await sendMessage(env, chatId, htmlToPlain(text), CHANNEL_SILENT)).message_id;
  }
  await env.CACHE.put(KV_LIST_MSG, String(messageId));
  try {
    await pinChatMessage(env, chatId, messageId);
  } catch (e) {
    console.error("pin price list failed", e);
  }
}

export async function buildSymbolCaption(
  env: Env,
  def: SymbolDef,
  row: LatestRow | null,
): Promise<string> {
  const u = unit(env);
  if (!row) {
    return `${def.emoji} <b>${escapeHtml(def.name)}</b> (<code>${def.id}</code>)\nNo data yet — wait for next scrape.`;
  }
  const delta = formatDelta(row.price, row.prev_price);
  const when = formatTimeTehran(row.updated_at);
  return [
    `${def.emoji} <b>${escapeHtml(def.name)}</b> · <code>${def.id}</code>`,
    `💵 <b>${formatPrice(row.price)}</b> ${escapeHtml(u)}`,
    `Δ ${escapeHtml(delta)}`,
    row.buy != null && row.sell != null
      ? `Buy ${formatPrice(row.buy)} · Sell ${formatPrice(row.sell)}`
      : null,
    `⏱ ${escapeHtml(when)} (Tehran) · 24h chart`,
    `📣 @${escapeHtml(env.CHANNEL_USERNAME)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function chartPngForSymbol(
  env: Env,
  def: SymbolDef,
  range: "24h" | "7d" = "24h",
): Promise<{
  png: Uint8Array;
  caption: string;
  row: LatestRow | null;
}> {
  const row = await getLatest(env.DB, def.id);
  let points: Array<{ ts: number; price: number }> = [];

  if (range === "7d") {
    const ohlc = await getOhlcDays(env.DB, def.id, 7);
    points = ohlc.map((d) => ({
      ts: Math.floor(new Date(d.day + "T12:00:00Z").getTime() / 1000),
      price: d.close,
    }));
  } else {
    points = await getTicks24h(env.DB, def.id);
  }

  if (points.length < 2 && row) {
    points = [
      { ts: row.updated_at - 300, price: row.prev_price ?? row.price },
      { ts: row.updated_at, price: row.price },
    ];
  }

  const caption = await buildSymbolCaption(env, def, row);
  const png = await renderLineChartPng(points, {
    title: `${def.id} · ${def.name}`,
    subtitle: `${range} · ${unit(env)} · DollarChande`,
  });
  return { png, caption, row };
}

export async function cast6hCharts(env: Env): Promise<void> {
  // Keep it cheap: only top symbols for 6h chart dump
  const top = ["USD", "USDT", "EUR", "GOLD18", "EMAMI"];
  for (const id of top) {
    const def = resolveSymbol(id);
    if (!def) continue;
    const { png, caption } = await chartPngForSymbol(env, def);
    await sendPhoto(
      env,
      env.TELEGRAM_CHANNEL_ID,
      png,
      `📊 <b>6-hour update</b>\n${caption}`,
      CHANNEL_SILENT,
    );
  }
}

export async function castDaily(env: Env): Promise<void> {
  const focus = ["USD", "USDT", "EUR", "GOLD18", "EMAMI"];
  const u = unit(env);
  const ohlcLines: string[] = [`📅 <b>Daily OHLC</b> · ${escapeHtml(u)}`, ""];

  for (const id of focus) {
    const def = resolveSymbol(id);
    if (!def) continue;
    const days = await getOhlcDays(env.DB, def.id, 1);
    const d = days[days.length - 1];
    if (!d) {
      ohlcLines.push(`${def.emoji} <code>${def.id}</code>: no bar yet`);
      continue;
    }
    ohlcLines.push(
      `${def.emoji} <b>${escapeHtml(def.name)}</b> <code>${def.id}</code> · ${escapeHtml(d.day)}`,
      `   O ${formatPrice(d.open)} · H ${formatPrice(d.high)} · L ${formatPrice(d.low)} · C ${formatPrice(d.close)}`,
    );

    const { png, caption } = await chartPngForSymbol(env, def);
    await sendPhoto(
      env,
      env.TELEGRAM_CHANNEL_ID,
      png,
      `🗓 <b>Daily chart</b>\n${caption}`,
      CHANNEL_SILENT,
    );
  }

  ohlcLines.push("", `📣 @${escapeHtml(env.CHANNEL_USERNAME)}`);
  await sendMessage(env, env.TELEGRAM_CHANNEL_ID, ohlcLines.join("\n"), CHANNEL_SILENT);
}
