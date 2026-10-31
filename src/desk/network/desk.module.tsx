import { lazy } from "react";
import { Network } from "lucide-react";
import { defineDeskModule } from "../core/registry";

// eslint-disable-next-line react-refresh/only-export-components
export default defineDeskModule({
  path: "network", label: "Network", description: "Your role, your team, approvals, invites and how you earn.",
  icon: Network, order: 25, component: lazy(() => import("./NetworkScreen")),
});
