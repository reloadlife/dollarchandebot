import type { Metadata } from "next";
import Link from "next/link";
import { BOT_URL, PLUGIN_ZIP } from "@/lib/rates";
import { jsonLd, pageMeta, SITE } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "قیمت دلار ووکامرس · دلارچنده",
  description: "افزونه رایگان ووکامرس. قیمت کالا از نرخ بازار آزاد دلار به تومان نوشته می‌شود. پایه ضربدر نرخ ضربدر ضریب.",
  path: "/woocommerce/",
});

const steps = [
  "افزونه را از پیشخوان بارگذاری کن و فعال کن. ووکامرس باید از قبل نصب باشد.",
  "در ربات /key را بفرست. کلید را در ووکامرس، دلارچنده بگذار.",
  "روی کالا «به‌روزرسانی با دلارچنده» را روشن کن و قیمت پایه را به دلار بنویس.",
] as const;

const graph = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "دلارچنده برای ووکامرس",
  applicationCategory: "BusinessApplication",
  operatingSystem: "WooCommerce",
  offers: { "@type": "Offer", price: "0", priceCurrency: "IRR" },
  url: `${SITE}/woocommerce/`,
  description: "قیمت دلار ووکامرس از نرخ بازار آزاد. پایه ضربدر نرخ ضربدر ضریب، به تومان.",
  isAccessibleForFree: true,
  provider: { "@id": `${SITE}/#organization` },
};

export default function WooPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph) }} />
      <p className="text-sm font-semibold text-brand">ووکامرس</p>
      <h1 className="mt-2 text-4xl font-semibold leading-[1.35]">قیمت دلار ووکامرس</h1>
      <p className="mt-4 max-w-[46ch] leading-8 text-foreground/75">
        قیمت کالا از نرخ بازار آزاد دلار نوشته می‌شود. پایه را به دلار می‌نویسی. افزونه قیمت تومان را می‌سازد.
      </p>
      <div className="totem-well mt-6 rounded-[16px] px-4 py-5">
        <p className="text-xs text-[oklch(0.84_0.05_85)]">حساب قیمت</p>
        <p className="mt-2 text-lg font-medium text-[oklch(0.92_0.16_88)]">پایه × نرخ × ضریب</p>
        <p className="mt-2 text-sm text-[oklch(0.84_0.05_85)]">برای تومان ضریب ۱ است. برای ریال ضریب ۱۰ است.</p>
      </div>
      <a
        href={PLUGIN_ZIP.woocommerce}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-[16px] bg-brand px-4 text-sm font-semibold text-brand-foreground"
      >
        دریافت افزونه
      </a>
      <ol className="mt-8 grid gap-3">
        {steps.map((step, index) => (
          <li key={step} className="rounded-[16px] border border-border bg-card px-5 py-4 leading-8">
            <span className="font-semibold text-brand">{index + 1}. </span>
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-6 leading-8 text-foreground/75">
        هر ساعت یک دور اجرا می‌شود. «همگام‌سازی الان» همان کار را همان لحظه می‌کند. قیمت حراج دست نمی‌خورد.
      </p>
      <p className="mt-4 leading-8 text-foreground/75">
        افزونه برای خواندن نرخ به api.dollarchande.live وصل می‌شود. کلید و نماد را می‌فرستد. سفارش و مشتری را نمی‌فرستد.
      </p>
      <p className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
        <a href={BOT_URL} className="text-brand">
          گرفتن کلید
        </a>
        <Link href="/docs/#woocommerce" className="text-brand">
          راهنمای نصب
        </Link>
      </p>
    </main>
  );
}
