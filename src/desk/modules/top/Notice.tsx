import type { ReactNode } from "react";
import { cn } from "../../ui";

export default function Notice({ tone, children }: { tone: "ok" | "error" | "info"; children: ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"}
      className={cn("break-words rounded-xl border p-3 text-sm",
        tone === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-900",
        tone === "error" && "border-red-200 bg-red-50 text-red-800",
        tone === "info" && "border-blue-200 bg-blue-50 text-blue-900")}>
      {children}
    </p>
  );
}

