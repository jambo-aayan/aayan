export function formatGBP(value: number, wholeNumber = false): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: wholeNumber ? 0 : 2,
  }).format(value);
}
