import type { ReactNode } from "react";

export function FormField({ label, htmlFor, hint, error, children }: {
  label: string; htmlFor: string; hint?: string; error?: string | null; children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block break-words text-sm font-medium text-gray-800">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 break-words text-xs text-gray-500">{hint}</p>}
      {error && <p role="alert" className="mt-1 break-words text-xs text-red-600">{error}</p>}
    </div>
  );
}
/** Shared input look: full width, 44px touch height, no overflow. */
export const inputClass =
  "block h-11 w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100";
export const buttonClass = {
  primary: "inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50",
  secondary: "inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50",
  danger: "inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50",
} as const;
