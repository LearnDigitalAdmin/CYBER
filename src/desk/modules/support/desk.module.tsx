import { lazy } from "react";
import { LifeBuoy } from "lucide-react";
import { defineDeskModule } from "../../core/registry";

// The registry loads every desk.module.tsx and reads its default export; that is the module contract.
// eslint-disable-next-line react-refresh/only-export-components
export default defineDeskModule({
  path: "support", label: "Support", description: "Log customer support visits and confirm them with the customer's code.",
  icon: LifeBuoy, order: 70, component: lazy(() => import("./SupportScreen")),
});
