import { lazy } from "react";
import { FileBarChart } from "lucide-react";
import { defineDeskModule } from "../../core/registry";

// The registry loads every desk.module.tsx and reads its default export; that is the module contract.
// eslint-disable-next-line react-refresh/only-export-components
export default defineDeskModule({
  path: "reports", label: "Reports", description: "Run a customer's reports and download their data.",
  icon: FileBarChart, order: 50, component: lazy(() => import("./ReportsScreen")),
});
