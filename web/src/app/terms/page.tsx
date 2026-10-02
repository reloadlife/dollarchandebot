import type { Metadata } from "next";
import Link from "next/link";
import { PageWash } from "@/components/page-wash";
import { GirihBackground } from "@/components/vibefarsi/girih";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "شرایط استفاده · دلارچنده",
  description: "نرخ‌ها بازار آزاد به تومان‌اند و توصیه مالی نیستند. افزونه‌ها رایگان‌اند و کلید ربات می‌خواهند.",
  path: "/terms/",
});

const points = [
  ["نرخ", "عدد منتشرشده نرخ بازار آزاد به تومان است، نه نرخ بانک و نه توصیه خرید یا فروش. ممکن است دیر برسد یا برای یک نماد خالی باشد."],
  ["مسئولیت قیمت", "قیمتی که روی قفسه، فاکتور یا برگه می‌گذاری مال فروشگاه توست. افزونه فقط پایه را در نرخ و ضریب ضرب می‌کند."],
  ["کلید", "خواندن تابلو در سایت حساب نمی‌خواهد. افزونه و هر برنامه دیگری باید کلید ربات را بفرستد، وگرنه پاسخ ۴۰۱ است."],
  ["هشدار", "اعلان تلگرام وقتی می‌آید که قیمت در دسترس باشد و شرط برقرار شود. یک‌بار بعد از اعلان حذف می‌شود. تضمین نمی‌کنیم هیچ حرکتی از دست نرود."],
  ["سقف", "هر کلید حدود ۶۰ درخواست در دقیقه دارد. خواندن از خود سایت هم سقف دارد. پاسخ اضافی ۴۲۹ است."],
] as const;

export default function TermsPage() {
  return (
    <main>
      <section className="totem-scene relative overflow-hidden">
        <PageWash />
        <GirihBackground className="opacity-30" />
        <div className="relative z-10 mx-auto max-w-3xl px-4 py-12 lg:py-16">
          <p className="text-sm font-medium text-foreground/70">شرایط استفاده</p>
          <h1 className="mt-3 text-4xl font-semibold leading-[1.35]">نرخ آزاد است. تصمیم با توست.</h1>
          <p className="mt-4 max-w-[46ch] leading-8 text-foreground/75">
            استفاده از سایت، ربات، کانال، API و افزونه‌ها یعنی همین شرط‌ها. سرویس رایگان است و حساب نمی‌خواهد.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-12">
        <ul className="grid gap-3">
          {points.map(([title, body]) => (
            <li key={title} className="rounded-[16px] border border-border bg-card px-5 py-5">
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 leading-8 text-foreground/75">{body}</p>
            </li>
          ))}
        </ul>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">افزونه‌ها</h2>
          <p className="mt-3 leading-8 text-foreground/75">
            وردپرس، ووکامرس و WHMCS رایگان‌اند و هر کدام یک کار می‌کنند: نرخ را بخوانند و همان را نشان بدهند یا در قیمت بنویسند. اگر نرخ خارج از بازه منطقی باشد، قیمت ذخیره‌شده عوض نمی‌شود. کاتالوگ فروشگاه برای ما فرستاده نمی‌شود.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">ادامه کار</h2>
          <p className="mt-3 leading-8 text-foreground/75">
            مسیرهای عمومی API همان‌هایی است که در راهنما نوشته شده. نمودار PNG کلید نمی‌خواهد. اگر سرویسی برای مدتی در دسترس نباشد، تعهد جبران خسارت نداریم. این متن قرارداد مالی نیست.
          </p>
          <p className="mt-4 text-sm">
            <Link href="/privacy/" className="font-semibold text-brand">
              حریم خصوصی
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
