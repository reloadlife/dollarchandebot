import type { Env } from "../env";
import { getAllLatest, getLatest, getOhlcDays, getTicks24h, type LatestRow } from "../db/prices";
import { listExchanges, type ExchangeRow } from "../db/exchanges";
// getOhlcDays used for 7d charts
import { resolveSymbol, type SymbolDef } from "../symbols";
import {
  escapeHtml,
  formatDelta,
  formatJalaliTehran,
  formatPrice,
  formatTimeTehran,
} from "../lib/format";
import { calcCoinBubble, COIN_SPECS } from "../lib/coin-bubble";
import { renderLineChartPng } from "../lib/chart";
import { compactTable, type TableCell } from "../lib/rich-table";
import { sendMessage, sendPhoto, sendRichMessage } from "../telegram/api";
import { em } from "../telegram/emoji";

function unit(env: Env): string {
  return env.PRICE_UNIT || "Toman";
}

/** Currencies kept behind «بقیه ارزها». دلار and یورو are on the board. */
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

function head(labels: string[]): TableCell[] {
  return labels.map((label, i) => ({
    text: escapeHtml(label),
    header: true,
    align: i === 0 ? "left" : "right",
  }));
}

/** One narrow column: +0.4% or —, no icon and no absolute move. */
function pctCell(price: number | undefined, prev?: number | null): string {
  if (price == null || prev == null || prev === 0 || price === prev) return "—";
  const pct = ((price - prev) / prev) * 100;
  const sign = pct > 0 ? "+" : "−";
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

function boardRow(label: string, price: number | undefined, prev?: number | null): TableCell[] {
  return [
    { text: escapeHtml(label) },
    {
      text: price != null ? formatPrice(price) : "—",
      align: "right",
      bold: price != null,
    },
    { text: pctCell(price, prev), align: "right" },
  ];
}

function bubblePct(id: string, price: number | undefined, gold18: number | undefined): string {
  const spec = COIN_SPECS[id];
  if (price == null || !spec || gold18 == null || gold18 <= 0) return "—";
  const pct = calcCoinBubble(price, gold18, spec).bubblePct;
  if (pct === 0) return "0%";
  const sign = pct > 0 ? "+" : "−";
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

/** Signed spread, e.g. +850 or −50 */
function formatSignedSpread(n: number): string {
  const abs = formatPrice(Math.abs(n));
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return "0";
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

/**
 * تتر under the board: gap versus دلار, then the best buy and sell.
 * The venue book stays collapsed. A stale quote is not compared with دلار.
 */
export function renderUsdtSection(
  usdtMid: number | undefined,
  usdMid: number | undefined,
  exchanges: ExchangeRow[],
  usdtAgeSec = 0,
): string {
  const stale = usdtAgeSec > USDT_STALE_SEC;
  const parts: string[] = [];

  if (stale && usdtMid != null) {
    parts.push(`<p><i>تتر قدیمی · ${Math.round(usdtAgeSec / 60)} دقیقه</i></p>`);
  } else if (usdtMid != null && usdMid != null) {
    const diff = usdtMid - usdMid;
    const hint = diff > 0 ? "گران‌تر از دلار" : diff < 0 ? "ارزان‌تر از دلار" : "هم‌قیمت با دلار";
    parts.push(`<p>${diff === 0 ? hint : `${formatSignedSpread(diff)} · ${hint}`}</p>`);
  }

  const live = normalizeExchanges(exchanges);
  const buyers = live.filter((e) => e.buyN != null);
  const sellers = live.filter((e) => e.sellN != null);
  const cheapBuy = buyers.length ? buyers.reduce((a, b) => (b.buyN! < a.buyN! ? b : a)) : null;
  const bestSell = sellers.length ? sellers.reduce((a, b) => (b.sellN! > a.sellN! ? b : a)) : null;
  const ends: string[] = [];
  if (cheapBuy?.buyN != null) ends.push(`خرید ${escapeHtml(cheapBuy.name)} · ${formatPrice(cheapBuy.buyN)}`);
  if (bestSell?.sellN != null) ends.push(`فروش ${escapeHtml(bestSell.name)} · ${formatPrice(bestSell.sellN)}`);
  if (ends.length) parts.push(`<p>${ends.join(" · ")}</p>`);

  const bookRows = [...live].sort((a, b) => (a.buyN ?? 1e18) - (b.buyN ?? 1e18));
  if (bookRows.length) {
    parts.push(
      `<details><summary>خرید و فروش</summary>${compactTable([
        head(["صرافی", "خرید", "فروش"]),
        ...bookRows.map((e) => [
          { text: escapeHtml(e.name) },
          { text: e.buyN != null ? formatPrice(e.buyN) : "—", align: "right" as const },
          { text: e.sellN != null ? formatPrice(e.sellN) : "—", align: "right" as const },
        ]),
      ])}</details>`,
    );
  }

  return parts.join("\n");
}

const BOARD: Array<{ id: string; label: string }> = [
  { id: "USD", label: "دلار" },
  { id: "EUR", label: "یورو" },
  { id: "USDT", label: "تتر" },
  { id: "MITHQAL", label: "مثقال" },
  { id: "GOLD18", label: "گرم ۱۸" },
  { id: "EMAMI", label: "امامی" },
];

/**
 * One channel board: six prices, the rest tucked away, tether as a line.
 */
export async function buildPriceListHtml(env: Env): Promise<string> {
  const [rows, exchanges] = await Promise.all([
    getAllLatest(env.DB),
    listExchanges(env.DB).catch(() => [] as ExchangeRow[]),
  ]);
  const map = new Map(rows.map((r) => [r.symbol, r]));
  const newest = rows.reduce((m, r) => Math.max(m, r.updated_at), 0);
  const ts = newest || Math.floor(Date.now() / 1000);
  const named = (id: string, label: string) => {
    const row = map.get(id);
    return boardRow(label, row?.price, row?.prev_price);
  };

  const board = compactTable([
    head(["نماد", "قیمت", "تغییر"]),
    ...BOARD.map(({ id, label }) => named(id, label)),
  ]);
  const fxMore = FX_TICKER.filter((item) => item.id !== "USD" && item.id !== "EUR");
  const fxRest = `<details><summary>بقیه ارزها</summary>${compactTable([
    head(["ارز", "قیمت", "تغییر"]),
    ...fxMore.map(({ id, label }) => named(id, label)),
  ])}</details>`;

  const gold18 = map.get("GOLD18")?.price;
  const moreCoins = COIN_IDS.filter((id) => id !== "EMAMI");
  const coinRest = `<details><summary>بقیه سکه‌ها</summary>${compactTable([
    head(["سکه", "قیمت", "تغییر", "حباب"]),
    ...moreCoins.map((id) => {
      const row = map.get(id);
      return [
        ...named(id, COIN_LABEL[id] ?? id),
        { text: bubblePct(id, row?.price, gold18), align: "right" as const },
      ];
    }),
  ])}</details>`;

  const usd = map.get("USD")?.price;
  const usdtRow = map.get("USDT");
  const usdtAgeSec = usdtRow ? Math.max(0, Math.floor(Date.now() / 1000) - usdtRow.updated_at) : 0;

  return [
    `<h2>نرخ بازار آزاد</h2>`,
    `<p>${escapeHtml(formatJalaliTehran(ts))} · تومان</p>`,
    board,
    fxRest,
    coinRest,
    renderUsdtSection(usdtRow?.price, usd, exchanges, usdtAgeSec),
    channelActionRow(env.BOT_USERNAME),
  ]
    .filter(Boolean)
    .join("\n");
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

/** Opens the bot on a symbol. Works from a channel, where callbacks do not. */
export function channelActionRow(bot: string): string {
  const button = (id: string, slot: Parameters<typeof em>[0], label: string) =>
    `<tg-button type="url" url="https://t.me/${escapeHtml(bot)}?start=${id}">${em(slot)} ${label}</tg-button>`;
  return `<tg-button-row>${button("USD", "price", "دلار")}${button("USDT", "buy", "تتر")}${button("GOLD18", "high", "طلا")}${button("EMAMI", "sparkle", "سکه")}</tg-button-row>`;
}

export async function castPriceList(env: Env): Promise<void> {
  if (!env.TELEGRAM_CHANNEL_ID) {
    throw new Error("TELEGRAM_CHANNEL_ID secret is empty — cannot cast price list");
  }
  const text = await buildPriceListHtml(env);
  const chatId = env.TELEGRAM_CHANNEL_ID;
  try {
    await sendRichMessage(env, chatId, text, CHANNEL_SILENT);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("castPriceList rich failed, plain fallback", { chatId, err: msg });
    await sendMessage(env, chatId, htmlToPlain(text), CHANNEL_SILENT);
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
