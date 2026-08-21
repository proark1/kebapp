"use client";

import { LogOut, ShieldCheck, UserRound, Users } from "lucide-react";
import { useFormStatus } from "react-dom";
import type { StoreRole } from "@/server/organizations/organization-dto";

type AccountMenuProps = {
  role: StoreRole;
  roleLabel: string;
  signOutAction: (formData: FormData) => Promise<void>;
  user: { initials: string; name: string };
};

function SignOutButton() {
  const { pending } = useFormStatus();

  return (
    <button disabled={pending} type="submit">
      <LogOut size={16} aria-hidden="true" />
      {pending ? "Wird abgemeldet …" : "Abmelden"}
    </button>
  );
}

export function AccountMenu({
  role,
  roleLabel,
  signOutAction,
  user,
}: AccountMenuProps) {
  return (
    <details className="account-menu">
      <summary>
        <span className="account-menu__avatar">{user.initials}</span>
        <span>
          <strong>{user.name}</strong>
          <small>{roleLabel}</small>
        </span>
      </summary>
      <div className="account-menu__popover">
        <header>
          <UserRound size={17} aria-hidden="true" />
          <span>
            <strong>{user.name}</strong>
            <small>{roleLabel}</small>
          </span>
        </header>

        {role === "OWNER" ? (
          <div className="account-menu__owner-tools" aria-label="Inhaberverwaltung">
            <button disabled type="button">
              <Users size={16} aria-hidden="true" />
              Team &amp; Rollen
              <small>bald</small>
            </button>
            <button disabled type="button">
              <ShieldCheck size={16} aria-hidden="true" />
              Domain &amp; Sicherheit
              <small>bald</small>
            </button>
          </div>
        ) : null}

        <form action={signOutAction}>
          <SignOutButton />
        </form>
      </div>
    </details>
  );
}
