"use client";

import { MailPlus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { InvitationFormState } from "@/app/app/einstellungen/team/actions";

const initialState: InvitationFormState = { status: "IDLE" };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="team-invite-form__submit"
      disabled={disabled || pending}
      type="submit"
    >
      <MailPlus size={18} aria-hidden="true" />
      {disabled
        ? "In der Demo deaktiviert"
        : pending
          ? "Wird versendet …"
          : "Einladung senden"}
    </button>
  );
}
export function InvitationForm({
  action,
  disabled = false,
}: {
  action: (
    state: InvitationFormState,
    formData: FormData,
  ) => Promise<InvitationFormState>;
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "SUCCESS") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form action={formAction} className="team-invite-form" ref={formRef}>
      <label htmlFor="team-email">E-Mail-Adresse</label>
      <div className="team-invite-form__row">
        <input
          autoComplete="email"
          disabled={disabled}
          id="team-email"
          name="email"
          placeholder="mitarbeiter@beispiel.de"
          required
          type="email"
        />
        <SubmitButton disabled={disabled} />
      </div>
      <p className="team-invite-form__hint">
        {disabled
          ? "Diese öffentliche Demo versendet keine Einladungs-E-Mails."
          : "Die Einladung gilt 72 Stunden und ausschließlich für diese E-Mail-Adresse."}
      </p>
      {state.message ? (
        <p
          className={`team-invite-form__message team-invite-form__message--${state.status.toLowerCase()}`}
          role={state.status === "ERROR" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
