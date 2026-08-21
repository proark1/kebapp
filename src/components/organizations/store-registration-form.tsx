"use client";

import { useActionState } from "react";
import type {
  RegistrationFieldName,
  RegistrationFormAction,
} from "@/lib/registration-form-state";
import { initialRegistrationFormState } from "@/lib/registration-form-state";

type StoreRegistrationFormProps = {
  action: RegistrationFormAction;
  contactEmail: string;
  contactName: string;
};

type FieldProps = {
  autoComplete: string;
  defaultValue?: string;
  error?: string;
  label: string;
  maxLength: number;
  name: RegistrationFieldName;
  optional?: boolean;
  placeholder?: string;
  type?: "email" | "tel" | "text";
};

function Field({
  autoComplete,
  defaultValue,
  error,
  label,
  maxLength,
  name,
  optional,
  placeholder,
  type = "text",
}: FieldProps) {
  const id = `store-registration-${name}`;

  return (
    <label className="registration-field" htmlFor={id}>
      <span>
        {label} {optional ? <em>optional</em> : null}
      </span>
      <input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        id={id}
        inputMode={
          type === "email" ? "email" : type === "tel" ? "tel" : undefined
        }
        maxLength={maxLength}
        name={name}
        placeholder={placeholder}
        required={!optional}
        type={type}
      />
      {error ? (
        <small id={`${id}-error`} role="alert">
          {error}
        </small>
      ) : null}
    </label>
  );
}

export function StoreRegistrationForm({
  action,
  contactEmail,
  contactName,
}: StoreRegistrationFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialRegistrationFormState,
  );

  return (
    <form action={formAction} className="registration-form">
      <fieldset>
        <legend>
          <span>01</span>
          Dein Laden
        </legend>
        <div className="registration-form__grid">
          <Field
            autoComplete="organization"
            error={state.fieldErrors?.storeName}
            label="Name am Laden"
            maxLength={180}
            name="storeName"
            placeholder="z. B. Ocakbasi Rheydt"
          />
          <Field
            autoComplete="organization"
            error={state.fieldErrors?.legalName}
            label="Firmenname"
            maxLength={220}
            name="legalName"
            optional
            placeholder="Rechtlicher Name"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>
          <span>02</span>
          Kontakt
        </legend>
        <div className="registration-form__grid">
          <Field
            autoComplete="name"
            defaultValue={contactName}
            error={state.fieldErrors?.contactName}
            label="Kontaktperson"
            maxLength={180}
            name="contactName"
          />
          <Field
            autoComplete="email"
            defaultValue={contactEmail}
            error={state.fieldErrors?.contactEmail}
            label="Kontakt-E-Mail"
            maxLength={320}
            name="contactEmail"
            type="email"
          />
          <Field
            autoComplete="tel"
            error={state.fieldErrors?.contactPhone}
            label="Telefon"
            maxLength={40}
            name="contactPhone"
            placeholder="02161 …"
            type="tel"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>
          <span>03</span>
          Standort
        </legend>
        <div className="registration-form__grid registration-form__grid--address">
          <Field
            autoComplete="street-address"
            error={state.fieldErrors?.street}
            label="Straße und Hausnummer"
            maxLength={220}
            name="street"
          />
          <Field
            autoComplete="postal-code"
            error={state.fieldErrors?.postalCode}
            label="PLZ"
            maxLength={5}
            name="postalCode"
            placeholder="41061"
          />
          <Field
            autoComplete="address-level2"
            defaultValue="Mönchengladbach"
            error={state.fieldErrors?.city}
            label="Ort"
            maxLength={120}
            name="city"
          />
        </div>
      </fieldset>

      <div aria-live="polite" className="registration-form__message">
        {state.message ? <p role="alert">{state.message}</p> : null}
      </div>

      <footer className="registration-form__footer">
        <p>
          Mit dem Absenden entsteht noch kein Vertrag. Wir prüfen den Antrag
          persönlich für den NRW-Piloten.
        </p>
        <button className="registration-submit" disabled={pending} type="submit">
          {pending ? "Antrag wird abgelegt …" : "Laden zur Prüfung einreichen"}
        </button>
      </footer>
    </form>
  );
}
