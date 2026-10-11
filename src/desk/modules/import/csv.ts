/**
 * Small, strict CSV reader (RFC 4180 style): UTF-8 BOM, quoted fields with commas / newlines / doubled quotes, CRLF, LF or CR
 * line ends, and comma / semicolon / tab delimiters (Excel in many locales writes semicolons). Pure.
 */
export class CsvError extends Error {
  constructor(message: string) { super(message); this.name = "CsvError"; }
}

const DELIMITERS = [",", ";", "\t"] as const;

/** The delimiter that appears most (outside quotes) on the first non-empty line. Comma wins ties. */
export function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  let seenContent = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { inQuotes = !inQuotes; seenContent = true; continue; }
    if (!inQuotes && (c === "\n" || c === "\r")) { if (seenContent) break; continue; }
    if (!inQuotes && (DELIMITERS as readonly string[]).includes(c)) counts[c]++;
    if (c !== " " && c !== "\t") seenContent = true;
  }
  let best = ","; let max = counts[","];
  for (const d of [";", "\t"]) if (counts[d] > max) { best = d; max = counts[d]; }
  return best;
}

export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false; // distinguishes an empty quoted field from nothing
  let line = 1;

  const endField = () => { row.push(field); field = ""; fieldStarted = false; };
  const endRow = () => { endField(); rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else {
        if (c === "\n") line++;
        field += c;
      }
      continue;
    }
    if (c === '"' && field === "" ) { inQuotes = true; fieldStarted = true; continue; }
    if (c === delim) { endField(); continue; }
    if (c === "\r") { if (text[i + 1] === "\n") i++; line++; endRow(); continue; }
    if (c === "\n") { line++; endRow(); continue; }
    field += c; fieldStarted = true;
  }
  if (inQuotes) throw new CsvError(`A quoted value is never closed (it starts near line ${line}). Fix the quotes in the file and try again.`);
  if (fieldStarted || field !== "" || row.length > 0) endRow();
  return rows;
}
