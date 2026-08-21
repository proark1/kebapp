"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthFormAction } from "@/lib/auth-form-state";
import { initialAuthFormState } from "@/lib/auth-form-state";

type LoginFormProps = {
  action: AuthFormAction;
  continueTo?: string;
};

export function LoginForm({ action, continueTo }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialAuthFormState,
  );
  const emailError = state.fieldErrors?.email;
  const passwordError = state.fieldErrors?.password;

  return (
    <form action={formAction} className="auth-form">
      {continueTo ? (
        <input name="continueTo" type="hidden" value={continueTo} />
      ) : null}

      <div className="auth-field">
        <label htmlFor="login-email">E-Mail-Adresse</label>
        <input
          aria-describedby={emailError ? "login-email-error" : undefined}
          aria-invalid={emailError ? true : undefined}
          autoComplete="email"
          autoFocus
          id="login-email"
          inputMode="email"
          name="email"
          placeholder="name@dein-laden.de"
          required
          type="email"
        />
        {emailError ? (
          <small className="auth-field__error" id="login-email-error">
            {emailError}
          </small>
        ) : null}
      </div>

      <div className="auth-field">
        <span className="auth-field__label-row">
          <label htmlFor="login-password">Passwort</label>
          <Link href="/passwort-vergessen">Passwort vergessen?</Link>
        </span>
        <input
          aria-describedby={
            passwordError ? "login-password-error" : undefined
          }
          aria-invalid={passwordError ? true : undefined}
          autoComplete="current-password"
          id="login-password"
          maxLength={128}
          minLength={12}
          name="password"
          required
          type="password"
        />
        {passwordError ? (
          <small className="auth-field__error" id="login-password-error">
            {passwordError}
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

      <button className="auth-submit" disabled={pending} type="submit">
        {pending ? <span className="auth-spinner" aria-hidden="true" /> : null}
        {pending ? "Anmeldung läuft …" : "Sicher anmelden"}
      </button>
    </form>
  );
}
