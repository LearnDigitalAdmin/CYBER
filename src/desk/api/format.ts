/** Minor units (KES x 100) -> "KES 1,234.50". Mirrors functions-desk/src/money.ts formatKes. */
export function formatKes(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}KES ${whole}.${String(abs % 100).padStart(2, "0")}`;
}
export function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ms));
}
