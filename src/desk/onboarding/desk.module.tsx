import { lazy } from "react";
import { UserCheck } from "lucide-react";
import { defineDeskModule } from "../core/registry";

export default defineDeskModule({
  path: "onboarding", label: "Onboarding", icon: UserCheck, order: 90,
  description: "Apply to become a desk agent and follow your application to activation.",
  component: lazy(() => import("./OnboardingScreen")),
});
