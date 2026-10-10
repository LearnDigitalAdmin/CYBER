import { Link } from "react-router-dom";
import { DESK_MODULES, visibleModules } from "./registry";
import { useAgent } from "./useAgent";
import { EmptyState, Page } from "../ui";

export default function DeskHome() {
  const agent = useAgent();
  const mods = visibleModules(DESK_MODULES, agent?.agentCode);
  return (
    <Page title="Samuhia Desk" subtitle="Serve chamas, schools and landlords. Every action is verified with the customer's OTP.">
      {mods.length === 0 ? (
        <EmptyState title="No desk tools are installed" body="Desk tools appear here as they are deployed." />
      ) : (
        <ul className="grid min-w-0 grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
          {mods.map((m) => (
            <li key={m.path} className="min-w-0">
              <Link to={`/desk/${m.path}`} className="flex h-full min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow">
                <m.icon size={22} className="mt-0.5 shrink-0 text-blue-600" />
                <span className="min-w-0">
                  <span className="block break-words text-sm font-semibold text-gray-900">{m.label}</span>
                  <span className="mt-0.5 block break-words text-xs text-gray-600">{m.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
