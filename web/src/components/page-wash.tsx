"use client";

import type { ReactNode } from "react";
import { AuroraBackground } from "@/components/aceternity/aurora-background";
import { BackgroundBeams } from "@/components/aceternity/background-beams";
import { Spotlight } from "@/components/aceternity/spotlight";
import { BorderBeam } from "@/components/magicui/border-beam";
import { cn } from "@/lib/utils";

/**
 * Night wash for a page hero. Aceternity aurora, beams, and spotlight plus
 * a Magic UI border beam. SVG and CSS only, so legal pages can use it
 * without a WebGL or WebGPU canvas. Text stays in a later stacking layer.
 */
export function PageWash() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 isolate overflow-hidden">
      <AuroraBackground />
      <BackgroundBeams className="opacity-90 [mask-image:radial-gradient(ellipse_at_center,black_15%,transparent_72%)]" />
      <Spotlight className="-top-[20%] start-[-8%] h-[70%] w-[78%]" fill="#F8E7B0" />
      <div className="absolute inset-3 overflow-hidden rounded-[16px] sm:inset-4">
        <BorderBeam size={180} duration={13} colorFrom="#F8E7B0" colorTo="#E6C56A" borderWidth={1.5} />
      </div>
    </div>
  );
}

/** Rounded frame with the same amber border beam, for a card the eye lands on. */
export function GlowFrame({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("relative overflow-hidden rounded-[16px]", className)}>
      <BorderBeam size={110} duration={11} colorFrom="#F8E7B0" colorTo="#E6C56A" borderWidth={1.5} />
      {children}
    </div>
  );
}
