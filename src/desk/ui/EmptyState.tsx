import type { ReactNode } from "react";

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center">
      <p className="break-words text-base font-semibold text-gray-800">{title}</p>
      {body && <p className="mt-1 max-w-md break-words text-sm text-gray-600">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
