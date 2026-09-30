import Link from "next/link";
import { PluginPicker } from "@/components/plugin-picker";
import { RateMarquee } from "@/components/rate-marquee";
import { Totem } from "@/components/totem";
import { ShineButton } from "@/components/vibefarsi/shine-button";
import { BOT_URL, CHANNEL_URL } from "@/lib/rates";

const quiet =
  "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[16px] border border-border bg-card px-4 text-sm font-semibold text-foreground transition-transform duration-150 ease-out hover:bg-muted active:scale-[0.98]";

export default function HomePage() {
  return (
    <main>
      <section className="totem-scene">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:py-20">
          <div>
            <p className="text-sm font-medium text-foreground/70">بازار آزاد · تومان</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-[1.35] text-foreground lg:text-5xl">
              نرخ دلار، داخل <span className="text-brand">قیمت فروشگاه.</span>
            </h1>
            <p className="mt-4 max-w-[36ch] text-base leading-8 text-foreground/75">
              افزونه‌های رایگان وردپرس، ووکامرس و WHMCS قیمت فروشگاه را با نرخ بازار آزاد تازه می‌کنند.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ShineButton href="#plugins">انتخاب افزونه</ShineButton>
              <Link href="/board/" className={quiet}>
                دیدن تابلو
              </Link>
            </div>
          </div>
          <Totem />
        </div>
      </section>

      <RateMarquee />

      <section id="plugins" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
          <h2 className="max-w-[18ch] text-3xl font-semibold leading-snug text-foreground">
            قیمت فروشگاه با همین نرخ عوض می‌شود.
          </h2>
          <p className="mt-3 max-w-[42ch] text-foreground/75">
            یکی را انتخاب کن. هر سه رایگان‌اند. کلید را با /key از ربات بگیر.
          </p>
          <PluginPicker />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-start gap-10 px-4 py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:py-20">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">همان نرخ، برای کد</h2>
          <p className="mt-3 max-w-[42ch] text-foreground/75">
            قیمت‌ها تومان است. کلید را ربات می‌دهد. نمودار بدون کلید باز می‌شود.
          </p>
          <Link href="/developers/" className="mt-4 inline-flex text-sm font-semibold text-brand">
            راهنمای API
          </Link>
        </div>
        <div className="rounded-[16px] border border-border bg-card p-6">
          <p className="text-sm leading-7 text-foreground/75">همان عدد، در کانال و در ربات.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={CHANNEL_URL} className={quiet}>
              کانال
            </a>
            <a href={BOT_URL} className={quiet}>
              ربات
            </a>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl gap-5 border-t border-border px-4 py-6 text-sm text-muted-foreground">
        <Link href="/board/" className="hover:text-foreground">
          تابلو
        </Link>
        <a href={CHANNEL_URL} className="hover:text-foreground">
          کانال
        </a>
        <a href={BOT_URL} className="hover:text-foreground">
          ربات
        </a>
        <Link href="/developers/" className="hover:text-foreground">
          API
        </Link>
      </footer>
    </main>
  );
}
