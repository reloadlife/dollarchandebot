export function calculatePrice(base: string, rate: number | null | undefined, multiplier: string): number | null {
  if (!base.trim() || !multiplier.trim() || rate == null || !Number.isFinite(rate) || rate <= 0) return null;
  const amount = Number(base);
  const factor = Number(multiplier);
  const total = amount * rate * factor;
  return Number.isFinite(amount) && amount >= 0 && Number.isFinite(factor) && factor > 0 && Number.isFinite(total) && total <= Number.MAX_SAFE_INTEGER ? Math.round(total) : null;
}
