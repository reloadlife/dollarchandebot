"use client";

import { useState } from "react";
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

const tabOn =
  "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[16px] bg-muted px-3 text-sm font-semibold text-foreground ring-1 ring-brand";
const tabOff =
  "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[16px] px-3 text-sm text-muted-foreground hover:text-foreground";
const download =
  "inline-flex h-11 w-full items-center justify-center whitespace-nowrap rounded-[16px] bg-brand px-4 text-sm font-semibold text-brand-foreground transition-transform duration-150 ease-out hover:brightness-110 active:scale-[0.98] sm:w-auto";

export function PluginPicker() {
  const [id, setId] = useState<(typeof PLUGINS)[number]["id"]>("woo");
  const item = PLUGINS.find((plugin) => plugin.id === id) ?? PLUGINS[0];

  return (
    <div className="mt-8 rounded-[16px] border border-border bg-card p-5 sm:p-7">
      <div
        role="tablist"
        aria-label="افزونه"
        className="grid grid-cols-3 gap-2 sm:flex"
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
              className={on ? tabOn : tabOff}
            >
              {plugin.title}
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
          <ol className="mt-5 space-y-2 text-sm leading-7">
            {item.steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="w-5 shrink-0 text-muted-foreground">{fa(index + 1)}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-[16px] bg-muted px-4 py-5">
          <p className="text-sm text-foreground">
            {item.code ? (
              <span className="inline-block font-mono" dir="ltr">
                {item.detail}
              </span>
            ) : (
              item.detail
            )}
          </p>
          <a href={item.href} download className={`${download} mt-5`}>
            {item.action}
          </a>
        </div>
      </div>
    </div>
  );
}
