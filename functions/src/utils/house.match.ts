/**
 * House to Rent: forgiving area matching. Pure functions, no I/O.
 *
 * A tenant types an area ("mirer", "navsha", "naivasa", "NAIVASHA") and it must find a property whose address is
 * "Mirera, Naivasha". Matching is per word: any word of the address that resembles a word the tenant typed counts.
 * Resemblance = same word, a prefix, the same consonant skeleton ("navsha" ~ "naivasha"), or a small edit distance.
 */

/** Words that say nothing about WHERE a property is. Ignored on both sides. */
const STOP = new Set([
  'the', 'and', 'for', 'off', 'near', 'next', 'opposite', 'behind', 'along', 'area', 'town', 'county', 'estate', 'road', 'rd', 'street',
  'st', 'avenue', 'ave', 'lane', 'drive', 'close', 'court', 'house', 'houses', 'apartment', 'apartments', 'plot', 'plots', 'block',
  'floor', 'kenya', 'kwa', 'wa', 'ya', 'na', 'of', 'in', 'at', 'to', 'rent', 'nyumba',
]);

/** Lower-case, accents removed, everything that is not a letter or digit becomes a space. */
export function normalizeText(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Meaningful words: at least 3 characters, not a stop word, not a bare number. */
export function areaTokens(s: string): string[] {
  const all = normalizeText(s).split(' ').filter(Boolean);
  const kept = all.filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t));
  // "road" or "estate" alone is still something the tenant typed: fall back to every word of 3+ letters
  return kept.length ? kept : all.filter((t) => t.length >= 3 && !/^\d+$/.test(t));
}

/** Consonant skeleton with the common Kenyan spelling swaps folded: navsha / naivasha -> nvsh, mirer / mirera -> mr. */
export function skeleton(word: string): string {
  const s = word
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/ch/g, '#')
    .replace(/c/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/q/g, 'k')
    .replace(/z/g, 's')
    .replace(/#/g, 'c');
  if (!s) return '';
  return (s[0] + s.slice(1).replace(/[aeiouy]/g, '')).replace(/(.)\1+/g, '$1');
}

/** Optimal string alignment distance (insert, delete, replace, swap two neighbours). */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array<number>(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

/** How many typos a word of this length may carry: short words get none, so "rongai" never matches "ongata". */
function allowedTypos(len: number): number {
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  if (len <= 8) return 2;
  return 3;
}

/** Does the typed word `q` resemble the address word `t`? Both are already normalized. */
export function wordMatches(q: string, t: string): boolean {
  if (!q || !t) return false;
  if (q === t) return true;
  // a half-typed or over-typed word: "mirer" / "mirera", "naivash" / "naivasha"
  if (q.length >= 4 && t.startsWith(q)) return true;
  if (t.length >= 4 && q.startsWith(t)) return true;
  const sq = skeleton(q);
  const st = skeleton(t);
  if (sq.length >= 3 && sq === st) return true;
  const shorter = Math.min(q.length, t.length);
  if (shorter >= 4 && editDistance(q, t) <= Math.min(allowedTypos(shorter), allowedTypos(Math.max(q.length, t.length)))) return true;
  if (sq.length >= 4 && st.length >= 4 && editDistance(sq, st) <= 1) return true;
  return false;
}

/** How many of the typed words resemble some word of the address. */
export function matchScore(queryWords: string[], addressWords: string[]): number {
  let score = 0;
  for (const q of queryWords) if (addressWords.some((t) => wordMatches(q, t))) score++;
  return score;
}

/**
 * Keep the best-matching candidates: everything that matched the MOST typed words (and at least one).
 * "mirera naivasha" therefore prefers a property that has both over one that only has "naivasha".
 */
export function bestMatches<T>(query: string, items: T[], addressOf: (item: T) => string): T[] {
  const q = areaTokens(query);
  if (!q.length) return [];
  const scored = items.map((item) => ({ item, score: matchScore(q, areaTokens(addressOf(item))) })).filter((x) => x.score > 0);
  if (!scored.length) return [];
  const top = Math.max(...scored.map((x) => x.score));
  return scored.filter((x) => x.score === top).map((x) => x.item);
}
