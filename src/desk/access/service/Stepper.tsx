import { cn } from "../../ui";

/** Compact progress strip. Fits 360 px: labels truncate, bars carry the state. */
export function Stepper({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol className="grid min-w-0 gap-1" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Progress">
      {steps.map((label, i) => (
        <li key={label} aria-current={i === current ? "step" : undefined} className="min-w-0 text-center">
          <div className={cn("h-1.5 rounded-full", i <= current ? "bg-blue-600" : "bg-gray-200")} />
          <p className={cn("mt-1.5 truncate text-[11px] sm:text-xs", i === current ? "font-semibold text-gray-900" : "text-gray-500")}>{i + 1}. {label}</p>
        </li>
      ))}
    </ol>
  );
}
