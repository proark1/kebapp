"use client";

import { useActionState } from "react";
import type { AuthFormAction } from "@/lib/auth-form-state";
import { initialAuthFormState } from "@/lib/auth-form-state";

type PasswordResetFormProps =
  | {
      action: AuthFormAction;
      mode: "request";
    }
  | {
      action: AuthFormAction;
      mode: "reset";
      token: string;
    };

export function PasswordResetForm(props: PasswordResetFormProps) {
  const [state, formAction, pending] = useActionState(
    props.action,
    initialAuthFormState,
  );
  const requestMode = props.mode === "request";

  return (
    <form action={formAction} className="auth-form">
      {requestMode ? (
        <div className="auth-field">
          <label htmlFor="reset-email">E-Mail-Adresse</label>
          <input
            aria-describedby={
              state.fieldErrors?.email ? "reset-email-error" : undefined
            }
            aria-invalid={state.fieldErrors?.email ? true : undefined}
            autoComplete="email"
            autoFocus
            id="reset-email"
            inputMode="email"
            maxLength={320}
            name="email"
            placeholder="name@dein-laden.de"
            required
            type="email"
          />
          {state.fieldErrors?.email ? (
            <small className="auth-field__error" id="reset-email-error">
              {state.fieldErrors.email}
            </small>
          ) : null}
        </div>
      ) : (
        <>
          <input name="token" type="hidden" value={props.token} />
          <div className="auth-field">
            <label htmlFor="new-password">Neues Passwort</label>
            <input
              aria-describedby={
                state.fieldErrors?.password ? "new-password-error" : undefined
              }
              aria-invalid={state.fieldErrors?.password ? true : undefined}
              autoComplete="new-password"
              autoFocus
              id="new-password"
              maxLength={128}
              minLength={12}
              name="password"
              required
              type="password"
            />
            {state.fieldErrors?.password ? (
              <small className="auth-field__error" id="new-password-error">
                {state.fieldErrors.password}
              </small>
            ) : null}
          </div>
          <div className="auth-field">
            <label htmlFor="confirm-new-password">
              Neues Passwort wiederholen
            </label>
            <input
              aria-describedby={
                state.fieldErrors?.confirmPassword
                  ? "confirm-new-password-error"
                  : undefined
              }
              aria-invalid={
                state.fieldErrors?.confirmPassword ? true : undefined
              }
              autoComplete="new-password"
              id="confirm-new-password"
              maxLength={128}
              minLength={12}
              name="confirmPassword"
              required
              type="password"
            />
            {state.fieldErrors?.confirmPassword ? (
              <small
                className="auth-field__error"
                id="confirm-new-password-error"
              >
                {state.fieldErrors.confirmPassword}
              </small>
            ) : null}
          </div>
          <p className="auth-form__hint">
            Nach der Änderung werden bestehende Sitzungen abgemeldet.
          </p>
        </>
      )}

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
        {pending
          ? requestMode
            ? "E-Mail wird vorbereitet …"
            : "Passwort wird gespeichert …"
          : requestMode
            ? "Link anfordern"
            : "Passwort speichern"}
      </button>
    </form>
  );
}
