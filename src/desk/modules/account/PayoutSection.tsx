import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { deskApi, DeskApiError } from "../../api";
import type { PayoutAccountStatus } from "../../api";
import { Badge, Card, buttonClass, cn } from "../../ui";
import Notice from "./Notice";
import { ACCOUNT_LABEL, ACCOUNT_NOTE } from "./logic";

/**
 * Payout accounts. `syncPayoutAccounts` both reports the state and creates any missing product account (for example the MyChama
 * one), so it runs once when this card opens and again on the Sync button. The MAIN account is created by the existing payment
 * setup in the dashboard, which this card links to rather than copying.
 */
export default function PayoutSection() {
  const [accounts, setAccounts] = useState<PayoutAccountStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(async () => {
    setSyncing(true); setError(null);
    try { setAccounts((await deskApi.syncPayoutAccounts()).accounts); }
    catch (e) { setError(e instanceof DeskApiError ? e.message : "Could not check your payout accounts."); }
    finally { setSyncing(false); }
  }, []);
  useEffect(() => { void sync(); }, [sync]);

  const mainReady = accounts?.find((a) => a.account === "main")?.ready === true;

  return (
    <Card title="Payout accounts"
      footer={
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 break-words text-sm text-gray-600">
            {mainReady ? "Your main payout account is set up." : "Your main payout account is created in your payment settings."}
            {" "}Open the dashboard and tap the gear icon (Payment Settings) at the top to {mainReady ? "update it" : "set it up"}.
          </p>
          <Link to="/dashboard" className={cn(buttonClass.secondary, "shrink-0")}>{mainReady ? "Update payment account" : "Set up payment account"}</Link>
        </div>
      }>
      <div className="min-w-0 space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        {accounts === null && !error ? (
          <div className="flex justify-center py-6" role="status" aria-label="Loading"><div className="h-7 w-7 animate-spin rounded-full border-b-2 border-blue-600" /></div>
        ) : accounts && (
          <ul className="min-w-0 space-y-2">
            {accounts.map((a) => (
              <li key={a.account} className="min-w-0 rounded-xl border border-gray-200 p-3">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-semibold text-gray-900">{ACCOUNT_LABEL[a.account] ?? a.account}</p>
                  <Badge tone={a.ready ? "green" : "amber"}>{a.ready ? "Ready" : "Not ready"}</Badge>
                </div>
                <p className="mt-1 break-words text-xs text-gray-500">{ACCOUNT_NOTE[a.account] ?? ""}</p>
                {!a.ready && a.reason && <p className="mt-2 break-words text-sm text-amber-800">{a.reason}</p>}
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={() => void sync()} disabled={syncing} className={buttonClass.secondary}>
          <RefreshCw size={16} className={cn(syncing && "animate-spin")} /> {syncing ? "Syncing…" : "Sync payout accounts"}
        </button>
      </div>
    </Card>
  );
}
