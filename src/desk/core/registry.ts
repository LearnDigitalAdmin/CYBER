/**
 * Desk modules register themselves by existing: any file named `desk.module.tsx` anywhere under src/desk
 * default-exports `defineDeskModule({...})`. No shared route or nav list exists to edit, so parallel tasks
 * cannot conflict.
 */
import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

export interface DeskModule {
  /** URL segment under /desk, e.g. "import" -> /desk/import. Lowercase letters, digits, hyphens. */
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Lower comes first in navigation and on the home screen. */
  order: number;
  /** Show in the phone bottom bar (the first 3 by order win). */
  primary?: boolean;
  /** Usually React.lazy(() => import("./Screen")) so each module is its own chunk. */
  component: ComponentType;
}

const PATH = /^[a-z][a-z0-9-]*$/;

export function defineDeskModule(m: DeskModule): DeskModule {
  if (!PATH.test(m.path)) throw new Error(`Invalid desk module path "${m.path}"`);
  return m;
}

export function buildModuleList(mods: DeskModule[]): DeskModule[] {
  const seen = new Set<string>();
  for (const m of mods) {
    if (seen.has(m.path)) throw new Error(`Duplicate desk module path "${m.path}"`);
    seen.add(m.path);
  }
  return [...mods].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

const found = import.meta.glob<{ default: DeskModule }>("../**/desk.module.tsx", { eager: true });
export const DESK_MODULES: DeskModule[] = buildModuleList(Object.values(found).map((f) => f.default));
