"use client";

import { ChevronDown, Minus, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import {
  createBuyingRoundAction,
  type AdminRoundFormState,
} from "@/app/admin/runden/actions";

const initialState: AdminRoundFormState = { status: "idle" };

export type RoundFormInitial = {
  name: string;
  organizationId?: string;
  pricingTiers: Array<{ label: string; minimumQuantity: string; unitPrice: string }>;
  referenceUnitPrice: string;
  regionalKey: string;
  targetQuantity: string;
};

type TierRow = { label: string; minimumQuantity: string; unitPrice: string };

function FieldError({ errors, id }: { errors?: string; id: string }) {
  if (!errors) return null;
  return (
    <p className="editor-field-error" id={id} role="alert">
      {errors}
    </p>
  );
}

export function RoundCreateForm({
  initial,
  organizations,
}: {
  initial?: RoundFormInitial;
  organizations: Array<{ organizationId: string; organizationName: string }>;
}) {
  const [state, formAction, pending] = useActionState(
    createBuyingRoundAction,
    initialState,
  );
  const [tiers, setTiers] = useState<TierRow[]>(
    initial?.pricingTiers.length
      ? initial.pricingTiers
      : [{ label: "Einzelkondition", minimumQuantity: "0", unitPrice: "" }],
  );
  const fieldErrors = state.fieldErrors ?? {};

  function updateTier(index: number, patch: Partial<TierRow>) {
    setTiers((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  if (organizations.length === 0) {
    return (
      <p className="rounds-create__empty">
        Sobald Läden freigegeben sind, kannst du hier Sammelrunden anlegen.
      </p>
    );
  }

  return (
    <form action={formAction} className="form-stack rounds-create">
      <input
        name="pricingTiersJson"
        type="hidden"
        value={JSON.stringify(tiers)}
      />

      <div className="form-grid form-grid--two">
        <label className="field">
          <span>Laden</span>
          <span className="select-wrap">
            <select
              defaultValue={initial?.organizationId ?? ""}
              name="organizationId"
              required
            >
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
            defaultValue={initial?.name}
            name="name"
            placeholder="Sammelrunde Fleisch · Mönchengladbach"
            required
          />
          <FieldError errors={fieldErrors.name} id="round-name-error" />
        </label>
      </div>

      <div className="form-grid form-grid--three">
        <label className="field">
          <span>Regions-Schlüssel</span>
          <input
            aria-describedby={
              fieldErrors.regionalKey ? "round-region-error" : undefined
            }
            aria-invalid={fieldErrors.regionalKey ? true : undefined}
            defaultValue={initial?.regionalKey}
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
            defaultValue={initial?.targetQuantity}
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
        <label className="field">
          <span>Richtpreis pro kg (optional)</span>
          <input
            aria-invalid={fieldErrors.referenceUnitPrice ? true : undefined}
            defaultValue={initial?.referenceUnitPrice}
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
      </div>

      <fieldset className="tier-editor">
        <legend>Preisstufen</legend>
        <small>
          Aktive Stufe für den Ersparnis-Report = höchste erreichte
          Mindestmenge der Gruppe.
        </small>
        <div className="tier-editor__rows">
          {tiers.map((tier, index) => (
            <div className="tier-editor__row" key={index}>
              <label className="field">
                <span className="sr-only">Bezeichnung Stufe {index + 1}</span>
                <input
                  aria-label={`Bezeichnung Preisstufe ${index + 1}`}
                  maxLength={80}
                  onChange={(event) =>
                    updateTier(index, { label: event.target.value })
                  }
                  placeholder="Einzelkondition"
                  value={tier.label}
                />
              </label>
              <label className="field">
                <span className="sr-only">Mindestmenge Stufe {index + 1}</span>
                <input
                  aria-label={`Mindestmenge in kg für Preisstufe ${index + 1}`}
                  inputMode="decimal"
                  min="0"
                  onChange={(event) =>
                    updateTier(index, { minimumQuantity: event.target.value })
                  }
                  placeholder="300"
                  value={tier.minimumQuantity}
                />
              </label>
              <label className="field">
                <span className="sr-only">Preis pro kg Stufe {index + 1}</span>
                <input
                  aria-label={`Preis pro kg für Preisstufe ${index + 1}`}
                  inputMode="decimal"
                  min="0.01"
                  onChange={(event) =>
                    updateTier(index, { unitPrice: event.target.value })
                  }
                  placeholder="9.05"
                  step="0.01"
                  value={tier.unitPrice}
                />
              </label>
              <button
                aria-label={`Preisstufe ${index + 1} entfernen`}
                className="icon-button icon-button--bordered tier-editor__remove"
                disabled={tiers.length <= 1}
                onClick={() =>
                  setTiers((current) =>
                    current.filter((_, rowIndex) => rowIndex !== index),
                  )
                }
                type="button"
              >
                <Minus size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <button
          className="button button--secondary button--small"
          disabled={tiers.length >= 8}
          onClick={() =>
            setTiers((current) => [
              ...current,
              { label: "", minimumQuantity: "", unitPrice: "" },
            ])
          }
          type="button"
        >
          <Plus size={15} aria-hidden="true" />
          Stufe hinzufügen
        </button>
        <FieldError
          errors={fieldErrors.pricingTiers}
          id="round-tiers-error"
        />
      </fieldset>

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
        <span />
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
