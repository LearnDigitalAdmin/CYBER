import { useCallback, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { DOC_KINDS, DOC_MAX_BYTES, deskApi, DeskApiError, formatDateTime } from "../../api";
import type { DocKind, DocStatus } from "../../api";
import { Badge, Card, buttonClass } from "../../ui";
import Notice from "./Notice";
import { DOC_HINT, DOC_LABEL, checkDocFile, formatBytes } from "./logic";
import type { DocContentType } from "./logic";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Could not read that file."));
    r.onload = () => {
      const s = typeof r.result === "string" ? r.result : "";
      const i = s.indexOf(",");
      if (i < 0) reject(new Error("Could not read that file."));
      else resolve(s.slice(i + 1));
    };
    r.readAsDataURL(file);
  });
}

/** ID front, ID back and selfie: checked in the browser first, then stored through `uploadDoc`. */
export default function DocsSection() {
  const [docs, setDocs] = useState<DocStatus[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setDocs((await deskApi.listMyDocs()).docs); setLoadError(null); }
    catch (e) { setLoadError(e instanceof DeskApiError ? e.message : "Could not load your documents."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <Card title="Documents">
      <div className="min-w-0 space-y-4">
        <p className="break-words text-sm text-gray-600">Upload clear files, up to {formatBytes(DOC_MAX_BYTES)} each. Only the Samuhia team can see them.</p>
        {loadError && (
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Notice tone="error">{loadError}</Notice>
            <button type="button" onClick={() => void load()} className={buttonClass.secondary}>Try again</button>
          </div>
        )}
        {docs === null && !loadError ? (
          <div className="flex justify-center py-6" role="status" aria-label="Loading"><div className="h-7 w-7 animate-spin rounded-full border-b-2 border-blue-600" /></div>
        ) : (
          <ul className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-3">
            {DOC_KINDS.map((k) => <DocCard key={k} kind={k} status={docs?.find((d) => d.kind === k)} onUploaded={load} />)}
          </ul>
        )}
      </div>
    </Card>
  );
}

function DocCard({ kind, status, onUploaded }: { kind: DocKind; status: DocStatus | undefined; onUploaded: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [contentType, setContentType] = useState<DocContentType | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputId = `acc-doc-${kind}`;

  useEffect(() => {
    if (!file || !contentType || contentType === "application/pdf") { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, contentType]);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again
    setDone(false); setError(null);
    if (!f) return;
    try {
      const head = new Uint8Array(await f.slice(0, 16).arrayBuffer());
      const c = checkDocFile(kind, f.size, head);
      if (!c.ok) { setFile(null); setContentType(null); setError(c.error); return; }
      setFile(f); setContentType(c.contentType);
    } catch {
      setFile(null); setContentType(null); setError("Could not read that file.");
    }
  }

  async function upload() {
    if (!file || !contentType || busy) return;
    setBusy(true); setError(null); setDone(false);
    try {
      await deskApi.uploadDoc({ kind, contentType, dataBase64: await readBase64(file) });
      setFile(null); setContentType(null); setDone(true);
      await onUploaded();
    } catch (e) {
      setError(e instanceof DeskApiError ? e.message : e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="min-w-0 space-y-3 rounded-xl border border-gray-200 p-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <h3 className="min-w-0 break-words text-sm font-semibold text-gray-900">{DOC_LABEL[kind]}</h3>
        <Badge tone={status?.uploadedAt ? "green" : "amber"}>{status?.uploadedAt ? "Uploaded" : "Missing"}</Badge>
      </div>
      <p className="break-words text-xs text-gray-500">{DOC_HINT[kind]}</p>
      {status?.uploadedAt && (
        <p className="break-words text-xs text-gray-600">
          {formatDateTime(status.uploadedAt)}{status.sizeBytes ? ` · ${formatBytes(status.sizeBytes)}` : ""}{status.contentType ? ` · ${status.contentType.replace("application/", "").replace("image/", "").toUpperCase()}` : ""}
        </p>
      )}

      {file && (
        <div className="min-w-0 rounded-xl bg-gray-50 p-2">
          {previewUrl ? (
            <img src={previewUrl} alt={`Preview of ${DOC_LABEL[kind]}`} className="mx-auto max-h-48 w-auto max-w-full rounded-lg object-contain" />
          ) : (
            <div className="flex min-w-0 items-center gap-2 p-2 text-sm text-gray-700"><FileText size={20} className="shrink-0" /><span className="min-w-0 break-all">PDF · {file.name}</span></div>
          )}
          <p className="mt-1 break-all text-xs text-gray-500">{file.name} · {formatBytes(file.size)}</p>
        </div>
      )}

      <div className="flex min-w-0 flex-wrap gap-2">
        <label htmlFor={inputId} className={`${buttonClass.secondary} cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
          {file ? "Choose another" : status?.uploadedAt ? "Replace file" : "Choose file"}
        </label>
        <input id={inputId} type="file" accept={kind === "selfie" ? "image/jpeg,image/png,image/webp" : ACCEPT} className="sr-only" disabled={busy} onChange={(e) => void pick(e)} />
        {file && <button type="button" onClick={() => void upload()} disabled={busy} className={buttonClass.primary}>{busy ? "Uploading…" : "Upload"}</button>}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {done && <Notice tone="ok">Uploaded.</Notice>}
    </li>
  );
}
