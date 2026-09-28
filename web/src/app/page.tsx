import Link from "next/link";
import { LiveHero } from "@/components/live-hero";
import { API_BASE, BOT_URL, CHANNEL_URL } from "@/lib/rates";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <p className="text-sm text-brand">بازار آزاد · تومان</p>
      <h1 className="mt-2 max-w-xl text-3xl leading-tight">نرخ ارز، طلا و تتر، هر پنج دقیقه.</h1>
      <p className="mt-3 max-w-lg text-muted-foreground">
        همان عددی که کانال و ربات نشان می‌دهند، این‌جا روی تابلو است و از API هم خوانده می‌شود.
      </p>

      <section className="mt-10 border-t border-border pt-8">
        <LiveHero />
      </section>

      <section className="mt-12 grid gap-8 border-t border-border pt-8 md:grid-cols-2">
        <div>
          <h2 className="text-lg">تابلو</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            همه‌ی نمادها، اختلاف با تیک قبل، و نمودار ۲۴ ساعت. صرافی‌های تتر جدا هستند: خرید یعنی تومانِ پرداختی.
          </p>
          <Link
            href="/board/"
            className="mt-4 inline-flex h-10 items-center rounded-control bg-brand px-4 text-sm font-semibold text-brand-foreground"
          >
            باز کردن تابلو
          </Link>
        </div>
        <div>
          <h2 className="text-lg">API</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            خواندنی و بدون کلید. پاسخ یک دقیقه در لبه‌ی شبکه cache می‌شود. واحد همه‌ی قیمت‌ها تومان است.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-card p-3 text-xs leading-6" dir="ltr">
            {`curl ${API_BASE}/api/v1/latest`}
          </pre>
          <Link
            href="/developers/"
            className="mt-4 inline-flex h-10 items-center rounded-control border border-input px-4 text-sm font-semibold"
          >
            راهنمای API
          </Link>
        </div>
      </section>

      <footer className="mt-16 flex gap-4 border-t border-border pt-6 text-sm text-muted-foreground">
        <a href={CHANNEL_URL}>کانال</a>
        <a href={BOT_URL}>ربات</a>
      </footer>
    </main>
  );
}
