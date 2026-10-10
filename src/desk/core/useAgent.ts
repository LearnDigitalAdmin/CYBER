import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../services/firebaseService";
import { watchAgent } from "../api/watch";
import type { AgentView } from "../api/contract";

/** The signed-in user's desk record: `undefined` while loading, `null` when they are not a desk. Live. */
export function useAgent(): AgentView | null | undefined {
  const [agent, setAgent] = useState<AgentView | null | undefined>(undefined);
  useEffect(() => {
    let stop: (() => void) | undefined;
    const off = onAuthStateChanged(auth, (u) => {
      stop?.();
      if (!u) { setAgent(null); return; }
      stop = watchAgent(u.uid, setAgent);
    });
    return () => { off(); stop?.(); };
  }, []);
  return agent;
}
