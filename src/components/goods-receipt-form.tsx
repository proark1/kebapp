"use client";

import { Check, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

export type ReceiptLine = {
  demandItemId: string;
  missingReason: string | null;
  orderedQuantity: number;
  productName: string;
  reasonNote: string;
  receivedQuantity: number | null;
  specification: string;
  unit: "kg" | "Stück";
};

const reasonLabels: Record<string, string> = {
  OTHER: "Sonstiges",
  QUALITY: "Mangelhafte Ware",
  SHORTAGE: "Zu wenig geliefert",
  WRONG_ITEM: "Falsche Ware",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button button--primary" disabled={pending} type="submit">
      <Save size={17} aria-hidden="true" />
      {pending ? "Wird gespeichert …" : "Wareneingang speichern"}
    </button>
  );
}

function formatNumber(value: number): string {
  return value.toLocaleString("de-DE", { maximumFractionDigits: 3 });
}

export function GoodsReceiptForm({
  initialLines,
  initialNote,
  messageCode,
  roundId,
  roundName,
  saveAction,
}: {
  initialLines: ReceiptLine[];
  initialNote: string;
  messageCode?: string;
  roundId: string;
  roundName: string;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  const [received, setReceived] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialLines.map((line) => [
        line.demandItemId,
        line.receivedQuantity === null
          ? String(line.orderedQuantity)
          : String(line.receivedQuantity),
      ]),
    ),
  );

  const totals = useMemo(() => {
    let missingCount = 0;
    let orderedKg = 0;
    let receivedKg = 0;
    for (const line of initialLines) {
      const value = Number(received[line.demandItemId] ?? line.orderedQuantity);
      const ordered = line.orderedQuantity;
      const missing = Math.max(0, ordered - (Number.isFinite(value) ? value : 0));
      if (missing > 0.0005) missingCount += 1;
      if (line.unit === "kg") {
        orderedKg += ordered;
        receivedKg += Math.min(value, Number.MAX_SAFE_INTEGER) || 0;
      }
    }
    return { missingCount, orderedKg, receivedKg };
  }, [initialLines, received]);

  const message =
    messageCode === "gespeichert"
      ? "Wareneingang gespeichert"
      : messageCode === "ungueltig"
        ? "Bitte prüfe die eingetragenen Mengen."
        : messageCode === "gesperrt"
          ? "Diese Runde kann nicht mehr erfasst werden."
          : null;

  return (
    <form action={saveAction} className="form-stack receipt-form">
      <input name="buyingRoundId" type="hidden" value={roundId} />
      <div className="demand-table-wrap">
        <table className="demand-table receipt-table">
          <thead>
            <tr>
              <th>Position</th>
              <th>Bestellt</th>
              <th>Erhalten</th>
              <th>Fehlt</th>
              <th>Grund</th>
            </tr>
          </thead>
          <tbody>
            {initialLines.map((line) => {
              const raw = received[line.demandItemId] ?? "";
              const value = Number(raw);
              const receivedValue = raw === "" ? 0 : Number.isFinite(value) ? value : 0;
              const missing = Math.max(0, line.orderedQuantity - receivedValue);
              return (
                <tr key={line.demandItemId}>
                  <td data-label="Position">
                    <strong>{line.productName}</strong>
                    <small>{line.specification}</small>
                  </td>
                  <td data-label="Bestellt">
                    {formatNumber(line.orderedQuantity)} {line.unit}
                  </td>
                  <td data-label="Erhalten">
                    <label className="receipt-quantity">
                      <span className="sr-only">
                        Erhaltene Menge für {line.productName}
                      </span>
                      <input
                        inputMode="decimal"
                        min="0"
                        name={`received-${line.demandItemId}`}
                        onChange={(event) =>
                          setReceived((current) => ({
                            ...current,
                            [line.demandItemId]: event.target.value,
                          }))
                        }
                        step="0.001"
                        type="number"
                        value={raw}
                      />
                    </label>
                  </td>
                  <td data-label="Fehlt">
                    {missing > 0.0005 ? (
                      <strong className="receipt-missing">
                        {formatNumber(missing)} {line.unit}
                      </strong>
                    ) : (
                      <Check size={16} aria-hidden="true" />
                    )}
                  </td>
                  <td data-label="Grund">
                    <select
                      aria-label={`Grund der Fehlmenge für ${line.productName}`}
                      defaultValue={line.missingReason ?? ""}
                      disabled={missing <= 0.0005}
                      name={`reason-${line.demandItemId}`}
                    >
                      <option value="">—</option>
                      {Object.entries(reasonLabels).map(([valueKey, label]) => (
                        <option key={valueKey} value={valueKey}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={`Bemerkung zur Fehlmenge für ${line.productName}`}
                      maxLength={300}
                      name={`reasonNote-${line.demandItemId}`}
                      placeholder="Bemerkung (optional)"
                      defaultValue={line.reasonNote}
                      type="text"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <dl className="receipt-summary">
        <div>
          <dt>Bestellt gesamt</dt>
          <dd>{formatNumber(totals.orderedKg)} kg</dd>
        </div>
        <div>
          <dt>Erhalten gesamt</dt>
          <dd>{formatNumber(Math.round(totals.receivedKg * 1000) / 1000)} kg</dd>
        </div>
        <div>
          <dt>Positionen mit Fehlmenge</dt>
          <dd>{totals.missingCount}</dd>
        </div>
      </dl>

      <label className="field">
        <span>Gesamtbemerkung (optional)</span>
        <textarea
          defaultValue={initialNote}
          maxLength={2000}
          name="note"
          rows={2}
        />
      </label>

      {message ? (
        <p
          className={`save-message save-message--${messageCode === "gespeichert" ? "success" : "error"}`}
          role="status"
        >
          {message}
        </p>
      ) : null}

      <div className="receipt-form__footer">
        <SubmitButton />
      </div>
    </form>
  );
}
