import Link from "next/link";
import { PluginPicker } from "@/components/plugin-picker";
import { Totem } from "@/components/totem";
import { BOT_URL, CHANNEL_URL } from "@/lib/rates";

const primary =
  "inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-[16px] bg-brand px-4 text-sm font-semibold text-brand-foreground transition-transform duration-150 ease-out hover:brightness-110 active:scale-[0.98]";
const quiet =
  "inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-[16px] border border-border bg-card px-4 text-sm font-semibold text-foreground transition-transform duration-150 ease-out hover:bg-muted active:scale-[0.98]";

export default function HomePage() {
  return (
    <main>
      <section className="totem-scene mx-auto grid max-w-6xl items-start gap-10 px-4 pb-8 pt-8 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-14 lg:pb-16 lg:pt-12">
        <div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.25] lg:text-[2.65rem]">
            نرخ دلار، داخل قیمت فروشگاه.
          </h1>
          <p className="mt-4 max-w-[36ch] text-base leading-8 text-muted-foreground">
            افزونه‌های رایگان وردپرس، ووکامرس و WHMCS قیمت فروشگاه را با نرخ بازار آزاد تازه می‌کنند.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#plugins" className={primary}>
              انتخاب افزونه
            </a>
            <Link href="/board/" className={quiet}>
              دیدن تابلو
            </Link>
          </div>
        </div>
        <Totem />
      </section>

      <section id="plugins" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-16">
        <h2 className="max-w-[18ch] text-3xl font-semibold leading-snug">قیمت فروشگاه با همین نرخ عوض می‌شود.</h2>
        <p className="mt-3 max-w-[42ch] text-muted-foreground">یکی را انتخاب کن. هر سه رایگان‌اند. کلید را با /key از ربات بگیر.</p>
        <PluginPicker />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="text-2xl font-semibold">همان نرخ، برای کد</h2>
        <p className="mt-3 max-w-[42ch] text-muted-foreground">کلید را ربات می‌دهد. قیمت‌ها تومان است.</p>
        <Link href="/developers/" className="mt-4 inline-flex text-sm font-semibold text-brand">
          راهنمای API
        </Link>
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
      </footer>
    </main>
  );
}
