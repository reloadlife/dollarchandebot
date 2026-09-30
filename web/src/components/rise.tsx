"use client";

import { useLayoutEffect, useRef, type ReactNode, type Ref } from "react";
import { riseDelay } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Fades and rises once it enters the view. Stays visible if motion is reduced or the observer never fires. */
export function Rise({
  children,
  className,
  delay = 0,
  stagger = false,
  list = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  stagger?: boolean;
  list?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let io: IntersectionObserver | undefined;
    let timer = 0;

    const play = () => {
      el.classList.remove("rise-wait");
      el.classList.add("rise-play");
      io?.disconnect();
      window.clearTimeout(timer);
    };

    const inView = () => {
      const box = el.getBoundingClientRect();
      return box.top < window.innerHeight * 0.92 && box.bottom > 0;
    };

    const arm = () => {
      if (el.classList.contains("rise-play")) return;
      if (inView()) {
        play();
        return;
      }
      el.classList.add("rise-wait");
      if (io) return;
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) play();
        },
        { rootMargin: "0px 0px -8% 0px" },
      );
      io.observe(el);
    };

    arm();
    // Hash jumps and the first layout can disagree. Recheck before the next paint.
    const frame = requestAnimationFrame(arm);
    timer = window.setTimeout(() => {
      if (inView()) play();
    }, 900);

    return () => {
      cancelAnimationFrame(frame);
      io?.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  const shared = {
    ref: ref as Ref<HTMLDivElement & HTMLOListElement>,
    className: cn(stagger && "rise-stagger", className),
    style: riseDelay(delay),
  };
  return list ? <ol {...shared}>{children}</ol> : <div {...shared}>{children}</div>;
}
