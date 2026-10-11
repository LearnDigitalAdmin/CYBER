import { lazy } from "react";
import { ShieldCheck } from "lucide-react";
import { defineDeskModule } from "../../core/registry";

const deskModule = defineDeskModule({
  path: "top",
  label: "Top desk",
  description: "Review desks, set status and rank, and pay bonuses.",
  icon: ShieldCheck,
  order: 100,
  requires: "top",
  component: lazy(() => import("./TopScreen")),
});

export default deskModule;
