"use client";

import type { CSSProperties } from "react";

const ON: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
};

function Digit({ char, height }: { char: string; height: number }) {
  const lit = ON[char] ?? "";
  const w = height * 0.62;
  const t = Math.max(3, height * 0.08);
  const seg = (id: string, style: CSSProperties) => (
    <span
      key={id}
      aria-hidden
      className="seg"
      style={{
        position: "absolute",
        background: lit.includes(id) ? "var(--led)" : "var(--led-ghost)",
        boxShadow: lit.includes(id) ? "0 0 8px color-mix(in oklch, var(--led) 75%, transparent)" : "none",
        borderRadius: 2,
        transition: "background-color 180ms cubic-bezier(0.16, 1, 0.3, 1)",
        ...style,
      }}
    />
  );
  return (
    <span style={{ position: "relative", display: "inline-block", width: w, height }} aria-hidden>
      {seg("a", { left: t, right: t, top: 0, height: t })}
      {seg("b", { right: 0, top: t / 2, width: t, height: height / 2 - t })}
      {seg("c", { right: 0, bottom: t / 2, width: t, height: height / 2 - t })}
      {seg("d", { left: t, right: t, bottom: 0, height: t })}
      {seg("e", { left: 0, bottom: t / 2, width: t, height: height / 2 - t })}
      {seg("f", { left: 0, top: t / 2, width: t, height: height / 2 - t })}
      {seg("g", { left: t, right: t, top: height / 2 - t / 2, height: t })}
    </span>
  );
}

export function SegmentReadout({
  value,
  height = 72,
  label,
  ghostDigits = 6,
}: {
  value: string;
  height?: number;
  label: string;
  ghostDigits?: number;
}) {
  const chars = value.replace(/[^\d]/g, "");
  const shown = chars.length ? chars : "8".repeat(Math.max(1, ghostDigits));
  const ghost = !chars.length;
  return (
    <div style={{ opacity: ghost ? 0.4 : 1 }}>
      <span className="sr-only" aria-live="polite">
        {label}
      </span>
      <span style={{ display: "inline-flex", gap: height * 0.08, direction: "ltr", maxWidth: "100%" }}>
        {shown.split("").map((c, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "flex-end", gap: height * 0.06 }}>
            {i > 0 && (shown.length - i) % 3 === 0 ? (
              <span aria-hidden style={{ width: height * 0.22 }} />
            ) : null}
            <Digit char={c} height={height} />
          </span>
        ))}
      </span>
    </div>
  );
}
