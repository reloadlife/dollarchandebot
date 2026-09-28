/**
 * Rich message HTML (Bot API sendRichMessage).
 * Private chats, the channel list, inline results, and guest replies share it.
 */

import type { Env } from "../env";
import type { SymbolDef } from "../symbols";
import { SYMBOLS } from "../symbols";
import type { LatestRow } from "../db/prices";
import type { CalcResult } from "../lib/calc";
import type { Lang } from "../db/settings";
import type { ChartRange } from "../chart/serve";
import { escapeHtml, formatDelta, formatDeltaQuiet, formatPrice, formatTimeTehran } from "../lib/format";
import { t } from "../lib/i18n";
import { compactTable, type TableCell } from "../lib/rich-table";

function cell(label: string): TableCell {
  return { text: escapeHtml(label) };
}

function numCell(n: number): TableCell {
  return { text: formatPrice(n), align: "right", bold: true };
}

/** In-message actions. Inline cards use a link, because that chat has no callback target. */
function cardActionRow(
  env: Env,
  lang: Lang,
  symbolId: string,
  range: ChartRange,
  price: number | null,
  mode: "chat" | "link",
): string {
  if (mode === "link") {
    const url = `https://t.me/${env.BOT_USERNAME}?start=${symbolId}`;
    return `<tg-button-row><tg-button type="url" url="${escapeHtml(url)}">${escapeHtml(t(lang, "uiOpen"))}</tg-button></tg-button-row>`;
  }
  const style = (on: boolean) => (on ? ` style="primary"` : "");
  const copy =
    price != null
      ? `<tg-button type="copy_text" text="${Math.round(price)}">${escapeHtml(t(lang, "uiCopy"))}</tg-button>`
      : "";
  return `<tg-button-row>
<tg-button type="callback_data"${style(range === "24h")} data="s:${symbolId}:24h">24h</tg-button>
<tg-button type="callback_data"${style(range === "7d")} data="s:${symbolId}:7d">7d</tg-button>
<tg-button type="callback_data" data="s:${symbolId}:hi">${escapeHtml(t(lang, "uiHistory"))}</tg-button>
<tg-button type="callback_data" data="a:new:${symbolId}">${escapeHtml(t(lang, "uiAlertNew"))}</tg-button>
${copy}
</tg-button-row>`;
}
import { em } from "./emoji";

function channelUrl(env: Env): string {
  return `https://t.me/${env.CHANNEL_USERNAME}`;
}

function botAt(env: Env): string {
  return `@${escapeHtml(env.BOT_USERNAME)}`;
}

/** Format amount for calc lines (no locale commas for whole integers optional). */
function fmtAmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toPrecision(12)));
}

const HOME_QUOTES: Array<{ id: string; key: "homeUsd" | "homeUsdt" | "homeGold" | "homeCoin" }> = [
  { id: "USD", key: "homeUsd" },
  { id: "USDT", key: "homeUsdt" },
  { id: "GOLD18", key: "homeGold" },
  { id: "EMAMI", key: "homeCoin" },
];

