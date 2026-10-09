import type { ReactNode } from "react";
import { cn } from "./cn";

/** Every desk screen is wrapped in this. min-w-0 + break-words prevents flex/grid overflow. */
export function Page({ title, subtitle, actions, children, className }: {
  title: string; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full min-w-0 max-w-6xl px-3 py-4 sm:px-6 sm:py-6", className)}>
      <header className="mb-4 flex min-w-0 flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-bold text-gray-900 sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 break-words text-sm text-gray-600">{subtitle}</p>}
        </div>
        {actions && <div className="flex min-w-0 flex-wrap gap-2">{actions}</div>}
      </header>
      <div className="min-w-0 space-y-4 sm:space-y-6">{children}</div>
    </div>
  );
}
