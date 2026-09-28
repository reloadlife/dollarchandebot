import type { Metadata } from "next";
import { Board } from "@/components/board";

export const metadata: Metadata = { title: "تابلو · دلارچنده" };

export default function BoardPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl">تابلو</h1>
      <p className="mt-1 text-sm text-muted-foreground">به‌روزرسانی هر یک دقیقه از همان نرخ‌های ربات.</p>
      <div className="mt-6">
        <Board />
      </div>
    </main>
  );
}