/** Home is the four prices people open the bot for. */
export function richHome(
  env: Env,
  lang: Lang,
  quotes: Map<string, { price: number; prev_price: number | null }>,
): string {
  const unit = escapeHtml(t(lang, "cardUnit"));
  const table = compactTable([
    [
      { text: "", header: true },
      { text: unit, header: true, align: "right" },
      { text: escapeHtml(t(lang, "cardTick")), header: true, align: "right" },
    ],
    ...HOME_QUOTES.map(({ id, key }) => {
      const row = quotes.get(id);
      const delta = row ? formatDeltaQuiet(row.price, row.prev_price) : null;
      return [
        { text: escapeHtml(t(lang, key)) },
        { text: row ? formatPrice(row.price) : "—", align: "right" as const, bold: true },
        { text: escapeHtml(delta ?? "—"), align: "right" as const },
      ];
    }),
  ]);
  return `
<h2>Dollar Chande</h2>
${table}
<p>${t(lang, "homeHint")}</p>
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richHelp(env: Env, lang: Lang = "en"): string {
  if (lang === "fa") {
    return `
<h2>راهنما</h2>
<p>${t(lang, "helpLead")}</p>
<details>
<summary>${escapeHtml(t(lang, "helpMore"))}</summary>

<h3>قیمت و منو</h3>
<ul>
<li><code>/start</code> — خانه (دکمه‌ها)</li>
<li><code>USD</code> / <code>$USDT</code> — کارت + نمودار ۲۴س</li>
<li><code>USD 7d</code> یا <code>/7d USD</code> — نمودار ۷روزه</li>
<li><code>/symbols</code> — مرور دسته‌ای · <code>/symbols all</code> لیست متنی</li>
<li><code>USD USDT EUR</code> — چند نماد یک‌جا</li>
<li><code>/compare USD USDT</code> — اختلاف</li>
<li><code>/exchanges</code> — خرید/فروش تتر در صرافی‌ها</li>
<li><code>/history USD</code> · <code>/ohlc USD</code></li>
</ul>

<h3>ماشین‌حساب</h3>
<ul>
<li><code>10.5 USDT + 10%</code></li>
<li><code>(10 USDT + 5 EUR) * 1.1</code></li>
<li><code>50000000 in USDT</code> — تومان → دارایی</li>
<li><code>/fee 2</code> — کارمزد پیش‌فرض</li>
</ul>

<h3>هشدار قیمت</h3>
<p><b>یک‌بار</b> (پیش‌فرض) — یک اعلان، بعد حذف می‌شود.</p>
<p><b>تکراری</b> (<code>every</code>) — دوباره فقط بعد از برگشت قیمت از آستانه.</p>
<ul>
<li><code>/alert USD above 180000</code> — یک‌بار، وقتی ≥ آستانه</li>
<li><code>/alert USD below 170000</code> — یک‌بار، وقتی ≤ آستانه</li>
<li><code>/alert USD above 180000 every</code> — تکراری (بدون اسپم)</li>
<li><code>/alert USDT move 2</code> — یک‌بار، حرکت ≥٪۲</li>
<li><code>/alert USDT move 2 every</code> — هر بار حرکت ≥٪۲ از آخرین اعلان</li>
<li><code>/alerts</code> — لیست · <code>/unalert 3</code> — حذف</li>
</ul>
<p><i>حداکثر ۱۰ هشدار · کلیدواژه‌های تکراری: every / repeat / multi</i></p>

<h3>تنظیمات</h3>
<ul>
<li><code>/lang fa</code> · <code>/lang en</code></li>
<li><code>/settings</code> — زبان و کارمزد</li>
</ul>

<h3>بیشتر</h3>
<ul>
<li>اینلاین: <code>${botAt(env)} USD</code></li>
<li>مهمان: <code>${botAt(env)} 10 USDT + 5 EUR</code></li>
<li>منوی / پایین چت را هم ببین</li>
</ul>

</details>
<p>⏱ به‌روزرسانی ~۵ دقیقه · ${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
  }

  return `
<h2>Help</h2>
<p>${t(lang, "helpLead")}</p>
<details>
<summary>${escapeHtml(t(lang, "helpMore"))}</summary>

<h3>Prices &amp; menu</h3>
<ul>
<li><code>/start</code> — home (buttons)</li>
<li><code>USD</code> / <code>$USDT</code> — card + 24h chart</li>
<li><code>USD 7d</code> or <code>/7d USD</code> — 7-day chart</li>
<li><code>/symbols</code> — browse by category · <code>/symbols all</code> text list</li>
<li><code>USD USDT EUR</code> — multi snapshot</li>
<li><code>/compare USD USDT</code> — spread</li>
<li><code>/exchanges</code> — USDT buy/sell by exchange</li>
<li><code>/history USD</code> · <code>/ohlc USD</code></li>
</ul>

<h3>Calculator</h3>
<ul>
<li><code>10.5 USDT + 10%</code></li>
<li><code>(10 USDT + 5 EUR) * 1.1</code></li>
<li><code>50000000 in USDT</code> — Toman → asset</li>
<li><code>/fee 2</code> — default fee for calc</li>
</ul>

<h3>Price alerts</h3>
<p><b>once</b> (default) — notify once, then the alert is removed.</p>
<p><b>every</b> — can fire again only after the price clears the threshold (no spam while it stays past the line).</p>
<ul>
<li><code>/alert USD above 180000</code> — once, when ≥ threshold</li>
<li><code>/alert USD below 170000</code> — once, when ≤ threshold</li>
<li><code>/alert USD above 180000 every</code> — repeat after clear</li>
<li><code>/alert USDT move 2</code> — once, on ≥2% move</li>
<li><code>/alert USDT move 2 every</code> — each new ≥2% leg from last fire</li>
<li><code>/alerts</code> — list · <code>/unalert 3</code> — delete</li>
</ul>
<p><i>Max 10 alerts · repeat keywords: every / repeat / multi</i></p>

<h3>Settings</h3>
<ul>
<li><code>/lang en</code> · <code>/lang fa</code></li>
<li><code>/settings</code> — language &amp; fee</li>
</ul>

<h3>Also</h3>
<ul>
<li>Inline: <code>${botAt(env)} USD</code></li>
<li>Guest: <code>${botAt(env)} 10 USDT + 5 EUR</code></li>
<li>Open the <b>/</b> menu for commands</li>
</ul>

</details>
<p>⏱ ~5 min refresh · ${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richSymbols(lang: Lang = "en"): string {
  const order: Array<"fx" | "crypto" | "gold" | "coin"> = ["fx", "crypto", "gold", "coin"];
  const labelsEn: Record<string, string> = {
    fx: "💱 Currencies",
    crypto: "💰 Crypto",
    gold: "🥇 Gold",
    coin: "🪙 Coins",
  };
  const labelsFa: Record<string, string> = {
    fx: "💱 ارزها",
    crypto: "💰 کریپتو",
    gold: "🥇 طلا",
    coin: "🪙 سکه",
  };
  const labels = lang === "fa" ? labelsFa : labelsEn;

  const parts: string[] = [
    lang === "fa" ? `<h2>📋 لیست نمادها</h2>` : `<h2>📋 Symbol list</h2>`,
    lang === "fa"
      ? `<p><i>کد را بفرست تا قیمت + نمودار ۲۴س بیاد.</i></p>`
      : `<p><i>Send a code for price + 24h chart.</i></p>`,
  ];

  for (const kind of order) {
    const group = SYMBOLS.filter((s) => s.kind === kind);
    if (!group.length) continue;
    parts.push(`<h3>${labels[kind]}</h3>`);
    parts.push("<ul>");
    for (const s of group) {
      parts.push(
        `<li>${s.emoji} <code>${s.id}</code> — ${escapeHtml(s.name)}</li>`,
      );
    }
    parts.push("</ul>");
  }

  parts.push(
    lang === "fa"
      ? `<p>پیشنهاد: اول <code>USD</code> یا <code>USDT</code> را امتحان کن.</p>`
      : `<p>Tip: try <code>USD</code> or <code>USDT</code> first.</p>`,
  );
  return parts.join("\n");
}

export function richUnknown(token: string, lang: Lang = "en"): string {
  if (lang === "fa") {
    return `
<h3>❓ نماد ناشناخته</h3>
<p><code>${escapeHtml(token)}</code></p>
<ul>
<li>امتحان کن: <code>USD</code>، <code>$USDT</code> یا <code>/EUR</code></li>
<li>یا حساب کن: <code>10 USDT + 5 EUR</code></li>
<li>لیست کامل: <code>/symbols</code> · راهنما: <code>/help</code></li>
</ul>
`.trim();
  }
  return `
<h3>❓ Unknown symbol</h3>
<p><code>${escapeHtml(token)}</code></p>
<ul>
<li>Try <code>USD</code>, <code>$USDT</code>, or <code>/EUR</code></li>
<li>Or calculate: <code>10 USDT + 5 EUR</code></li>
<li>Full list: <code>/symbols</code> · help: <code>/help</code></li>
</ul>
`.trim();
}

export function richSettings(
  env: Env,
  lang: Lang,
  feePct: number,
): string {
  if (lang === "fa") {
    return `
<h2>${em("sparkle")} تنظیمات</h2>
<p>زبان: <b>fa</b> → <code>/lang en</code></p>
<p>کارمزد پیش‌فرض: <b>${feePct}%</b> → <code>/fee 2</code></p>
<p>هشدار: <code>/alert USD above 180000</code> · <code>every</code> = تکراری</p>
<p>لیست: <code>/alerts</code> · حذف: <code>/unalert ID</code></p>
<p>تتر صرافی‌ها: <code>/exchanges</code></p>
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
  }
  return `
<h2>${em("sparkle")} Settings</h2>
<p>Language: <b>${lang}</b> → <code>/lang fa</code> · <code>/lang en</code></p>
<p>Default fee: <b>${feePct}%</b> → <code>/fee 2</code></p>
<p>Alerts: <code>/alert USD above 180000</code> · add <code>every</code> to repeat</p>
<p>List: <code>/alerts</code> · remove: <code>/unalert ID</code></p>
<p>USDT exchanges: <code>/exchanges</code></p>
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richCalcError(env: Env, error: string): string {
  return `
