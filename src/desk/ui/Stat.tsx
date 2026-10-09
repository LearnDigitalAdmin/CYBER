import type { ReactNode } from "react";
import { cn } from "./cn";

export function Stat({ label, value, hint, tone = "default" }: {
  label: string; value: ReactNode; hint?: string; tone?: "default" | "good" | "warn";
}) {
  const color = tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-gray-900";
  return (
    <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="truncate text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={cn("mt-1 break-words text-xl font-bold sm:text-2xl", color)}>{value}</p>
      {hint && <p className="mt-1 break-words text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
/** Responsive stat row: 1 col on phones, 2 on small tablets, up to 4 on desktop. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">{children}</div>;
}
