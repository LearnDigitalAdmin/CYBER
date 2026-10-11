import { EmptyState, Page } from "../../ui";
import DocsSection from "./DocsSection";
import EmailSection from "./EmailSection";
import PasswordSection from "./PasswordSection";
import PayoutSection from "./PayoutSection";
import { useAuthUser } from "./useAuthUser";

export default function AccountScreen() {
  const user = useAuthUser();
  if (user === undefined) {
    return <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" /></div>;
  }
  if (user === null) {
    return <Page title="Account"><EmptyState title="Please sign in" body="Sign in to manage your desk account." /></Page>;
  }
  return (
    <Page title="Account" subtitle="Your sign-in details, documents and where your earnings are paid.">
      <EmailSection user={user} />
      <PasswordSection user={user} />
      <DocsSection />
      <PayoutSection />
    </Page>
  );
}
