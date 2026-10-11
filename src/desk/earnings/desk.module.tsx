import { lazy } from "react";
import { Wallet } from "lucide-react";
import { defineDeskModule } from "../core/registry";

// The registry loads every desk.module.tsx and reads its default export; that is the module contract.
// eslint-disable-next-line react-refresh/only-export-components
export default defineDeskModule({
  path: "earnings", label: "Earnings", description: "What you've earned, what's payable, and your milestone progress.",
  icon: Wallet, order: 20, primary: true, component: lazy(() => import("./EarningsScreen")),
});
