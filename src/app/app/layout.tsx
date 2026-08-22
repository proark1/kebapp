import { AppShell } from "@/components/app-shell";
import { signOutAction } from "@/app/app/actions";
import { getOperatorLayoutContext } from "@/server/auth/page-guards";
import { createInitials } from "@/server/organizations/organization-dto";
import { isPublicDemo } from "@/server/demo/demo-mode";

export default async function OperatorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { actor, organization } = await getOperatorLayoutContext();
  if (!organization) {
    return children;
  }

  return (
    <AppShell
      organization={organization}
      demoMode={isPublicDemo()}
      signOutAction={signOutAction}
      user={{ initials: createInitials(actor.name), name: actor.name }}
    >
      {children}
    </AppShell>
  );
}