<p>${em("sparkle")} <b>Couldn’t parse</b></p>
<p><i>${escapeHtml(error)}</i></p>
<p>e.g. <code>10 USDT + 5 EUR</code></p>
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

function termLine(t: CalcResult["terms"][number]): string {
  if (t.kind === "percent") {
    const sign = t.sign < 0 ? "−" : "+";
    return `<p>${sign}${fmtAmt(t.percent)}% → <b>${t.sign < 0 ? "−" : ""}${formatPrice(Math.abs(t.subtotal))}</b> <i>of ${formatPrice(t.base)}</i></p>`;
  }
  if (t.kind === "fee") {
    return `<p>fee ${fmtAmt(t.percent)}% → <b>${formatPrice(t.subtotal)}</b></p>`;
  }
  const sign = t.sign < 0 ? "−" : "";
  return `<p>${sign}${fmtAmt(t.amount)} $${t.symbol.id} → <b>${formatPrice(Math.abs(t.subtotal))}</b> <i>(${formatPrice(t.unitPrice)})</i></p>`;
}

function cashExpression(result: CalcResult): string {
  if (result.invertAmount != null && result.invertSymbol) {
    return `${formatPrice(result.total)} IRT → $${result.invertSymbol}`;
  }
  return result.terms
    .map((t, i) => {
      let body: string;
      if (t.kind === "percent") body = `${fmtAmt(t.percent)}%`;
      else if (t.kind === "fee") body = `fee ${fmtAmt(t.percent)}%`;
      else body = `${fmtAmt(t.amount)} $${t.symbol.id}`;
      if (i === 0) return t.kind === "asset" && t.sign < 0 ? `−${body}` : body;
      if (t.kind === "asset") return `${t.sign < 0 ? "−" : "+"} ${body}`;
      if (t.kind === "percent") return `${t.sign < 0 ? "−" : "+"} ${body}`;
      return `+ ${body}`;
    })
    .join(" ");
}

