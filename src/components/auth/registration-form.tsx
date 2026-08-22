"use client";

import { useActionState } from "react";
import type { AuthFormAction, AuthFieldName } from "@/lib/auth-form-state";
import { initialAuthFormState } from "@/lib/auth-form-state";

type RegistrationFormProps = {
  action: AuthFormAction;
  disabled?: boolean;
};

type RegistrationFieldProps = {
  autoComplete: string;
  error?: string;
  disabled?: boolean;
  label: string;
  name: Extract<AuthFieldName, "confirmPassword" | "email" | "name" | "password">;
  placeholder?: string;
  type: "email" | "password" | "text";
};

function RegistrationField({
  autoComplete,
  disabled,
  error,
  label,
  name,
  placeholder,
  type,
}: RegistrationFieldProps) {
  const id = `registration-${name}`;
  const isPassword = type === "password";

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        disabled={disabled}
        id={id}
        inputMode={type === "email" ? "email" : undefined}
        maxLength={isPassword ? 128 : name === "email" ? 320 : 160}
        minLength={isPassword ? 12 : name === "name" ? 2 : undefined}
        name={name}
        placeholder={placeholder}
        required
        type={type}
      />
      {error ? (
        <small className="auth-field__error" id={`${id}-error`}>
          {error}
        </small>
      ) : null}
    </div>
  );
}

export function RegistrationForm({
  action,
  disabled = false,
}: RegistrationFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialAuthFormState,
  );

  return (
    <form action={formAction} className="auth-form">
      <RegistrationField
        autoComplete="name"
        disabled={disabled}
        error={state.fieldErrors?.name}
        label="Dein Name"
        name="name"
        placeholder="Vor- und Nachname"
        type="text"
      />
      <RegistrationField
        autoComplete="email"
        disabled={disabled}
        error={state.fieldErrors?.email}
        label="E-Mail-Adresse"
        name="email"
        placeholder="name@dein-laden.de"
        type="email"
      />
      <RegistrationField
        autoComplete="new-password"
        disabled={disabled}
        error={state.fieldErrors?.password}
        label="Passwort"
        name="password"
        type="password"
      />
      <RegistrationField
        autoComplete="new-password"
        disabled={disabled}
        error={state.fieldErrors?.confirmPassword}
        label="Passwort wiederholen"
        name="confirmPassword"
        type="password"
      />

      <p className="auth-form__hint">
        Mindestens 12 Zeichen. Dein Ladenantrag folgt nach der E-Mail-Bestätigung.
      </p>

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
        className="auth-submit"
        disabled={disabled || pending}
        type="submit"
      >
        {pending ? <span className="auth-spinner" aria-hidden="true" /> : null}
        {disabled
          ? "In der Demo deaktiviert"
          : pending
            ? "Zugang wird angelegt …"
            : "Zugang anlegen"}
      </button>
    </form>
  );
}
