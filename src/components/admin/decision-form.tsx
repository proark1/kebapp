"use client";

import { useActionState } from "react";
import type { AdminReviewAction } from "@/lib/admin-review-state";
import { initialAdminReviewState } from "@/lib/admin-review-state";

type DecisionFormProps = {
  action: AdminReviewAction;
  kind: "approve" | "reject" | "suspend";
  organizationId?: string;
  requestId: string;
};

const labels = {
  approve: "Pilotzugang freigeben",
  reject: "Antrag ablehnen",
  suspend: "Betrieb pausieren",
} as const;

export function DecisionForm({
  action,
  kind,
  organizationId,
  requestId,
}: DecisionFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialAdminReviewState,
  );
  const needsReason = kind !== "approve";

  return (
    <form action={formAction} className={`decision-form decision-form--${kind}`}>
      <input name="requestId" type="hidden" value={requestId} />
      {organizationId ? (
        <input name="organizationId" type="hidden" value={organizationId} />
      ) : null}
      {needsReason ? (
        <label>
          <span>Begründung für das Prüfprotokoll</span>
          <textarea
            maxLength={600}
            minLength={10}
            name="reason"
            placeholder={
              kind === "reject"
                ? "Welche Angabe konnte nicht bestätigt werden?"
                : "Warum wird der Pilotzugang pausiert?"
            }
            required
            rows={3}
          />
        </label>
      ) : (
        <p>
          Organisation und Inhaberzugang werden gemeinsam aktiviert. Der
          Vorgang wird im Prüfprotokoll vermerkt.
        </p>
      )}
      {state.message ? (
        <p className="decision-form__error" role="alert">
          {state.message}
        </p>
      ) : null}
      <button disabled={pending} type="submit">
        {pending ? "Wird gespeichert …" : labels[kind]}
      </button>
    </form>
  );
}
