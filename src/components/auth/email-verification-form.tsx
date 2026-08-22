"use client";

import { useActionState } from "react";
import type { AuthFormAction } from "@/lib/auth-form-state";
import { initialAuthFormState } from "@/lib/auth-form-state";

type EmailVerificationFormProps = {
  action: AuthFormAction;
  disabled?: boolean;
};

export function EmailVerificationForm({
  action,
  disabled = false,
}: EmailVerificationFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialAuthFormState,
  );

  return (
    <form action={formAction} className="auth-form auth-form--compact">
      <div className="auth-field">
        <label htmlFor="verification-email">E-Mail-Adresse</label>
        <input
          aria-describedby={
            state.fieldErrors?.email ? "verification-email-error" : undefined
          }
          aria-invalid={state.fieldErrors?.email ? true : undefined}
          autoComplete="email"
          disabled={disabled}
          id="verification-email"
          inputMode="email"
          maxLength={320}
          name="email"
          placeholder="name@dein-laden.de"
          required
          type="email"
        />
        {state.fieldErrors?.email ? (
          <small className="auth-field__error" id="verification-email-error">
            {state.fieldErrors.email}
          </small>
        ) : null}
      </div>

      <div aria-atomic="true" aria-live="polite" className="auth-form__message-slot">
        {state.message ? (
          <p
            className={`auth-form__message auth-form__message--${state.status}`}
            role={state.status === "error" ? "alert" : "status"}
          >
            {state.message}
          </p>
        ) : null}
      </div>

      <button
        className="auth-submit auth-submit--secondary"
        disabled={disabled || pending}
        type="submit"
      >
        {pending ? <span className="auth-spinner" aria-hidden="true" /> : null}
        {disabled
          ? "In der Demo deaktiviert"
          : pending
            ? "E-Mail wird angefordert …"
            : "E-Mail erneut senden"}
      </button>
    </form>
  );
}
