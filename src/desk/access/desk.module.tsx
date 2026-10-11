import { lazy } from "react";
import { KeyRound } from "lucide-react";
import { defineDeskModule } from "../core/registry";

export default defineDeskModule({
  path: "access", label: "Access", icon: KeyRound, order: 10, primary: true,
  description: "Open a customer's account with their OTP and see your active session.",
  component: lazy(() => import("./AccessScreen")),
});
