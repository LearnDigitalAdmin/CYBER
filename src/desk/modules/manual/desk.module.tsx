import { lazy } from "react";
import { PenLine } from "lucide-react";
import { defineDeskModule } from "../../core/registry";

export default defineDeskModule({
  path: "manual", label: "Manual entry", icon: PenLine, order: 30,
  description: "Type records in for a customer, one by one or from a paper form.",
  component: lazy(() => import("./ManualScreen")),
});
