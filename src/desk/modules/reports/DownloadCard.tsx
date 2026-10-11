import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Card } from "../../ui";
import { formatRemaining } from "./reportLogic";

/** A ready file. The link is short-lived, so the card counts down and stops offering it once it has expired. */
export function DownloadCard({ title, url, expiresAt }: { title: string; url: string; expiresAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = formatRemaining(expiresAt, now);
  return (
    <Card>
      <div className="min-w-0 space-y-2" role="status" aria-live="polite">
        <p className="break-words text-sm font-semibold text-gray-900">{title}</p>
        {left ? (
          <>
            <a href={url} target="_blank" rel="noopener noreferrer" download
              className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
              <Download size={18} /> Download
            </a>
            <p className="text-xs text-gray-500">This link expires in {left}.</p>
          </>
        ) : <p className="break-words text-sm text-amber-800">This link has expired. Run it again to get a new one.</p>}
      </div>
    </Card>
  );
}
