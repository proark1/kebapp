import { Clock3, Mail, ShieldCheck, UserRound } from "lucide-react";

type TeamMember = {
  email: string;
  joinedAt: Date | null;
  name: string;
  role: "EMPLOYEE" | "OWNER";
  status: "ACTIVE" | "INVITED" | "REMOVED" | "SUSPENDED";
  userId: string;
};

type PendingInvitation = {
  email: string;
  expiresAt: Date;
  id: string;
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
});

export function MemberList({
  invitations,
  members,
  revokeAction,
}: {
  invitations: PendingInvitation[];
  members: TeamMember[];
  revokeAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="team-roster">
      <section className="team-roster__section">
        <header>
          <span>Aktives Team</span>
          <strong>{members.length}</strong>
        </header>
        <ul className="team-roster__list">
          {members.map((member) => (
            <li key={member.userId}>
              <span className="team-roster__avatar">
                <UserRound size={19} aria-hidden="true" />
              </span>
              <span className="team-roster__identity">
                <strong>{member.name}</strong>
                <small>{member.email}</small>
              </span>
              <span className="team-roster__role">
                {member.role === "OWNER" ? (
                  <ShieldCheck size={15} aria-hidden="true" />
                ) : null}
                {member.role === "OWNER" ? "Inhaber:in" : "Mitarbeiter:in"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="team-roster__section">
        <header>
          <span>Offene Einladungen</span>
          <strong>{invitations.length}</strong>
        </header>
        {invitations.length > 0 ? (
          <ul className="team-roster__list">
            {invitations.map((invitation) => (
              <li key={invitation.id}>
                <span className="team-roster__avatar team-roster__avatar--pending">
                  <Mail size={18} aria-hidden="true" />
                </span>
                <span className="team-roster__identity">
                  <strong>{invitation.email}</strong>
                  <small>
                    <Clock3 size={13} aria-hidden="true" />
                    gültig bis {dateFormatter.format(invitation.expiresAt)}
                  </small>
                </span>
                <form action={revokeAction}>
                  <input name="invitationId" type="hidden" value={invitation.id} />
                  <button type="submit">Widerrufen</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="team-roster__empty">Keine offenen Einladungen.</p>
        )}
      </section>
    </div>
  );
}
