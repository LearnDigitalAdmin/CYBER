import { lazy } from "react";
import { UserCog } from "lucide-react";
import { defineDeskModule } from "../../core/registry";

const deskModule = defineDeskModule({
  path: "account",
  label: "Account",
  description: "Sign-in email, password, your documents and payout accounts.",
  icon: UserCog,
  order: 90,
  component: lazy(() => import("./AccountScreen")),
});

export default deskModule;
