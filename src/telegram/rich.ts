/**
 * Rich message HTML (Bot API sendRichMessage) for normal PV/group replies.
 * Guest/inline keep classic InputTextMessageContent / captions.
 */

import type { Env } from "../env";
import type { SymbolDef } from "../symbols";
import { SYMBOLS } from "../symbols";
import type { LatestRow } from "../db/prices";
import type { CalcResult } from "../lib/calc";
import { escapeHtml, formatDelta, formatPrice, formatTimeTehran } from "../lib/format";
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

export function richStart(env: Env): string {
  return `
<h2>👋 Welcome to Dollar Chande</h2>
<p>Live free-market rates in <b>Toman / IRT</b>, with a clean 24h chart.</p>

<h3>Get started</h3>
<ul>
<li>Send a symbol — <code>USD</code>, <code>$USD</code>, or <code>/USD</code> (all the same)</li>
<li><b>Inline</b>: type <code>${botAt(env)} USD</code> in any chat</li>
<li><b>Guest</b>: mention <code>${botAt(env)} USD</code> even if I’m not in the chat</li>
<li><b>Calculator</b>: <code>10 USDT + 5 EUR</code> → total in IRT</li>
</ul>

<h3>Commands</h3>
<ul>
<li><code>/help</code> — how everything works</li>
<li><code>/symbols</code> — full symbol list</li>
</ul>

<p>📣 Channel: <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richHelp(env: Env): string {
  return `
<h2>ℹ️ Help · Dollar Chande</h2>
<p>Free-market FX, gold, coins &amp; multi-exchange <b>USDT</b> · charts · calc.</p>

<h3>Prices</h3>
<ul>
<li><code>USD</code> / <code>$USD</code> — card + 24h chart</li>
<li><code>USD 7d</code> or <code>/7d USD</code> — 7-day chart</li>
<li><code>USD USDT EUR</code> — multi snapshot</li>
<li><code>/compare USD USDT</code> — spread</li>
<li><code>/exchanges</code> — USDT buy/sell by exchange</li>
<li><code>/history USD</code> · <code>/ohlc USD</code></li>
</ul>

<h3>Calculator</h3>
<ul>
<li><code>10.5 USDT + 10%</code></li>
<li><code>(10 USDT + 5 EUR) * 1.1</code></li>
<li><code>50000000 in USDT</code> — IRT → asset</li>
<li><code>fee 2%</code> or <code>/fee 2</code></li>
</ul>

<h3>Alerts &amp; settings</h3>
<ul>
<li><code>/alert USD above 180000</code></li>
<li><code>/alert USDT move 2</code></li>
<li><code>/alerts</code> · <code>/unalert 3</code></li>
<li><code>/lang en|fa</code> · <code>/settings</code></li>
</ul>

<h3>Also</h3>
<ul>
<li>Inline: <code>${botAt(env)} USD</code></li>
<li>Guest: mention <code>${botAt(env)} 10 USDT + 5 EUR</code></li>
</ul>

<p>⏱ ~5 min refresh · ${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richSymbols(): string {
  const order: Array<"fx" | "crypto" | "gold" | "coin"> = ["fx", "crypto", "gold", "coin"];
  const labels: Record<string, string> = {
    fx: "💱 Currencies",
    crypto: "💰 Crypto",
    gold: "🥇 Gold",
    coin: "🪙 Coins",
  };

  const parts: string[] = [
    `<h2>📋 Symbol list</h2>`,
    `<p><i>Send a code to get price + 24h chart.</i></p>`,
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

  parts.push(`<p>Tip: try <code>USD</code> or <code>USDT</code> first.</p>`);
  return parts.join("\n");
}

export function richUnknown(token: string): string {
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
): string {
  const lines = rows
    .map((r) => {
      const buy = r.buy != null ? formatPrice(r.buy) : "—";
      const sell = r.sell != null ? formatPrice(r.sell) : "—";
      return `<p><b>${escapeHtml(r.name)}</b>\n${em("buy")} ${buy} · ${em("sell")} ${sell}</p>`;
    })
    .join("\n");
  const newest = rows.reduce((m, r) => Math.max(m, r.updated_at), 0);
  const when = newest ? formatTimeTehran(newest) : "—";
  return `
<h2>${em("price")} USDT exchanges</h2>
<p><i>Buy = you pay IRT · Sell = you receive IRT</i></p>
${lines || "<p>No exchange data yet.</p>"}
<p>${em("clock")} <tg-time unix="${newest || Math.floor(Date.now() / 1000)}" format="r">${escapeHtml(when)}</tg-time> · ${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richCompare(
  env: Env,
  a: { id: string; name: string; emoji: string; price: number },
  b: { id: string; name: string; emoji: string; price: number },
): string {
  const ratio = b.price > 0 ? a.price / b.price : 0;
  const spread = a.price - b.price;
  const spreadPct = b.price > 0 ? (spread / b.price) * 100 : 0;
  const sign = spread >= 0 ? "+" : "";
  return `
<h2>${a.emoji} $${a.id} vs ${b.emoji} $${b.id}</h2>
<p>${a.emoji} <b>${formatPrice(a.price)}</b> IRT</p>
<p>${b.emoji} <b>${formatPrice(b.price)}</b> IRT</p>
<p>Spread <b>${sign}${formatPrice(spread)}</b> (${sign}${spreadPct.toFixed(2)}%)</p>
<p>1 $${a.id} ≈ <b>${ratio.toFixed(4)}</b> $${b.id}</p>
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richMulti(
  env: Env,
  rows: Array<{ id: string; emoji: string; price: number }>,
): string {
  const body = rows
    .map((r) => `<p>${r.emoji} $${r.id} · <b>${formatPrice(r.price)}</b></p>`)
    .join("\n");
  return `
<h2>${em("sparkle")} Snapshot</h2>
${body}
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richHistory(
  env: Env,
  id: string,
  emoji: string,
  days: Array<{ day: string; open: number; high: number; low: number; close: number }>,
): string {
  const lines = days
    .slice(-7)
    .map(
      (d) =>
        `<p><code>${escapeHtml(d.day)}</code> O ${formatPrice(d.open)} · H ${formatPrice(d.high)} · L ${formatPrice(d.low)} · C <b>${formatPrice(d.close)}</b></p>`,
    )
    .join("\n");
  return `
<h2>${emoji} $${id} history</h2>
${lines || "<p>No OHLC yet.</p>"}
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richOhlc(
  env: Env,
  id: string,
  emoji: string,
  d: { day: string; open: number; high: number; low: number; close: number } | null,
): string {
  if (!d) {
    return `<h2>${emoji} $${id}</h2><p>No OHLC bar yet.</p>`;
  }
  return `
<h2>${emoji} $${id} · ${escapeHtml(d.day)}</h2>
<p>Open <b>${formatPrice(d.open)}</b></p>
<p>${em("high")} High <b>${formatPrice(d.high)}</b></p>
<p>${em("low")} Low <b>${formatPrice(d.low)}</b></p>
<p>Close <b>${formatPrice(d.close)}</b></p>
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

/** Right-align numbers in a monospaced price block (tabs/spaces). */
function priceLine(label: string, n: number, labelW = 9, numW = 14): string {
  const num = formatPrice(n);
  return `${label.padEnd(labelW)}${num.padStart(numW)}`;
}

/**
 * Free-market card (no tables):
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
): string {
  const unit = "IRT";
  // Bare $USD → native cashtag (entity detection on)
  const cash = `$${def.id}`;
  const channel = `@${escapeHtml(env.CHANNEL_USERNAME)}`;

  if (!row) {
    return `
<h2>${def.emoji} ${escapeHtml(def.name)}</h2>
<p>${cash} · ${em("sparkle")} free market</p>
<p>No data yet — wait for the next scrape.</p>
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
    ? `<img src="${escapeHtml(chartUrl)}" alt="${escapeHtml(def.id)} 24h"/>
<p>${em("chart")} <i>24h pulse</i></p>`
    : "";

  // Tab-aligned book (plain text in <pre> so columns stay fixed-width)
  const book = [
    priceLine("Buy", buy, 10, 12),
    priceLine("Sell", sell, 10, 12),
    priceLine("Day high", high, 10, 12),
    priceLine("Day low", low, 10, 12),
  ].join("\n");

  // Client renders these as live local datetime (format regex: r | w?[dD]?[tT]?)
  // Fallback text = absolute Tehran string so older clients still read something.
  const timeLive = `<tg-time unix="${row.updated_at}" format="wDt">${escapeHtml(whenAbs)}</tg-time>`;
  const timeRel = `<tg-time unix="${row.updated_at}" format="r">${escapeHtml(whenAbs)}</tg-time>`;

  return `
<h2>${def.emoji} ${escapeHtml(def.name)}</h2>
<p>${cash} · ${em("sparkle")} free market</p>
${chartBlock}
<p>${em("price")} <b>${formatPrice(row.price)}</b> ${unit}</p>
<p>${em("sparkle")} <b>Tick</b> · ${tickCh}</p>
<p>${em("chart")} <b>24h</b> · ${dayCh}</p>
<p>${em("buy")} <b>Buy</b> · ${em("sell")} <b>Sell</b></p>
<pre>${book}</pre>
<p>${em("clock")} ${timeLive} · ${timeRel}</p>
<p>${cash} · ${em("channel")} <a href="${channelUrl(env)}">${channel}</a></p>
`.trim();
}

export function startKeyboard(env: Env): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        { text: "💲 Try USD", switch_inline_query_current_chat: "USD" },
        { text: "💰 Try USDT", switch_inline_query_current_chat: "USDT" },
      ],
      [
        { text: "🔎 Use inline…", switch_inline_query: "USD" },
        { text: "📣 Channel", url: channelUrl(env) },
      ],
    ],
  };
}
