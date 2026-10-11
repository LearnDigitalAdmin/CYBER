import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { DESK_TOP_CODE } from "../../api";
import { useAgent } from "../../core/useAgent";
import { EmptyState, Page, cn } from "../../ui";
import DeskDetail from "./DeskDetail";
import DesksList from "./DesksList";
import Payables from "./Payables";

const tab = ({ isActive }: { isActive: boolean }) =>
  cn("inline-flex h-11 items-center rounded-xl px-4 text-sm font-semibold", isActive ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50");

/**
 * The company's top desk. Hiding this screen is cosmetic: everything it calls is enforced on the server
 * (verified @samuhia.co.ke account, recent sign-in, per-action OTP).
 */
export default function TopScreen() {
  const agent = useAgent();
  if (agent === undefined) {
    return <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" /></div>;
  }
  if (agent?.agentCode !== DESK_TOP_CODE) {
    return <Page title="Top desk"><EmptyState title="Not available" body="This area is only for the company's top desk." /></Page>;
  }
  return (
    <Routes>
      <Route path="desks/:code" element={<DeskDetail />} />
      <Route path="*" element={<Tabs />} />
    </Routes>
  );
}

function Tabs() {
  return (
    <Page title="Top desk" subtitle="Review desks, change status and rank, and pay what is due. Every change needs a code sent to your phone.">
      <nav aria-label="Top desk sections" className="flex min-w-0 flex-wrap gap-2">
        <NavLink to="/desk/top" end className={tab}>Desks</NavLink>
        <NavLink to="/desk/top/payables" className={tab}>Payables</NavLink>
      </nav>
      <Routes>
        <Route index element={<DesksList />} />
        <Route path="payables" element={<Payables />} />
        <Route path="*" element={<Navigate to="/desk/top" replace />} />
      </Routes>
    </Page>
  );
}
