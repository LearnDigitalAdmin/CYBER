import { lazy } from "react";
import { FileUp } from "lucide-react";
import { defineDeskModule } from "../../core/registry";

export default defineDeskModule({
  path: "import", label: "Import", icon: FileUp, order: 20,
  description: "Add members, students or tenants from an Excel or CSV file for a customer.",
  component: lazy(() => import("./ImportScreen")),
});