/** Minimal calc / invert card */
export function richCalc(env: Env, result: CalcResult, nowSec = Math.floor(Date.now() / 1000)): string {
  const channel = `@${escapeHtml(env.CHANNEL_USERNAME)}`;
  const expr = cashExpression(result);
  const whenFallback = formatTimeTehran(nowSec);
  const time = `<tg-time unix="${nowSec}" format="r">${escapeHtml(whenFallback)}</tg-time>`;

  // Invert: X IRT → N USDT
  if (result.invertAmount != null && result.invertSymbol) {
    return `
<h2>${expr}</h2>
<p>${em("price")} <b>${result.invertAmount.toFixed(4)}</b> $${result.invertSymbol}</p>
<p><i>@ ${formatPrice(result.terms[0] && result.terms[0].kind === "asset" ? result.terms[0].unitPrice : 0)} IRT each</i></p>
<p>${em("clock")} ${time} · ${em("channel")} <a href="${channelUrl(env)}">${channel}</a></p>
`.trim();
  }

  if (result.terms.length === 1 && result.terms[0]!.kind === "asset") {
    const t = result.terms[0]!;
    return `
<h2>${expr}</h2>
<p>${em("price")} <b>${formatPrice(result.total)}</b> ${escapeHtml(result.unit)}</p>
<p><i>@ ${formatPrice(t.unitPrice)} each</i></p>
<p>${em("clock")} ${time} · ${em("channel")} <a href="${channelUrl(env)}">${channel}</a></p>
`.trim();
  }

  return `
<h2>${expr}</h2>
${result.terms.map(termLine).join("\n")}
<p>${em("price")} <b>${formatPrice(result.total)}</b> ${escapeHtml(result.unit)}</p>
<p>${em("clock")} ${time} · ${em("channel")} <a href="${channelUrl(env)}">${channel}</a></p>
`.trim();
}

