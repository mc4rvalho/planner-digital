// Parse text into integer cents without floating-point rounding or locale ambiguity.
export function parseAmount(input: string): number | null {
  const value = input.trim().replace(/\s/g, "");
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(/[.,]/);
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 999999999
    ? cents
    : null;
}
export function amountText(cents: number) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
