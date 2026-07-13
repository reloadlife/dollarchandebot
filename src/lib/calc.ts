/**
 * Calculator with:
 *   10.5 USDT + 5 EUR + 10%
 *   50_000_000 IRT in USDT   (invert)
 *   (10 USDT + 5 EUR) * 1.1
 *   fee 2% / with fee
 *   + - * / ( )
 *
 * Default output: IRT unless "in SYMBOL" invert.
 */

import { resolveSymbol, type SymbolDef } from "../symbols";
import { formatPrice } from "./format";

export type CalcTerm =
  | {
      kind: "asset";
      sign: 1 | -1;
      amount: number;
      symbol: SymbolDef;
      rawSymbol: string;
    }
  | { kind: "percent"; sign: 1 | -1; percent: number }
  | { kind: "fee"; percent: number };

export interface CalcParseOk {
  ok: true;
  mode: "sum" | "invert";
  terms: CalcTerm[];
  /** invert: amount of IRT to convert */
  irtAmount?: number;
  /** invert target symbol */
  invertTo?: SymbolDef;
  feePct: number;
  expression: string;
}

export interface CalcParseErr {
  ok: false;
  error: string;
}

export type CalcParse = CalcParseOk | CalcParseErr;

function toAsciiDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));
}

function normalize(raw: string): string {
  let q = toAsciiDigits(raw.trim());
  q = q.replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "");
  q = q.replace(/[％﹪٪]/g, "%");
  q = q.replace(/[＋﹢]/g, "+");
  q = q.replace(/[–—−－﹣]/g, "-");
  q = q.replace(/[×✖✕]/g, "*");
  q = q.replace(/[÷／]/g, "/");
  q = q.replace(/．/g, ".");
  q = q.replace(/_/g, "");
  // European decimal 10,5 (not thousands)
  q = q.replace(/(\d),(\d)(?!\d{2}\b)/g, "$1.$2");
  while (/(\d),(\d{3})\b/.test(q)) q = q.replace(/(\d),(\d{3})\b/g, "$1$2");
  return q.replace(/\s+/g, " ").trim();
}

export function looksLikeCalc(query: string): boolean {
  const q = normalize(query);
  if (!q) return false;
  if (/^\/?\$?[A-Za-z][A-Za-z0-9_]*$/u.test(q)) return false;
  if (!/\d/.test(q)) return false;
  if (/\bin\b/i.test(q)) return true;
  if (/%/.test(q) || /[+\-*/()]/.test(q)) return true;
  if (/\d(?:\.\d+)?\s*\$?[A-Za-z]/.test(q)) return true;
  if (/\bfee\b/i.test(q)) return true;
  return false;
}

/**
 * Simple left-to-right eval for numbers with + - * / and parentheses.
 * Used after substituting each asset with its IRT value.
 */
