import { useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowLeft, Home, MoreHorizontal } from "lucide-react";
import { DESK_MODULES, visibleModules } from "./registry";
import { useAgent } from "./useAgent";
import { Modal } from "../ui";
import { cn } from "../ui/cn";

const linkBase = "flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium";
const toItem = (m: (typeof DESK_MODULES)[number]) => ({ to: `/desk/${m.path}`, label: m.label, icon: m.icon, end: false });
const HOME = { to: "/desk", label: "Home", icon: Home, end: true };
/** Way back out of the desk to the main CYBER dashboard. */
const MAIN_DASH = "/dashboard";

/** Sidebar from md up; bottom tab bar (Home + up to 3 + More) on phones. */
export default function Frame({ children }: { children: ReactNode }) {
  const [more, setMore] = useState(false);
  const agent = useAgent();
  const mods = visibleModules(DESK_MODULES, agent?.agentCode);
  const items = [HOME, ...mods.map(toItem)];
  const bottom = [HOME, ...mods.filter((m) => m.primary).slice(0, 3).map(toItem)];
  return (
    <div className="flex min-h-screen min-w-0 bg-gray-50">
      <aside className="hidden w-60 shrink-0 border-r border-gray-200 bg-white p-3 md:block">
        <Link to={MAIN_DASH} className={cn(linkBase, "mb-2 border border-gray-200 text-gray-700 hover:bg-gray-100")}>
          <ArrowLeft size={18} className="shrink-0" /><span className="min-w-0 truncate">Main dashboard</span>
        </Link>
        <p className="mb-3 truncate px-3 text-sm font-bold text-gray-900">Samuhia Desk</p>
        <nav className="space-y-1" aria-label="Desk">
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => cn(linkBase, isActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100")}>
              <n.icon size={18} className="shrink-0" /><span className="min-w-0 truncate">{n.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
      <nav aria-label="Desk" className="fixed inset-x-0 bottom-0 z-40 grid grid-flow-col auto-cols-fr border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {bottom.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => cn("flex min-w-0 flex-col items-center gap-0.5 px-1 py-2 text-[11px]", isActive ? "text-blue-700" : "text-gray-600")}>
            <n.icon size={20} /><span className="max-w-full truncate">{n.label}</span>
          </NavLink>
        ))}
        <button type="button" onClick={() => setMore(true)} className="flex min-w-0 flex-col items-center gap-0.5 px-1 py-2 text-[11px] text-gray-600">
          <MoreHorizontal size={20} /><span>More</span>
        </button>
      </nav>
      <Modal open={more} title="Desk menu" onClose={() => setMore(false)}>
        <ul className="space-y-1">
          <li>
            <Link to={MAIN_DASH} onClick={() => setMore(false)}
              className={cn(linkBase, "min-h-11 border border-gray-200 text-gray-800 hover:bg-gray-100")}>
              <ArrowLeft size={18} className="shrink-0" /><span className="min-w-0 truncate">Main dashboard</span>
            </Link>
          </li>
          {items.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} end={n.end} onClick={() => setMore(false)}
                className={({ isActive }) => cn(linkBase, "min-h-11", isActive ? "bg-blue-50 text-blue-700" : "text-gray-800 hover:bg-gray-100")}>
                <n.icon size={18} className="shrink-0" /><span className="min-w-0 truncate">{n.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
