import type { CSSProperties } from "react";

export function riseDelay(ms: number): CSSProperties {
  return { "--rise-delay": `${ms}ms` } as CSSProperties;
}
