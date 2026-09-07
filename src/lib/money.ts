// UAE VAT is 5% — matches the reference app's business rule. Kept as one
// constant so a future rate change is a one-line edit, not a search-and-replace.
export const VAT_RATE = 0.05;

/** Rounds to 2 decimal places the way money should be — avoids the
 *  classic floating-point 0.1 + 0.2 problem for display/storage. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calcVat(baseAmount: number) {
  const vatAmount = round2(baseAmount * VAT_RATE);
  const totalAmount = round2(baseAmount + vatAmount);
  return { vatAmount, totalAmount };
}

export function formatMoney(n: number | string): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  return new Intl.NumberFormat("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}
