"use client";

import { LogOut, UserRound } from "lucide-react";
import { useFormStatus } from "react-dom";

type AccountMenuProps = {
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

        <form action={signOutAction}>
          <SignOutButton />
        </form>
      </div>
    </details>
  );
}
