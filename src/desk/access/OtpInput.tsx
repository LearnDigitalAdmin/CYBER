import { cn, inputClass } from "../ui";

/** Six-digit code field: numeric keypad on phones, one-time-code autofill, digits only. */
export function OtpInput({ id, value, onChange, onEnter, disabled, invalid }: {
  id: string; value: string; onChange: (v: string) => void; onEnter?: () => void; disabled?: boolean; invalid?: boolean;
}) {
  return (
    <input
      id={id} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6}
      value={value} disabled={disabled} aria-invalid={invalid || undefined} placeholder="••••••"
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      onKeyDown={(e) => { if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(); } }}
      className={cn(inputClass, "text-center text-xl font-semibold tracking-[0.5em]", invalid && "border-red-500")}
    />
  );
}
