import type { ReactNode } from "react";
import { cn } from "./cn";

export function Card({ title, children, className, footer }: {
  title?: string; children: ReactNode; className?: string; footer?: ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-gray-200 bg-white shadow-sm", className)}>
      {title && <h2 className="break-words border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-800 sm:px-5">{title}</h2>}
      <div className="min-w-0 p-4 sm:p-5">{children}</div>
      {footer && <div className="min-w-0 border-t border-gray-100 px-4 py-3 sm:px-5">{footer}</div>}
    </section>
  );
}
