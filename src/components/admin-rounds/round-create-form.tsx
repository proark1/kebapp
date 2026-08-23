"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useActionState } from "react";
import {
  createBuyingRoundAction,
  type AdminRoundFormState,
} from "@/app/admin/runden/actions";

const initialState: AdminRoundFormState = { status: "idle" };

function FieldError({ id, errors }: { errors?: string; id: string }) {
  if (!errors) return null;
  return (
    <p className="editor-field-error" id={id} role="alert">
      {errors}
    </p>
  );
}

export function RoundCreateForm({
  organizations,
}: {
  organizations: Array<{ organizationId: string; organizationName: string }>;
}) {
  const [state, formAction, pending] = useActionState(
    createBuyingRoundAction,
    initialState,
  );
  const fieldErrors = state.fieldErrors ?? {};

  if (organizations.length === 0) {
    return (
      <p className="rounds-create__empty">
        Sobald Läden freigegeben sind, kannst du hier Sammelrunden anlegen.
      </p>
    );
  }

  return (
    <form action={formAction} className="form-stack rounds-create">
      <div className="form-grid form-grid--two">
        <label className="field">
          <span>Laden</span>
          <span className="select-wrap">
            <select name="organizationId" required defaultValue="">
              <option disabled value="">
                Laden auswählen
              </option>
              {organizations.map((organization) => (
                <option
                  key={organization.organizationId}
                  value={organization.organizationId}
                >
                  {organization.organizationName}
                </option>
              ))}
            </select>
            <ChevronDown size={17} aria-hidden="true" />
          </span>
          <FieldError errors={fieldErrors.organizationId} id="round-org-error" />
        </label>
        <label className="field">
          <span>Name der Runde</span>
          <input
            aria-describedby={fieldErrors.name ? "round-name-error" : undefined}
            aria-invalid={fieldErrors.name ? true : undefined}
            name="name"
            placeholder="Sammelrunde Fleisch · Mönchengladbach"
            required
          />
          <FieldError errors={fieldErrors.name} id="round-name-error" />
        </label>
      </div>

      <div className="form-grid form-grid--two">
        <label className="field">
          <span>Regions-Schlüssel</span>
          <input
            aria-describedby={
              fieldErrors.regionalKey ? "round-region-error" : undefined
            }
            aria-invalid={fieldErrors.regionalKey ? true : undefined}
            name="regionalKey"
            placeholder="mg-fleisch-2026-09"
            required
          />
          <small>Läden mit gleichem Schlüssel bündeln ihre Menge.</small>
          <FieldError errors={fieldErrors.regionalKey} id="round-region-error" />
        </label>
        <label className="field">
          <span>Zielmenge in kg</span>
          <input
            aria-invalid={fieldErrors.targetQuantity ? true : undefined}
            min="0.001"
            name="targetQuantity"
            required
            step="0.001"
            type="number"
          />
          <FieldError
            errors={fieldErrors.targetQuantity}
            id="round-target-error"
          />
        </label>
      </div>

      <div className="form-grid form-grid--three">
        <label className="field">
          <span>Bestellschluss</span>
          <input
            aria-invalid={fieldErrors.closesAt ? true : undefined}
            name="closesAt"
            required
            type="datetime-local"
          />
          <FieldError errors={fieldErrors.closesAt} id="round-close-error" />
        </label>
        <label className="field">
          <span>Lieferfenster ab</span>
          <input
            aria-invalid={fieldErrors.deliveryStartsAt ? true : undefined}
            name="deliveryStartsAt"
            required
            type="datetime-local"
          />
          <FieldError
            errors={fieldErrors.deliveryStartsAt}
            id="round-start-error"
          />
        </label>
        <label className="field">
          <span>Lieferfenster bis</span>
          <input
            aria-invalid={fieldErrors.deliveryEndsAt ? true : undefined}
            name="deliveryEndsAt"
            required
            type="datetime-local"
          />
          <FieldError errors={fieldErrors.deliveryEndsAt} id="round-end-error" />
        </label>
      </div>

      <div className="rounds-create__footer">
        <label className="field">
          <span>Richtpreis pro kg (optional)</span>
          <input
            aria-invalid={fieldErrors.referenceUnitPrice ? true : undefined}
            min="0"
            name="referenceUnitPrice"
            placeholder="9.18"
            step="0.01"
            type="number"
          />
          <FieldError
            errors={fieldErrors.referenceUnitPrice}
            id="round-price-error"
          />
        </label>
        <button className="button button--primary" disabled={pending} type="submit">
          <Plus size={17} aria-hidden="true" />
          {pending ? "Wird angelegt …" : "Runde anlegen"}
        </button>
      </div>

      {state.status !== "idle" && state.message ? (
        <p
          className={`save-message save-message--${state.status === "success" ? "success" : "error"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