export function richExchanges(
  env: Env,
  rows: Array<{ name: string; buy: number | null; sell: number | null; mid: number | null; updated_at: number }>,
  lang: Lang = "en",
): string {
  const withBuy = rows.filter((r) => r.buy != null);
  const withSell = rows.filter((r) => r.sell != null);
  const cheapBuy = withBuy.length
    ? withBuy.reduce((a, b) => ((b.buy ?? 0) < (a.buy ?? 0) ? b : a))
    : null;
  const bestSell = withSell.length
    ? withSell.reduce((a, b) => ((b.sell ?? 0) > (a.sell ?? 0) ? b : a))
    : null;
  const summary: TableCell[][] = [];
  if (cheapBuy?.buy != null) {
    summary.push([
      { text: escapeHtml(t(lang, "exCheapBuy")) },
      { text: `${escapeHtml(cheapBuy.name)} · ${formatPrice(cheapBuy.buy)}`, align: "right", bold: true },
    ]);
  }
  if (bestSell?.sell != null) {
    summary.push([
      { text: escapeHtml(t(lang, "exBestSell")) },
      { text: `${escapeHtml(bestSell.name)} · ${formatPrice(bestSell.sell)}`, align: "right", bold: true },
    ]);
  }
  const sorted = [...rows].sort((a, b) => (a.buy ?? 1e18) - (b.buy ?? 1e18));
  const num = (n: number | null) => (n != null ? formatPrice(n) : "—");
  const table = compactTable([
    [
      { text: escapeHtml(t(lang, "exCol")), header: true },
      { text: escapeHtml(t(lang, "cardBuy")), header: true, align: "right" },
      { text: escapeHtml(t(lang, "cardSell")), header: true, align: "right" },
    ],
    ...sorted.map((r) => [
      { text: escapeHtml(r.name) },
      { text: num(r.buy), align: "right" as const },
      { text: num(r.sell), align: "right" as const },
    ]),
  ]);
  const newest = rows.reduce((m, r) => Math.max(m, r.updated_at), 0);
  const when = newest ? formatTimeTehran(newest) : "—";
  const empty = `<p>${escapeHtml(t(lang, "exNone"))}</p>`;
  const book = sorted.length ? table : empty;
  const lead = summary.length ? compactTable(summary) : "";
  return `
<h2>${em("price")} ${escapeHtml(t(lang, "exTitle"))}</h2>
<p><i>${escapeHtml(t(lang, "exHint"))}</i></p>
${lead}
${book}
<p>${em("clock")} <tg-time unix="${newest || Math.floor(Date.now() / 1000)}" format="r">${escapeHtml(when)}</tg-time> · ${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richCompare(
  env: Env,
  a: { id: string; name: string; emoji: string; price: number },
  b: { id: string; name: string; emoji: string; price: number },
  lang: Lang = "en",
): string {
  const ratio = b.price > 0 ? a.price / b.price : 0;
  const spread = a.price - b.price;
  const spreadPct = b.price > 0 ? (spread / b.price) * 100 : 0;
  const sign = spread >= 0 ? "+" : "";
  const unit = escapeHtml(t(lang, "cardUnit"));
  const table = compactTable([
    [
      { text: `${a.emoji} $${a.id}` },
      { text: `${formatPrice(a.price)} ${unit}`, align: "right", bold: true },
    ],
    [
      { text: `${b.emoji} $${b.id}` },
      { text: `${formatPrice(b.price)} ${unit}`, align: "right", bold: true },
    ],
  ]);
  return `
<h2>${a.emoji} $${a.id} vs ${b.emoji} $${b.id}</h2>
${table}
<p>${escapeHtml(t(lang, "cmpSpread"))} <b>${sign}${formatPrice(spread)}</b> (${sign}${spreadPct.toFixed(2)}%)</p>
<p>1 $${a.id} ≈ <b>${ratio.toFixed(4)}</b> $${b.id}</p>
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richMulti(
  env: Env,
  rows: Array<{ id: string; emoji: string; price: number }>,
  lang: Lang = "en",
): string {
  const unit = escapeHtml(t(lang, "cardUnit"));
  const body = compactTable(
    rows.map((r) => [
      { text: `${r.emoji} $${r.id}` },
      { text: `${formatPrice(r.price)} ${unit}`, align: "right" as const, bold: true },
    ]),
  );
  return `
<h2>${em("sparkle")} ${escapeHtml(t(lang, "snapTitle"))}</h2>
${body}
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richHistory(
  env: Env,
  id: string,
  emoji: string,
  days: Array<{ day: string; open: number; high: number; low: number; close: number }>,
  lang: Lang = "en",
): string {
  const head = (key: "ohlcOpen" | "ohlcHigh" | "ohlcLow" | "ohlcClose"): TableCell => ({
    text: escapeHtml(t(lang, key)),
    header: true,
    align: "right",
  });
  const lines = days.length
    ? compactTable([
        [
          { text: escapeHtml(t(lang, "histTitle")), header: true },
          head("ohlcOpen"),
          head("ohlcHigh"),
          head("ohlcLow"),
          head("ohlcClose"),
        ],
        ...days.slice(-7).map((d) => [
          { text: escapeHtml(d.day) },
          { text: formatPrice(d.open), align: "right" as const },
          { text: formatPrice(d.high), align: "right" as const },
          { text: formatPrice(d.low), align: "right" as const },
          { text: formatPrice(d.close), align: "right" as const, bold: true },
        ]),
      ])
    : `<p>${escapeHtml(t(lang, "histEmpty"))}</p>`;
  return `
<h2>${emoji} $${id} ${escapeHtml(t(lang, "histTitle"))}</h2>
${lines}
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richOhlc(
  env: Env,
  id: string,
  emoji: string,
  d: { day: string; open: number; high: number; low: number; close: number } | null,
  lang: Lang = "en",
): string {
  if (!d) {
    return `<h2>${emoji} $${id}</h2><p>${escapeHtml(t(lang, "ohlcEmpty"))}</p>`;
  }
  const bar = compactTable([
    [
      { text: escapeHtml(t(lang, "ohlcOpen")) },
      { text: formatPrice(d.open), align: "right", bold: true },
    ],
    [
      { text: escapeHtml(t(lang, "ohlcHigh")) },
      { text: formatPrice(d.high), align: "right", bold: true },
    ],
    [
      { text: escapeHtml(t(lang, "ohlcLow")) },
      { text: formatPrice(d.low), align: "right", bold: true },
    ],
    [
      { text: escapeHtml(t(lang, "ohlcClose")) },
      { text: formatPrice(d.close), align: "right", bold: true },
    ],
  ]);
  return `
<h2>${emoji} $${id} · ${escapeHtml(d.day)}</h2>
${bar}
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

/**
 * Free-market card:
 *
 *   💲 US Dollar
 *   $USD · free market
 *   [chart]
 *   📊 24h pulse
 *
 *   💵 178,850 IRT
 *   📈 Tick  +120 (+0.07%)
 *   📉 24h   −1,200 (−0.67%)
 *
 *   🟢 Buy        178,800
 *   🔴 Sell       178,900
 *   🔺 Day high   179,200
 *   🔻 Day low    178,400
 *
 *   🕒 Mon 13 Jul, 05:30 · $USD · 📢 @Channel
 */
export function richSymbolPrice(
  env: Env,
  def: SymbolDef,
  row: LatestRow | null,
  chartUrl?: string,
  dayRange?: { high: number; low: number } | null,
  price24hAgo?: number | null,
  lang: Lang = "en",
  range: ChartRange = "24h",
  actions: "chat" | "link" = "chat",
): string {
  const unit = escapeHtml(t(lang, "cardUnit"));
  // Bare $USD → native cashtag (entity detection on)
  const cash = `$${def.id}`;
  const channel = `@${escapeHtml(env.CHANNEL_USERNAME)}`;
  const pulse = t(lang, range === "7d" ? "cardPulse7d" : "cardPulse24h");

  if (!row) {
    return `
<h2>${def.emoji} ${escapeHtml(def.name)}</h2>
<p>${cash}</p>
<p>${escapeHtml(t(lang, "cardNoData"))}</p>
`.trim();
  }

  // Fallback text inside tg-time MUST look like a real datetime so clients
  // that don't render the entity still show something useful.
  const whenAbs = formatTimeTehran(row.updated_at);
  const high = dayRange?.high ?? row.price;
  const low = dayRange?.low ?? row.price;
  const buy = row.buy ?? row.price;
  const sell = row.sell ?? row.price;

  const icons = { up: em("up"), down: em("down"), flat: em("flat") };
  const tickCh = formatDelta(row.price, row.prev_price, icons);
  const dayCh = formatDelta(row.price, price24hAgo, icons);

  const chartBlock = chartUrl
    ? `<img src="${escapeHtml(chartUrl)}" alt="${escapeHtml(def.id)} ${escapeHtml(pulse)}"/>
<p>${em("chart")} <i>${escapeHtml(pulse)}</i></p>`
    : "";

  const book = compactTable([
    [cell(t(lang, "cardBuy")), numCell(buy)],
    [cell(t(lang, "cardSell")), numCell(sell)],
    [cell(t(lang, "cardDayHigh")), numCell(high)],
    [cell(t(lang, "cardDayLow")), numCell(low)],
  ]);

  // Client renders these as live local datetime (format regex: r | w?[dD]?[tT]?)
  // Fallback text = absolute Tehran string so older clients still read something.
  const timeLive = `<tg-time unix="${row.updated_at}" format="wDt">${escapeHtml(whenAbs)}</tg-time>`;
  const timeRel = `<tg-time unix="${row.updated_at}" format="r">${escapeHtml(whenAbs)}</tg-time>`;

  return `
<h2>${def.emoji} ${escapeHtml(def.name)}</h2>
<p>${cash}</p>
${chartBlock}
<p>${em("price")} <b>${formatPrice(row.price)}</b> ${unit}</p>
<p>${em("sparkle")} <b>${escapeHtml(t(lang, "cardTick"))}</b> · ${tickCh}</p>
<p>${em("chart")} <b>${escapeHtml(t(lang, "cardDay"))}</b> · ${dayCh}</p>
${book}
<p>${em("clock")} ${timeLive} · ${timeRel}</p>
${cardActionRow(env, lang, def.id, range, row.price, actions)}
<p>${em("channel")} <a href="${channelUrl(env)}">${channel}</a></p>
`.trim();
}


