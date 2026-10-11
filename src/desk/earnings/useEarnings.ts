import { useEffect, useMemo, useState } from "react";
import { deskApi, type GetEarningsOut } from "../api";
import { messageOf } from "../modules/comms/lib/messages";
import { subscribeCyberIncome, subscribeLedger } from "./liveData";
import { rangeFor, type CyberIncomeRow, type LedgerRow, type RangeKey } from "./model";

export type Async<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };
export interface Windowed<T> { rows: T[]; truncated: boolean }

export interface EarningsData {
  totals: Async<GetEarningsOut>;
  ledger: Async<Windowed<LedgerRow>>;
  cyber: Async<Windowed<CyberIncomeRow>>;
  /** The range the totals were asked for. */
  from: number; to: number;
}

/**
 * Server totals for a range (desk_getEarnings), the live ledger (desk_ledger) and PAY's cyber-income, together. The totals are
 * asked for again whenever the ledger changes, so a new settlement or a payout moving along shows up without a refresh.
 */
export function useEarnings(agentId: string, range: RangeKey): EarningsData {
  const [totals, setTotals] = useState<Async<GetEarningsOut>>({ state: "loading" });
  const [ledger, setLedger] = useState<Async<Windowed<LedgerRow>>>({ state: "loading" });
  const [cyber, setCyber] = useState<Async<Windowed<CyberIncomeRow>>>({ state: "loading" });
  const [anchor, setAnchor] = useState(() => Date.now());

  useEffect(() => {
    setLedger({ state: "loading" });
    return subscribeLedger(agentId, (rows, truncated) => setLedger({ state: "ready", data: { rows, truncated } }),
      () => setLedger({ state: "error", message: "We couldn't load your ledger. Check your connection and try again." }));
  }, [agentId]);
  useEffect(() => {
    setCyber({ state: "loading" });
    return subscribeCyberIncome(agentId, (rows, truncated) => setCyber({ state: "ready", data: { rows, truncated } }),
      () => setCyber({ state: "error", message: "We couldn't load your payment records. Check your connection and try again." }));
  }, [agentId]);

  const { from, to } = useMemo(() => rangeFor(range, anchor), [range, anchor]);
  useEffect(() => { setAnchor(Date.now()); }, [range]);

  const signature = ledger.state === "ready" ? ledger.data.rows.map((r) => `${r.entryId}:${r.status}:${r.amountMinor}`).join("|") : "";
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      deskApi.getEarnings({ from, to })
        .then((data) => { if (live) setTotals({ state: "ready", data }); })
        .catch((e: unknown) => { if (live) setTotals((prev) => (prev.state === "ready" ? prev : { state: "error", message: messageOf(e) })); });
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [from, to, signature]);

  return { totals, ledger, cyber, from, to };
}
