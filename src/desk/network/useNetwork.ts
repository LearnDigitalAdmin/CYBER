import { useCallback, useEffect, useState } from "react";
import { deskApi } from "../api";
import type { NetDashboardOut } from "../api";
import { errorMessage } from "../access/errors";

export type NetState = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: NetDashboardOut };

/** Loads the signed-in agent's role dashboard once, and again on `reload()` (after an action). */
export function useNetworkDashboard(agentId: string | undefined): NetState & { reload: () => void } {
  const [s, setS] = useState<NetState>({ state: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!agentId) return;
    let live = true;
    deskApi.net.dashboard().then((data) => { if (live) setS({ state: "ready", data }); }).catch((e) => { if (live) setS({ state: "error", message: errorMessage(e) }); });
    return () => { live = false; };
  }, [agentId, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...s, reload };
}
