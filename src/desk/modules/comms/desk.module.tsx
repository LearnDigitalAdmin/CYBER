import { lazy } from "react";
import { MessageSquare } from "lucide-react";
import { defineDeskModule } from "../../core/registry";

// The registry loads every desk.module.tsx and reads its default export; that is the module contract.
// eslint-disable-next-line react-refresh/only-export-components
export default defineDeskModule({
  path: "comms", label: "Messages", description: "Schedule SMS and send reminders for a customer.",
  icon: MessageSquare, order: 40, component: lazy(() => import("./CommsScreen")),
});
