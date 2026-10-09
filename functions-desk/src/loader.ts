import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Folders that hold shared code, not deployable areas. */
export const RESERVED_DIRS: ReadonlySet<string> = new Set(["kernel", "paystack", "__tests__"]);
const MAX_DEPTH = 3;

/**
 * Auto-registers every deployable area: any folder with an `index.js` (compiled) is loaded and its exports named
 * `desk_*` are published. Adding an area is just adding a folder, so parallel tasks never edit a shared barrel.
 * Names without the `desk_` prefix are not published (they would collide with PAY/PMS in the shared project).
 */
export function loadAreas(rootDir: string, target: Record<string, unknown>, depth = 0): string[] {
  const loaded: string[] = [];
  if (depth > MAX_DEPTH) return loaded;
  for (const name of readdirSync(rootDir).sort()) {
    const dir = join(rootDir, name);
    if (RESERVED_DIRS.has(name) || !statSync(dir).isDirectory()) continue;
    const entry = join(dir, "index.js");
    if (existsSync(entry)) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(entry) as Record<string, unknown>;
      for (const [exportName, value] of Object.entries(mod)) {
        if (!exportName.startsWith("desk_")) continue;
        if (exportName in target) throw new Error(`Duplicate desk function export "${exportName}" (area ${name})`);
        target[exportName] = value;
      }
      loaded.push(dir);
    }
    loaded.push(...loadAreas(dir, target, depth + 1));
  }
  return loaded;
}
