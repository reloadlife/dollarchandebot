"use client";

import { AuroraBackground } from "@/components/aceternity/aurora-background";
import { BackgroundBeams } from "@/components/aceternity/background-beams";
import { Spotlight } from "@/components/aceternity/spotlight";
import { BorderBeam } from "@/components/magicui/border-beam";

/**
 * Night wash for a page hero. Aceternity aurora, beams, and spotlight plus
 * a Magic UI border beam. SVG and CSS only, so legal pages can use it
 * without a WebGL or WebGPU canvas. Text stays in a later stacking layer.
 */
export function PageWash() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 isolate overflow-hidden">
      <AuroraBackground />
      <BackgroundBeams />
      <Spotlight className="-top-[30%] start-[-10%] h-[80%] w-[70%]" fill="#F6D48A" />
      <BorderBeam size={140} duration={14} colorFrom="#F6D48A" colorTo="#E39B3A" borderWidth={1} />
    </div>
  );
}
