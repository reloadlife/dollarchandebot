// Allow two missed ten-minute scrapes before warning.
export function freshness(updatedAt: number | null | undefined, now: number) {
  if (!updatedAt || !Number.isFinite(updatedAt)) return { stale: true, text: "زمان نرخ مشخص نیست" };
  const ms = updatedAt < 1e12 ? updatedAt * 1000 : updatedAt;
  const minutes = Math.max(0, Math.floor((now - ms) / 60_000));
  const age = minutes < 1 ? "همین حالا" : `${minutes.toLocaleString("fa-IR")} دقیقه پیش`;
  return { stale: minutes >= 20, text: `${minutes >= 20 ? "نرخ قدیمی؛ " : "به‌روزرسانی: "}${age}` };
}
