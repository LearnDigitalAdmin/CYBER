/** Pure message-id de-duplication (WhatsApp retries the same webhook when a reply is slow). */
export const DEDUP_KEEP = 25;

export function dedupDecision(seen: string[] | undefined, id: string): { duplicate: boolean; next: string[] } {
  const list = Array.isArray(seen) ? seen : [];
  if (id && list.includes(id)) return { duplicate: true, next: list };
  return { duplicate: false, next: id ? [...list, id].slice(-DEDUP_KEEP) : list };
}
