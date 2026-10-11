/** Reading the agent's file in the browser. Nothing leaves the device until the records are checked and paid for. */
import { CsvError, parseCsv } from "./csv";
import { MAX_FILE_BYTES } from "./table";

export type FileKind = "xlsx" | "csv";

export function fileKind(file: File): FileKind | null {
  const n = file.name.toLowerCase();
  if (n.endsWith(".xlsx")) return "xlsx";
  if (n.endsWith(".csv")) return "csv";
  return null;
}

/** null when the file can be read, otherwise a message for the agent. */
export function fileProblem(file: File): string | null {
  if (file.name.toLowerCase().endsWith(".xls")) return "Older .xls files are not supported. In Excel choose Save As → Excel Workbook (.xlsx) or CSV, then pick that file.";
  if (!fileKind(file)) return "Choose an Excel (.xlsx) or CSV (.csv) file.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_FILE_BYTES) return `That file is larger than ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB. Split it into smaller files and import them one by one.`;
  return null;
}

/** UTF-8 when valid (the normal case); otherwise Windows-1252, which is what older Excel CSV exports use. */
export function decodeText(buf: ArrayBuffer): string {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { return new TextDecoder("windows-1252").decode(buf); }
}

// read-excel-file is typed loosely on purpose: only these two calls are used and cells are treated as unknown values.
interface XlsxLib {
  default: (input: File | Blob, options?: { sheet?: number | string }) => Promise<unknown[][]>;
  readSheetNames?: (input: File | Blob) => Promise<string[]>;
}
const loadXlsx = async (): Promise<XlsxLib> => (await import("read-excel-file")) as unknown as XlsxLib;

export interface LoadedFile { raw: unknown[][]; sheets: string[] }

/** `sheetIndex` is 0-based; ignored for CSV. */
export async function loadFile(file: File, sheetIndex: number): Promise<LoadedFile> {
  const kind = fileKind(file);
  if (kind === "csv") {
    try { return { raw: parseCsv(decodeText(await file.arrayBuffer())), sheets: [] }; }
    catch (e) { throw e instanceof CsvError ? e : new Error("We could not read that CSV file."); }
  }
  try {
    const lib = await loadXlsx();
    const sheets = lib.readSheetNames ? await lib.readSheetNames(file) : [];
    const raw = await lib.default(file, { sheet: sheetIndex + 1 });
    return { raw, sheets };
  } catch {
    throw new Error("We could not read that Excel file. Make sure it is a real .xlsx workbook (not renamed from another format), or save it as CSV.");
  }
}
