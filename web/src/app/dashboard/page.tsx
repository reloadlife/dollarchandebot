import type { Metadata } from "next";
import Link from "next/link";
import { Board } from "@/components/board";
import { ShopBoard } from "@/components/shop-board";
import { PageWash } from "@/components/page-wash";
import { GirihBackground } from "@/components/vibefarsi/girih";
import { ShineButton } from "@/components/vibefarsi/shine-button";

export const metadata: Metadata = {
  alternates: { canonical: "/dashboard/" },
  openGraph: { title: "داشبورد · دلارچنده", description: "تابلوی زنده نرخ بازار آزاد برای فروشگاه. بدون حساب. قیمت‌ها تومان‌اند.", url: "/dashboard/", images: ["/social-card.png"], locale: "fa_IR", type: "website" },
  title: "داشبورد · دلارچنده",
  description: "تابلوی زنده نرخ بازار آزاد برای فروشگاه. بدون حساب. قیمت‌ها تومان‌اند.",
};

const quiet =
  "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[16px] border border-border bg-card px-4 text-sm font-semibold text-foreground transition-transform duration-150 ease-out hover:bg-muted active:scale-[0.98]";

export default function DashboardPage() {
  return (
    <main>
      <section className="totem-scene relative overflow-hidden">
        <PageWash />
        <GirihBackground className="opacity-30" />
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-12 lg:py-16">
          <p className="text-sm font-medium text-foreground/70">فروشگاه · بدون حساب</p>
          <h1 className="mt-3 max-w-[18ch] text-balance text-4xl font-semibold leading-[1.35] text-foreground">
            نرخ‌هایی که افزونه می‌نویسد.
          </h1>
          <p className="mt-4 max-w-[42ch] text-base leading-8 text-foreground/75">
            همین تابلو زنده است. خواندنش حساب نمی‌خواهد. افزونه برای نوشتن قیمت، کلید را از ربات می‌گیرد. واحد تومان است.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ShineButton href="/#plugins">انتخاب افزونه</ShineButton>
            <Link href="/board/" className={quiet}>
              تابلوی کامل
            </Link>
          </div>
          <ShopBoard />
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
          <h2 className="text-2xl font-semibold text-foreground">همه نمادها</h2>
          <p className="mt-2 max-w-[42ch] text-foreground/75">
            نماد را انتخاب کن. نمودار همان نرخ بازار آزاد است، به تومان.
          </p>
          <div className="mt-6">
            <Board />
          </div>
        </div>
      </section>
    </main>
  );
}