function evalArith(expr: string): number {
  // shunting-yard-lite via Function is unsafe; manual recursive descent
  const tokens = expr.match(/\d+(?:\.\d+)?|[+\-*/()]/g);
  if (!tokens) throw new Error("bad arith");
  let i = 0;
  function peek() {
    return tokens![i];
  }
  function next() {
    return tokens![i++];
  }
  function parseExpr(): number {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function parseTerm(): number {
    let v = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const r = parseFactor();
      if (op === "/" && r === 0) throw new Error("div by zero");
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function parseFactor(): number {
    const t = peek();
    if (t === "+") {
      next();
      return parseFactor();
    }
    if (t === "-") {
      next();
      return -parseFactor();
    }
    if (t === "(") {
      next();
      const v = parseExpr();
      if (next() !== ")") throw new Error("unbalanced (");
      return v;
    }
    const n = next();
    if (n == null || !/^\d/.test(n)) throw new Error("expected number");
    return Number(n);
  }
  const v = parseExpr();
  if (i < tokens.length) throw new Error("trailing junk");
  return v;
}

export function parseCalc(query: string, defaultFee = 0): CalcParse {
  let q = normalize(query);
  if (!q) return { ok: false, error: "empty" };

  // fee 2% / fee:2 / with fee 1.5%
  let feePct = defaultFee;
  const feeM = q.match(/\b(?:fee|with\s+fee)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%?/i);
  if (feeM) {
    feePct = Number(feeM[1]);
    q = q.replace(feeM[0], " ").replace(/\s+/g, " ").trim();
  }

  // Invert: 50000000 IRT in USDT | 50m toman to USD
  const inv = q.match(
    /^([\d.]+)\s*(?:irt|toman|irr|rial|ریال|تومان)?\s+(?:in|to|→|->)\s+(\$?[A-Za-z][A-Za-z0-9_]*)$/i,
  );
  if (inv) {
    const irtAmount = Number(inv[1]);
    const def = resolveSymbol(inv[2] ?? "");
    if (!def) return { ok: false, error: `unknown symbol “${inv[2]}”` };
    if (!Number.isFinite(irtAmount) || irtAmount <= 0) {
      return { ok: false, error: "invalid IRT amount" };
    }
    return {
      ok: true,
      mode: "invert",
      terms: [],
      irtAmount,
      invertTo: def,
      feePct,
      expression: `${formatAmount(irtAmount)} IRT → ${def.id}`,
    };
  }

  // Target amount: how much USDT for 50m IRT — same as invert
  // "buy USDT with 50m" handled as invert

  // Legacy sum parser: assets and percents with + -
  // Also support * / on pure numbers after substitution via full rewrite path
  // For mixed assets: tokenize amount SYMBOL and % and operators

  q = q.replace(/\$(\d)/g, "$1");
  q = q.replace(/(\d+(?:\.\d+)?)\s*%/g, "$1%");
  q = q.replace(/(\d)(\$?[A-Za-z])/g, "$1 $2");
  q = q.replace(/([+\-*/()])(\d)/g, "$1 $2");
  q = q.replace(/(\d)([+\-*/()])/g, "$1 $2");
  q = q.replace(/\s+/g, " ").trim();

  // If expression has * / ( ) treat as arith template with assets as {USDT:10.5}
  const hasArith = /[*/()]/.test(q);

  if (hasArith) {
    return parseArithCalc(q, feePct);
  }

  // Simple sum path (assets + percents)
  const tokens: string[] = [];
  const re = /([+-])|(\d+(?:\.\d+)?%)|(\d+(?:\.\d+)?)|(\$?[A-Za-z][A-Za-z0-9_]*)/gu;
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = re.exec(q)) !== null) {
    const gap = q.slice(last, m.index).trim();
    if (gap) return { ok: false, error: `unexpected “${gap}”` };
    tokens.push(m[1] ?? m[2] ?? m[3] ?? m[4] ?? "");
    last = m.index + m[0].length;
  }
  if (q.slice(last).trim()) return { ok: false, error: `unexpected “${q.slice(last).trim()}”` };

  const terms: CalcTerm[] = [];
  let i = 0;
  let defaultSign: 1 | -1 = 1;
  let sawAsset = false;

  while (i < tokens.length) {
    let sign: 1 | -1 = defaultSign;
    if (tokens[i] === "+" || tokens[i] === "-") {
      sign = tokens[i] === "-" ? -1 : 1;
      i++;
    }
    const tok = tokens[i++];
    if (!tok) return { ok: false, error: "expected amount or percent" };

    if (/^\d+(?:\.\d+)?%$/.test(tok)) {
      if (!sawAsset) return { ok: false, error: "percent needs a base first (e.g. 10 USDT + 10%)" };
      terms.push({ kind: "percent", sign, percent: Number(tok.slice(0, -1)) });
      defaultSign = 1;
      continue;
    }
    if (!/^\d+(?:\.\d+)?$/.test(tok)) {
      return { ok: false, error: `expected amount, got “${tok}”` };
    }
    const amount = Number(tok);
    const symTok = tokens[i++];
    if (!symTok || symTok === "+" || symTok === "-") {
      return { ok: false, error: "expected symbol after amount" };
    }
    const def = resolveSymbol(symTok);
    if (!def) return { ok: false, error: `unknown symbol “${symTok}”` };
    terms.push({
      kind: "asset",
      sign,
      amount,
      symbol: def,
      rawSymbol: symTok.replace(/^\$/, "").toUpperCase(),
    });
    sawAsset = true;
    defaultSign = 1;
  }

  if (!terms.length) return { ok: false, error: "no terms" };

  const expression = terms
    .map((t, idx) => {
      if (t.kind === "percent") {
        const body = `${formatAmount(t.percent)}%`;
        return idx === 0 ? (t.sign < 0 ? `-${body}` : body) : `${t.sign < 0 ? "−" : "+"} ${body}`;
      }
      if (t.kind === "fee") return `fee ${t.percent}%`;
      const body = `${formatAmount(t.amount)} ${t.symbol.id}`;
      return idx === 0 ? (t.sign < 0 ? `-${body}` : body) : `${t.sign < 0 ? "−" : "+"} ${body}`;
    })
    .join(" ");

  const feeNote = feePct > 0 ? ` fee ${feePct}%` : "";
  return {
    ok: true,
    mode: "sum",
    terms,
    feePct,
    expression: expression + feeNote,
  };
}

