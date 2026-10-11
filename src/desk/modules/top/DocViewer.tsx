import { useEffect, useState } from "react";
import { deskApi, DeskApiError } from "../../api";
import type { DocKind } from "../../api";
import { Modal, buttonClass } from "../../ui";
import Notice from "./Notice";
import { DOC_NAMES } from "./logic";

function toBlobUrl(base64: string, contentType: string): string {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: contentType }));
}

/** Fetches one registration document through `getDoc` (audited server-side) and shows an image or a PDF. */
export default function DocViewer({ deskCode, kind, onClose }: { deskCode: string; kind: DocKind | null; onClose: () => void }) {
  const [state, setState] = useState<{ url: string; type: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!kind) return;
    let alive = true; let url: string | null = null;
    setState(null); setError(null); setLoading(true);
    deskApi.top.getDoc({ deskCode, kind })
      .then((d) => { if (!alive) return; url = toBlobUrl(d.dataBase64, d.contentType); setState({ url, type: d.contentType }); })
      .catch((e) => { if (alive) setError(e instanceof DeskApiError ? e.message : "Could not open that document."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [deskCode, kind]);

  if (!kind) return null;
  return (
    <Modal open title={`${DOC_NAMES[kind] ?? kind} · ${deskCode}`} onClose={onClose}
      footer={state ? <a href={state.url} target="_blank" rel="noreferrer" className={buttonClass.secondary}>Open in a new tab</a> : undefined}>
      {loading && <div className="flex justify-center py-10" role="status" aria-label="Loading"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" /></div>}
      {error && <Notice tone="error">{error}</Notice>}
      {state && (state.type === "application/pdf"
        ? <iframe title="Document" src={state.url} className="h-[60dvh] w-full min-w-0 rounded-lg border border-gray-200" />
        : <img src={state.url} alt={DOC_NAMES[kind] ?? kind} className="mx-auto max-h-[60dvh] w-auto max-w-full rounded-lg object-contain" />)}
    </Modal>
  );
}
