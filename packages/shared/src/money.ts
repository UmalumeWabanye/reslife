/** All money is stored as integer cents (ZAR). */
export function formatZar(cents: number): string {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(cents / 100);
}