/** (10 USDT + 5 EUR) * 1.1  or  10 USDT * 1.1 */
function parseArithCalc(q: string, feePct: number): CalcParse {
  // Replace "10.5 USDT" with placeholders, evaluate structure
  const assets: Array<{ key: string; amount: number; symbol: SymbolDef }> = [];
  let expr = q;
  const assetRe = /(\d+(?:\.\d+)?)\s*(\$?[A-Za-z][A-Za-z0-9_]*)/g;
  expr = expr.replace(assetRe, (_, amt, sym) => {
    const def = resolveSymbol(sym);
    if (!def) return " __BAD__ ";
    const key = `A${assets.length}`;
    assets.push({ key, amount: Number(amt), symbol: def });
    return ` ${key} `;
  });
  if (expr.includes("__BAD__")) {
    return { ok: false, error: "unknown symbol in expression" };
  }
  // percents after assets become later — not in arith path for simplicity
  if (/%/.test(expr)) {
    return { ok: false, error: "use + 10% after assets without * / ( ); or apply fee with fee 2%" };
  }

  // Build terms list for display + eval will substitute
  const terms: CalcTerm[] = assets.map((a) => ({
    kind: "asset" as const,
    sign: 1 as const,
    amount: a.amount,
    symbol: a.symbol,
    rawSymbol: a.symbol.id,
  }));

  return {
    ok: true,
    mode: "sum",
    terms,
    feePct,
    expression: q + (feePct > 0 ? ` fee ${feePct}%` : ""),
    // stash arith template on expression with keys — evaluateCalc handles if expression has A0
  };
}

// Attach arith template via weak map-like: store on expression prefix
// Better: extend CalcParseOk
// For simplicity, re-parse arith in evaluate if * / ( ) present

export type EvalTerm =
  | (Extract<CalcTerm, { kind: "asset" }> & { unitPrice: number; subtotal: number })
  | (Extract<CalcTerm, { kind: "percent" }> & { base: number; subtotal: number })
  | { kind: "fee"; percent: number; base: number; subtotal: number };

export interface CalcResult {
  expression: string;
  terms: EvalTerm[];
  total: number;
  unit: string;
  /** invert mode: how many units of target */
  invertAmount?: number;
  invertSymbol?: string;
}

