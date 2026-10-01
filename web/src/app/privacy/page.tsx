import type { Metadata } from "next";
import Link from "next/link";
import { GirihBackground } from "@/components/vibefarsi/girih";

export const metadata: Metadata = {
  title: "حریم خصوصی · دلارچنده",
  description: "خواندن نرخ حساب نمی‌خواهد. هشدار شناسه گفتگوی تلگرام را نگه می‌دارد. کلید API فقط به‌صورت درهم ذخیره می‌شود.",
};

const facts = [
  ["حسابی نیست", "خواندن نرخ در سایت و در ربات حساب، ایمیل یا رمز نمی‌خواهد."],
  ["هشدار", "با /alert شناسه گفتگوی تلگرام، نماد، جهت، آستانه و حالت یک‌بار یا تکراری ذخیره می‌شود. /unalert همان ردیف را پاک می‌کند."],
  ["کلید", "کلید را ربات یک بار نشان می‌دهد. در پایگاه فقط درهم SHA-256 آن، به همراه همان شناسه گفتگو، می‌ماند."],
  ["فروشگاه", "کاتالوگ ووکامرس و ارزهای WHMCS روی سرور خودت می‌مانند. افزونه فقط نرخ را می‌گیرد و قیمت را همان‌جا می‌نویسد."],
  ["نرخ", "عددها نرخ بازار آزاد به تومان‌اند. توصیه خرید یا فروش نیستند."],
] as const;

export default function PrivacyPage() {
  return (
    <main>
      <section className="totem-scene relative overflow-hidden">
        <GirihBackground className="opacity-30" />
        <div className="relative mx-auto max-w-3xl px-4 py-12 lg:py-16">
          <p className="text-sm font-medium text-foreground/70">حریم خصوصی</p>
          <h1 className="mt-3 text-4xl font-semibold leading-[1.35]">چه چیزی نگه داشته می‌شود.</h1>
          <p className="mt-4 max-w-[46ch] leading-8 text-foreground/75">
            دلارچنده نرخ بازار آزاد را منتشر می‌کند. این صفحه فقط همان چیزی است که برنامه واقعاً ذخیره می‌کند.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-12">
        <ul className="grid gap-3">
          {facts.map(([title, body]) => (
            <li key={title} className="rounded-[16px] border border-border bg-card px-5 py-5">
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 leading-8 text-foreground/75">{body}</p>
            </li>
          ))}
        </ul>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">ربات و گروه</h2>
          <p className="mt-3 leading-8 text-foreground/75">
            تنظیمات ربات، زبان و کارمزد پیش‌فرض را با همان شناسه گفتگو نگه می‌دارد. اگر مدیر گروه /every بگذارد، شناسه گروه، فاصله و در صورت نیاز یک نماد ذخیره می‌شود. پست گروه بی‌صدا است. کانال یک فهرست سنجاق‌شده و عمومی است.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">درخواست از سایت</h2>
          <p className="mt-3 leading-8 text-foreground/75">
            تابلوی سایت از مبدأ dollarchande.live بدون کلید نرخ را می‌خواند. سقف این خواندن با نشانی اتصال اعمال می‌شود و آن نشانی در جدول‌های ما نوشته نمی‌شود. بقیه کلاینت‌ها کلید می‌فرستند. سقف هر کلید حدود ۶۰ درخواست در دقیقه است. سایت ابزار تحلیل جداگانه‌ای نمی‌گذارد.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">میزبانی</h2>
          <p className="mt-3 leading-8 text-foreground/75">
            سایت روی Cloudflare Pages است و API روی Cloudflare Workers. اتصال از شبکه Cloudflare می‌گذرد. ما برای این سرویس حساب کاربری نمی‌سازیم و فهرست کالاها را دریافت نمی‌کنیم.
          </p>
          <p className="mt-4 text-sm">
            <Link href="/terms/" className="font-semibold text-brand">
              شرایط استفاده
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
