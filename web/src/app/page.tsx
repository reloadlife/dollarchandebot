import type { Metadata } from "next";
import Link from "next/link";
import { CopyBlock } from "@/components/copy-block";
import { PluginPicker } from "@/components/plugin-picker";
import { RateMarquee } from "@/components/rate-marquee";
import { Rise } from "@/components/rise";
import { riseDelay } from "@/lib/motion";
import { HeroStage } from "@/components/hero-stage";
import { Totem } from "@/components/totem";
import { GlowFrame, PageWash } from "@/components/page-wash";
import { ShineButton } from "@/components/vibefarsi/shine-button";
import { API_BASE, BOT_URL } from "@/lib/rates";
import { HOME_DESCRIPTION, HOME_TITLE, pageMeta } from "@/lib/seo";
import { fa } from "@/lib/utils";

export const metadata: Metadata = pageMeta({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  path: "/",
});

const quiet =
  "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[16px] border border-border bg-card px-4 text-sm font-semibold text-foreground transition-transform duration-150 ease-out hover:bg-muted active:scale-[0.98]";

const curl = `curl -H "Authorization: Bearer KEY" \\\n  ${API_BASE}/api/v1/symbols/USD`;

const apiSteps = [
  ["کلید بگیر", "ربات را باز کن و /key را بفرست. کلید را یک بار می‌بینی."],
  ["درخواست بفرست", "کلید را در Authorization: Bearer بگذار و نماد را صدا بزن."],
  ["قیمت را نشان بده", "price تومان است. نمودار /chart/USD.png کلید نمی‌خواهد."],
] as const;

const beats = [
  ["تابلو", "نرخ بازار آزاد همین حالا روی تابلو است. خواندنش حساب نمی‌خواهد. واحد تومان است."],
  ["فروشگاه", "افزونه وردپرس، ووکامرس یا WHMCS همان نرخ را در قیمت می‌نویسد. کلید را ربات می‌دهد."],
  ["هشدار", "از ربات بخواه وقتی قیمت از عددی گذشت خبر بدهد. کانال هر ده دقیقه یک فهرست بی‌صدا می‌فرستد."],
] as const;

const fields = [
  ["price", "آخرین قیمت، تومان"],
  ["prev_price", "قیمت قبلی، برای دیدن تغییر"],
  ["buy", "سوی خرید، تومان"],
  ["sell", "سوی فروش، تومان"],
  ["unit", "همیشه toman"],
  ["updated_at", "زمان یونیکس"],
] as const;

export default function HomePage() {
  return (
    <main>
      <section className="totem-scene relative overflow-hidden">
        <PageWash />
        <div className="relative z-10 mx-auto max-w-3xl px-4 py-8 lg:py-14">
          <p className="enter text-center text-sm font-medium text-foreground/70">بازار آزاد · تومان</p>
          <h1 className="sr-only">نرخ دلار بازار آزاد، به تومان</h1>
          <div className="enter" style={riseDelay(80)}>
            <HeroStage>
              <Totem />
            </HeroStage>
          </div>
          <div className="enter flex flex-wrap justify-center gap-3" style={riseDelay(160)}>
            <ShineButton href={`${BOT_URL}?start=USD`}>ربات</ShineButton>
            <Link href="/woocommerce/" className={quiet}>
              افزونه
            </Link>
          </div>
          <p className="enter mt-4 text-center text-foreground/75" style={riseDelay(220)}>
            قیمت فروشگاه از همین عدد می‌آید.
          </p>
          <p className="enter mt-3 flex justify-center gap-5 text-sm font-semibold" style={riseDelay(260)}>
            <Link href="/board/" className="text-foreground/80">
              تابلو
            </Link>
            <Link href="/dashboard/" className="text-foreground/80">
              داشبورد فروشگاه
            </Link>
          </p>
        </div>
      </section>

      <RateMarquee />

      <section className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 py-10 sm:grid-cols-3 lg:py-14">
          {beats.map(([title, body]) => (
            <article key={title} className="rounded-[16px] border border-border bg-card px-5 py-5">
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              <p className="mt-2 text-sm leading-7 text-foreground/75">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="plugins" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto grid max-w-6xl items-start gap-8 px-4 py-16 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:py-20">
          <Rise>
            <p className="text-sm font-semibold text-brand">افزونه‌ها</p>
            <h2 className="mt-2 max-w-[16ch] text-3xl font-semibold leading-snug text-foreground">
              قیمت فروشگاه با همین نرخ عوض می‌شود.
            </h2>
            <p className="mt-3 max-w-[36ch] text-foreground/75">
              هر سه رایگان‌اند. یکی را انتخاب کن. کلید را با /key از ربات بگیر.
            </p>
          </Rise>
          <Rise delay={120}>
            <PluginPicker />
          </Rise>
        </div>
      </section>

      <section id="api" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
          <Rise>
            <p className="text-sm font-semibold text-brand">API</p>
            <h2 className="mt-2 max-w-[18ch] text-3xl font-semibold leading-snug text-foreground">
              از کلید تا اولین قیمت، سه قدم.
            </h2>
            <p className="mt-3 max-w-[48ch] text-foreground/75">
              برنامه به‌جای یک انسان قیمت را می‌پرسد و جواب را به تومان می‌گیرد. هر کلید حدود ۶۰ درخواست در دقیقه.
            </p>
          </Rise>
          <Rise list stagger className="mt-8 grid gap-4 lg:grid-cols-3">
            {apiSteps.map(([title, body], index) => (
              <li
                key={title}
                className="rise-child lift rounded-[16px] border border-border bg-card p-5"
                style={riseDelay(index * 90)}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground">
                    {fa(index + 1)}
                  </span>
                  <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                </div>
                <p className="mt-3 text-sm leading-7 text-foreground/75">{body}</p>
              </li>
            ))}
          </Rise>
          <Rise stagger className="mt-8 grid items-start gap-4 lg:grid-cols-2">
            <div className="rise-child">
              <CopyBlock text={curl} label="کپی دستور" caption="GET /api/v1/symbols/USD" />
            </div>
            <div className="rise-child" style={riseDelay(120)}>
              <GlowFrame className="border border-border">
                <div className="code-face flex h-[60px] items-center px-4">
                  <p className="text-sm font-semibold">پاسخ</p>
                </div>
                <dl className="bg-card px-4">
                  {fields.map(([name, note]) => (
                    <div key={name} className="flex items-baseline justify-between gap-4 border-t border-border py-3 first:border-t-0">
                      <dt className="font-mono text-sm text-brand">{name}</dt>
                      <dd className="text-sm text-foreground/75">{note}</dd>
                    </div>
                  ))}
                </dl>
              </GlowFrame>
            </div>
          </Rise>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/developers/" className={quiet}>
              راهنمای کامل
            </Link>
            <a href={BOT_URL} className={quiet}>
              گرفتن کلید
            </a>
          </div>
        </div>
      </section>

    </main>
  );
}
