"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { fa } from "@/lib/utils";

const PLUGINS = [
  {
    id: "woo",
    title: "ووکامرس",
    action: "دریافت ووکامرس",
    href: "/downloads/dollarchande-woocommerce.zip",
    body: "قیمت پایه کالا را به دلار بنویس. هر ساعت، قیمت تومان از همین نرخ ساخته می‌شود.",
    detail: "قیمت = پایه × نرخ × ضریب",
    code: false,
    steps: [
      "افزونه را از پیشخوان بارگذاری کن.",
      "کلید را با /key از ربات بگیر و در تنظیمات بگذار.",
      "پایه را دلار بنویس. برای ریال، ضریب را ۱۰ بگذار.",
    ],
  },
  {
    id: "wp",
    title: "وردپرس",
    action: "دریافت وردپرس",
    href: "/downloads/dollarchande-wordpress.zip",
    body: "نرخ را داخل برگه و نوشته نشان می‌دهد.",
    detail: '[dollarchande symbol="USD"]',
    code: true,
    steps: [
      "افزونه را از پیشخوان بارگذاری کن.",
      "کلید را با /key از ربات بگیر و در تنظیمات بگذار.",
      "شورت‌کد را در برگه بگذار.",
    ],
  },
  {
    id: "whmcs",
    title: "WHMCS",
    action: "دریافت WHMCS",
    href: "/downloads/dollarchande-whmcs.zip",
    body: "اگر کران روشن باشد، حدود هر ساعت نرخ ارز را می‌نویسد.",
    detail: "modules/addons/dollarchande",
    code: true,
    steps: [
      "پوشه را در modules/addons بگذار.",
      "کلید و شناسه ارز را در تنظیمات بنویس.",
      "برای ریال، ضریب را ۱۰ بگذار.",
    ],
  },
] as const;

const tab =
  "relative inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[16px] px-3 text-sm font-semibold transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]";
const download =
  "inline-flex h-11 w-full items-center justify-center whitespace-nowrap rounded-[16px] bg-brand px-4 text-sm font-semibold text-brand-foreground transition-transform duration-150 ease-out hover:brightness-110 active:scale-[0.98] sm:w-auto";

export function PluginPicker() {
  const [id, setId] = useState<(typeof PLUGINS)[number]["id"]>("woo");
  const item = PLUGINS.find((plugin) => plugin.id === id) ?? PLUGINS[0];
  const listRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const button = document.getElementById(`plugin-tab-${id}`);
    if (!list || !button) return;

    const place = () => {
      const listBox = list.getBoundingClientRect();
      const buttonBox = button.getBoundingClientRect();
      setPill({
        x: buttonBox.left - listBox.left,
        y: buttonBox.top - listBox.top,
        w: buttonBox.width,
        h: buttonBox.height,
      });
    };

    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [id]);

  return (
    <div className="lift rounded-[16px] border border-border bg-card p-5 sm:p-7">
      <div
        ref={listRef}
        role="tablist"
        aria-label="افزونه"
        className="relative grid grid-cols-3 gap-2 sm:flex"
        onKeyDown={(event) => {
          const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[role=tab]"));
          const index = tabs.indexOf(document.activeElement as HTMLElement);
          const dir = event.key === "ArrowLeft" ? 1 : event.key === "ArrowRight" ? -1 : 0;
          if (!dir || index < 0) return;
          event.preventDefault();
          const next = tabs[(index + dir + tabs.length) % tabs.length];
          next.focus();
          next.click();
        }}
      >
        {pill ? (
          <span
            aria-hidden
            className="tab-pill absolute top-0 left-0 rounded-[16px] bg-brand"
            style={{ width: pill.w, height: pill.h, transform: `translate(${pill.x}px, ${pill.y}px)` }}
          />
        ) : null}
        {PLUGINS.map((plugin) => {
          const on = plugin.id === item.id;
          return (
            <button
              key={plugin.id}
              type="button"
              role="tab"
              id={`plugin-tab-${plugin.id}`}
              aria-selected={on}
              aria-controls="plugin-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => setId(plugin.id)}
              className={`${tab} ${on ? "text-brand-foreground" : "text-foreground/75 hover:text-foreground"}`}
            >
              <span className="relative">{plugin.title}</span>
            </button>
          );
        })}
      </div>

      <div
        key={item.id}
        id="plugin-panel"
        role="tabpanel"
        aria-labelledby={`plugin-tab-${item.id}`}
        className="picker-in mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]"
      >
        <div>
          <h3 className="text-2xl font-semibold">{item.title}</h3>
          <p className="mt-2 max-w-[48ch] text-sm leading-7 text-muted-foreground">{item.body}</p>
          <ol className="mt-5 space-y-3 text-sm leading-7">
            {item.steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground">
                  {fa(index + 1)}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <a href="/docs/" className="mt-5 inline-flex text-sm font-semibold text-brand">
            راهنمای نصب
          </a>
        </div>
        <div>
          <div className="totem-well rounded-[16px] px-4 py-5">
            <p className="text-xs text-[oklch(0.84_0.05_85)]">{item.code ? "نمونه" : "حساب قیمت"}</p>
            <p className="mt-3 text-lg font-medium leading-8 text-[oklch(0.92_0.16_88)]" dir={item.code ? "ltr" : undefined}>
              {item.code ? <span className="font-mono text-base">{item.detail}</span> : item.detail}
            </p>
          </div>
          <a href={item.href} download className={`${download} mt-4`}>
            {item.action}
          </a>
        </div>
      </div>
    </div>
  );
}
