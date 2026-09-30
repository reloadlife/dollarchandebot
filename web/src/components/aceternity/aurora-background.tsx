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
          "--dark-gradient":
            "repeating-linear-gradient(100deg,#000_0%,#000_7%,transparent_10%,transparent_12%,#000_16%)",
          "--transparent": "transparent",
        } as CSSProperties
      }
    >
      <div
        className={cn(
          "after:animate-aurora-wash pointer-events-none absolute -inset-[10px] opacity-45 blur-[12px] [background-image:var(--dark-gradient),var(--aurora)] [background-size:300%,_200%] [background-position:50%_50%,50%_50%] will-change-transform",
          "after:absolute after:inset-0 after:mix-blend-difference after:content-[''] after:[background-image:var(--dark-gradient),var(--aurora)] after:[background-size:200%,_100%]",
          showRadialGradient &&
            "[mask-image:radial-gradient(ellipse_at_72%_18%,black_8%,transparent_70%)]",
        )}
      />
    </div>
  );
}