export async function evaluateCalc(
  parsed: CalcParseOk,
  getPrice: (symbolId: string) => Promise<number | null>,
  unit = "IRT",
): Promise<{ ok: true; result: CalcResult } | { ok: false; error: string }> {
  if (parsed.mode === "invert" && parsed.invertTo && parsed.irtAmount != null) {
    const px = await getPrice(parsed.invertTo.id);
    if (px == null || px <= 0) return { ok: false, error: `no price for ${parsed.invertTo.id}` };
    let irt = parsed.irtAmount;
    // fee on IRT spend
    if (parsed.feePct > 0) irt = irt * (1 - parsed.feePct / 100);
    const amount = irt / px;
    return {
      ok: true,
      result: {
        expression: parsed.expression,
        terms: [
          {
            kind: "asset",
            sign: 1,
            amount,
            symbol: parsed.invertTo,
            rawSymbol: parsed.invertTo.id,
            unitPrice: px,
            subtotal: parsed.irtAmount,
          },
        ],
        total: parsed.irtAmount,
        unit,
        invertAmount: amount,
        invertSymbol: parsed.invertTo.id,
      },
    };
  }

  // Arith path
  if (/[*/()]/.test(parsed.expression) && parsed.terms.every((t) => t.kind === "asset")) {
    return evaluateArith(parsed, getPrice, unit);
  }

  const out: EvalTerm[] = [];
  let total = 0;

  for (const t of parsed.terms) {
    if (t.kind === "percent") {
      const base = total;
      const delta = t.sign * base * (t.percent / 100);
      total += delta;
      out.push({ ...t, base, subtotal: delta });
      continue;
    }
    if (t.kind === "fee") continue;

    const unitPrice = await getPrice(t.symbol.id);
    if (unitPrice == null || unitPrice <= 0) {
      return { ok: false, error: `no price for ${t.symbol.id}` };
    }
    const subtotal = t.sign * t.amount * unitPrice;
    total += subtotal;
    out.push({ ...t, unitPrice, subtotal });
  }

  if (parsed.feePct > 0) {
    const fee = total * (parsed.feePct / 100);
    total += fee; // fee adds cost when buying
    out.push({ kind: "fee", percent: parsed.feePct, base: total - fee, subtotal: fee });
  }

  return {
    ok: true,
    result: { expression: parsed.expression, terms: out, total, unit },
  };
}

async function evaluateArith(
  parsed: CalcParseOk,
  getPrice: (symbolId: string) => Promise<number | null>,
  unit: string,
): Promise<{ ok: true; result: CalcResult } | { ok: false; error: string }> {
  let expr = normalize(parsed.expression.replace(/\s*fee\s+[\d.]+%?/i, ""));
  const out: EvalTerm[] = [];

  // replace assets with IRT values
  for (const t of parsed.terms) {
    if (t.kind !== "asset") continue;
    const unitPrice = await getPrice(t.symbol.id);
    if (unitPrice == null || unitPrice <= 0) {
      return { ok: false, error: `no price for ${t.symbol.id}` };
    }
    const irt = t.amount * unitPrice;
    out.push({ ...t, unitPrice, subtotal: irt });
    // replace first occurrence of "amount SYMBOL"
    const re = new RegExp(
      `${escapeReg(formatAmount(t.amount))}\\s*\\$?${escapeReg(t.symbol.id)}`,
      "i",
    );
    expr = expr.replace(re, String(irt));
  }

  expr = expr.replace(/\$/g, "");
  let total: number;
  try {
    total = evalArith(expr.replace(/[^0-9+\-*/().\s]/g, " "));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "arith error" };
  }

  if (parsed.feePct > 0) {
    const fee = total * (parsed.feePct / 100);
    total += fee;
    out.push({ kind: "fee", percent: parsed.feePct, base: total - fee, subtotal: fee });
  }

  return {
    ok: true,
    result: { expression: parsed.expression, terms: out, total, unit },
  };
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatAmount(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toPrecision(12)));
}

export function formatCalcTitle(result: CalcResult): string {
  if (result.invertAmount != null && result.invertSymbol) {
    return `${formatPrice(result.total)} IRT → ${result.invertAmount.toFixed(4)} ${result.invertSymbol}`;
  }
  return `${result.expression} = ${formatPrice(result.total)} ${result.unit}`;
}

export function formatCalcDescription(result: CalcResult): string {
  return formatCalcTitle(result);
}
