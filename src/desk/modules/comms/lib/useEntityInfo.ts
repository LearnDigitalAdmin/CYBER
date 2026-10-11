import { useCallback, useEffect, useState } from "react";
import { callDesk, type GetEntityInfoOut } from "../../../api";
import { messageOf } from "./messages";

export type EntityInfoState =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "ready"; info: GetEntityInfoOut };

/** What the customer's plan offers (audiences, report types, exports, SMS credits), fetched once per session. */
export function useEntityInfo(sessionId: string): EntityInfoState {
  const [state, setState] = useState<EntityInfoState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    callDesk("desk_getEntityInfo", { sessionId })
      .then((info) => { if (live) setState({ status: "ready", info }); })
      .catch((e: unknown) => { if (live) setState({ status: "error", message: messageOf(e), retry }); });
    return () => { live = false; };
  }, [sessionId, attempt, retry]);
  return state;
}
