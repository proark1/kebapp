import type { Metadata } from "next";
import { KeyRound, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import {
  createInvitationAction,
  revokeInvitationAction,
} from "@/app/app/einstellungen/team/actions";
import { InvitationForm } from "@/components/team/invitation-form";
import { MemberList } from "@/components/team/member-list";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import { isPublicDemo, publicDemoMessage } from "@/server/demo/demo-mode";
import { listOrganizationTeam } from "@/server/invitations/service";

export const metadata: Metadata = {
  title: "Team verwalten",
  robots: { follow: false, index: false },
};

export default async function TeamPage() {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/einstellungen/team",
  );
  if (organization.role !== "OWNER") {
    redirect("/app");
  }

  const team = await listOrganizationTeam({
    actor,
    organizationId: organization.organizationId,
  });
  const demoMode = isPublicDemo();

  return (
    <div className="team-page">
      <header className="team-page__header">
        <div>
          <span className="eyebrow">TEAM &amp; ZUGRIFF</span>
          <h1>Wer darf in {organization.storeName} arbeiten?</h1>
          <p>
            Lade Mitarbeitende gezielt per E-Mail ein. Neue Mitglieder erhalten
            zunächst nur Zugriff auf die täglichen Betriebsaufgaben.
          </p>
        </div>
        <span className="team-page__seal">
          <KeyRound size={21} aria-hidden="true" />
          OWNER-BEREICH
        </span>
      </header>

      <section className="team-invite-card">
        <div className="team-invite-card__intro">
          <span><UsersRound size={23} aria-hidden="true" /></span>
          <div>
            <h2>Mitarbeiter:in einladen</h2>
            <p>Ein Konto kann erst nach Anmeldung mit bestätigter E-Mail beitreten.</p>
          </div>
        </div>
        {demoMode ? (
          <p className="team-invite-form__message" role="status">
            {publicDemoMessage}
          </p>
        ) : null}
        <InvitationForm action={createInvitationAction} disabled={demoMode} />
      </section>

      <MemberList
        invitations={team.invitations}
        members={team.members}
        revokeAction={revokeInvitationAction}
      />
    </div>
  );
}
