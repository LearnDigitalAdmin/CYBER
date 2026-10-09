import type { ReactNode } from "react";
import { cn } from "./cn";

const TONES = {
  gray: "bg-gray-100 text-gray-700", green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800", red: "bg-red-100 text-red-800", blue: "bg-blue-100 text-blue-800",
} as const;
export function Badge({ tone = "gray", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={cn("inline-flex max-w-full items-center truncate rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[tone])}>{children}</span>;
}
