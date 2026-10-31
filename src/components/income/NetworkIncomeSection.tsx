import { AlertCircle, Loader, Network } from "lucide-react";
import { Link } from "react-router-dom";
import { formatKes } from "../../desk/api/format";
import { useAgent } from "../../desk/core/useAgent";
import { useNetworkDashboard } from "../../desk/network/useNetwork";
import { ROLE_LABEL, incentiveGuide, series, tilesFor } from "../../desk/network/view";

const panel = "bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6";
const TONE = { good: "text-emerald-400", warn: "text-amber-400", default: "text-white" } as const;

/** Role-based network metrics for the main dashboard's Income tab. Renders nothing for people who are not desk agents. */
export default function NetworkIncomeSection() {
  const agent = useAgent();
  if (!agent) return null;
  return <Loaded agentId={agent.agentId} />;
}

function Loaded({ agentId }: { agentId: string }) {
  const n = useNetworkDashboard(agentId);
  const title = (
    <div className="flex items-center justify-between gap-2 mb-6">
      <div className="flex items-center gap-2"><Network className="w-5 h-5 text-cyan-400" /><h3 className="text-lg font-semibold text-white">Network &amp; Incentives</h3></div>
      <Link to="/desk/network" className="text-sm text-cyan-400 hover:underline">Manage team</Link>
    </div>
  );
  if (n.state === "loading") return <div className={panel}>{title}<div className="flex items-center gap-3 text-gray-400"><Loader className="w-5 h-5 animate-spin text-cyan-500" /><span role="status">Loading network metrics...</span></div></div>;
  if (n.state === "error") return <div className={panel}>{title}<div className="flex items-center gap-3"><AlertCircle className="w-5 h-5 text-red-400 shrink-0" /><span role="alert" className="text-red-400 break-words">{n.message}</span></div></div>;
  const d = n.data;
  const s = series(d, (x) => x.commissionMinor + x.overrideMinor + x.incentiveMinor);
  const max = Math.max(1, ...s.map((x) => x.minor));
  return (
    <div className={panel}>
      {title}
      <p className="text-sm text-gray-400 mb-4">{ROLE_LABEL[d.role]} desk {d.deskCode}{d.upline ? `, reporting to ${d.upline.name}` : ""}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tilesFor(d).map((t) => (
          <div key={t.label} className="p-4 bg-gray-700/20 rounded-lg border border-gray-700/50 min-w-0">
            <div className="text-sm text-gray-400 mb-1">{t.label}</div>
            <div className={`text-xl font-bold break-words ${TONE[t.tone ?? "default"]}`}>{t.value}</div>
            {t.hint && <div className="text-xs text-gray-500 mt-1">{t.hint}</div>}
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-end gap-2 h-24" role="img" aria-label="Earnings for the last six months">
        {s.map((x) => (
          <div key={x.month} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
            <div className="w-full rounded-t bg-cyan-500" style={{ height: `${Math.max(2, Math.round((x.minor / max) * 100))}%` }} title={`${x.month}: ${formatKes(x.minor)}`} />
            <span className="text-[10px] text-gray-500">{x.month.slice(5)}</span>
          </div>
        ))}
      </div>
      {d.margin && <p className="mt-4 text-sm text-gray-400 break-words">Network margin {d.margin.month}: Samuhia kept <span className="text-white font-semibold">{d.margin.retainedPct}%</span> (floor {d.margin.floorPct}%).</p>}
      <ul className="mt-4 space-y-1">
        {incentiveGuide(d.rules.incentives).map((r) => <li key={r.behaviour} className="text-xs text-gray-400 break-words"><span className="text-gray-300 font-medium">{r.behaviour}:</span> {r.rule}</li>)}
      </ul>
    </div>
  );
}
