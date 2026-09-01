export function formatGBP(value: number, wholeNumber = false): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: wholeNumber ? 0 : 2,
  }).format(value);
}

/** Day + short month, no year — the compact date shown alongside a
 * transfer-candidate label (LinkTransferForm, TransferSuggestionsBanner). */
export function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}
