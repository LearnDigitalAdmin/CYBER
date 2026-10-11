import { lazy } from "react";
import { Inbox } from "lucide-react";
import { defineDeskModule } from "../../core/registry";

const deskModule = defineDeskModule({
  path: "requests",
  label: "Requests",
  description: "Support requests from your customers, and a direct line to Samuhia.",
  icon: Inbox,
  order: 40,
  primary: true,
  component: lazy(() => import("./RequestsScreen")),
});

export default deskModule;
