/** Kenyan mobile -> local '07XXXXXXXX' / '01XXXXXXXX', or null when invalid. Same rules as the server. */
export function toLocalKePhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("254")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  return /^[71]\d{8}$/.test(d) ? `0${d}` : null;
}
