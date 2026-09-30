import Link from "next/link";
import { AuroraBackground } from "@/components/aceternity/aurora-background";
import { BackgroundBeams } from "@/components/aceternity/background-beams";
import { Spotlight } from "@/components/aceternity/spotlight";
import { AuroraText } from "@/components/magicui/aurora-text";
import { BorderBeam } from "@/components/magicui/border-beam";
import { Particles } from "@/components/magicui/particles";
import { PluginPicker } from "@/components/plugin-picker";
import { RateMarquee } from "@/components/rate-marquee";
import { Totem } from "@/components/totem";
import { BlurText } from "@/components/vibefarsi/blur-text";
import { GirihBackground } from "@/components/vibefarsi/girih";
import { LightLeakBackground } from "@/components/vibefarsi/light-leak";
import { Reveal } from "@/components/vibefarsi/reveal";
import { ShineButton } from "@/components/vibefarsi/shine-button";
import { BOT_URL, CHANNEL_URL } from "@/lib/rates";

const quiet =
  "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[16px] border border-border bg-card/80 px-4 text-sm font-semibold text-foreground backdrop-blur-sm transition-transform duration-150 ease-out hover:bg-muted active:scale-[0.98]";

export default function HomePage() {
  return (
    <main>
      <section className="relative isolate overflow-hidden">
        <AuroraBackground />
        <GirihBackground className="opacity-40" />
        <LightLeakBackground />
        <Particles
          className="absolute inset-0"
          quantity={42}
          size={0.55}
          ease={70}
          staticity={40}
          color="#f5c16c"
          vy={-0.04}
        />
        <Spotlight className="-top-48 left-0 md:-top-28 md:left-10" fill="#f6d27a" />

        <div className="relative z-10 mx-auto grid max-w-6xl items-start gap-10 px-4 pb-16 pt-10 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-14 lg:pb-24 lg:pt-16">
          <div>
            <p className="text-sm text-muted-foreground">بازار آزاد · تومان</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-[1.25] lg:text-[2.65rem]">
              <BlurText text="نرخ دلار، داخل" />{" "}
              <AuroraText
                colors={["#fff1cc", "#f6d27a", "#e39b3a", "#fff8e6"]}
                speed={0.7}
                className="font-semibold"
              >
                قیمت فروشگاه.
              </AuroraText>
            </h1>
            <p className="mt-4 max-w-[36ch] text-base leading-8 text-muted-foreground">
              افزونه‌های رایگان وردپرس، ووکامرس و WHMCS قیمت فروشگاه را با نرخ بازار آزاد تازه می‌کنند.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ShineButton href="#plugins">انتخاب افزونه</ShineButton>
              <Link href="/board/" className={quiet}>
                دیدن تابلو
              </Link>
            </div>
          </div>

          <div className="relative rounded-[16px]">
            <Totem />
            <BorderBeam size={150} duration={8} colorFrom="#fff1cc" colorTo="#e08a1e" borderWidth={1.5} />
          </div>
        </div>
      </section>

      <RateMarquee />

      <section id="plugins" className="scroll-mt-20 relative overflow-hidden">
        <BackgroundBeams className="opacity-70" />
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 lg:py-24">
          <Reveal>
            <h2 className="max-w-[18ch] text-3xl font-semibold leading-snug">قیمت فروشگاه با همین نرخ عوض می‌شود.</h2>
            <p className="mt-3 max-w-[42ch] text-muted-foreground">
              یکی را انتخاب کن. هر سه رایگان‌اند. کلید را با /key از ربات بگیر.
            </p>
          </Reveal>
          <Reveal delay={90}>
            <PluginPicker />
          </Reveal>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-start gap-10 px-4 py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:py-20">
        <Reveal>
          <h2 className="text-2xl font-semibold">همان نرخ، برای کد</h2>
          <p className="mt-3 max-w-[42ch] text-muted-foreground">
            قیمت‌ها تومان است. کلید را ربات می‌دهد. نمودار بدون کلید باز می‌شود.
          </p>
          <Link href="/developers/" className="mt-4 inline-flex text-sm font-semibold text-brand">
            راهنمای API
          </Link>
        </Reveal>
        <Reveal delay={80}>
          <div className="rounded-[16px] border border-border bg-card p-6">
            <p className="text-sm leading-7 text-muted-foreground">همان عدد، در کانال و در ربات.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={CHANNEL_URL} className={quiet}>
                کانال
              </a>
              <a href={BOT_URL} className={quiet}>
                ربات
              </a>
            </div>
          </div>
        </Reveal>
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
