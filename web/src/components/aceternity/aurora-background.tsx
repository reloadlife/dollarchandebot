"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Aceternity aurora wash.
 * The registry component paints a full-viewport zinc <main> and switches
 * on the `dark` class. This site is night-first through color-scheme, so
 * the wash is that dark branch, retinted to the board amber, and it only
 * fills its parent.
 */
export function AuroraBackground({
  className,
  showRadialGradient = true,
}: {
  className?: string;
  showRadialGradient?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={
        {
          "--aurora":
            "repeating-linear-gradient(100deg,#f6d27a_10%,#e39b3a_15%,#fff1cc_20%,#c47a2a_25%,#ffe7a3_30%)",
        } as CSSProperties
      }
    >
      <div
        className={cn(
          "after:animate-aurora-wash pointer-events-none absolute -inset-[10px] opacity-80 blur-[18px] [background-image:var(--aurora)] [background-size:220%] [background-position:50%_50%] will-change-transform",
          "after:absolute after:inset-0 after:opacity-70 after:mix-blend-soft-light after:content-[''] after:[background-image:var(--aurora)] after:[background-size:180%]",
          showRadialGradient &&
            "[mask-image:radial-gradient(ellipse_at_50%_40%,black_28%,transparent_74%)]",
        )}
      />
    </div>
  );
}
