import { lazy } from "react";
import { Building2 } from "lucide-react";
import { defineDeskModule } from "../../core/registry";

// The registry loads every desk.module.tsx and reads its default export; that is the module contract.
// eslint-disable-next-line react-refresh/only-export-components
export default defineDeskModule({
  path: "rent", label: "Rent", description: "Send rent prompts to a landlord's tenants.",
  icon: Building2, order: 60, component: lazy(() => import("./RentScreen")),
});
