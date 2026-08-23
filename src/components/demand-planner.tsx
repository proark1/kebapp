"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FlaskConical,
  Layers,
  Minus,
  PackagePlus,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { BuyingRoundMeter } from "@/components/buying-round-meter";
import { formatCurrency, getBuyingRoundSnapshot } from "@/lib/calculations";
import type { DemandItem, DemandPlanningData } from "@/lib/types";
import type { StoreRole } from "@/server/organizations/organization-dto";

const productSpecifications: Record<string, string> = {
  "Kalb-Drehspieß": "20 kg · Scheibenanteil 60 % · halal",
  "Hähnchen-Drehspieß": "15 kg · gewürzt · halal",
  "Rind-Drehspieß": "20 kg · Hackanteil max. 40 % · halal",
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const deadlineFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Berlin",
});

const messages: Record<string, { text: string; tone: "error" | "success" }> = {
  bestaetigt: { text: "Bedarf verbindlich bestätigt", tone: "success" },
  "bestaetigung-verboten": {
    text: "Nur Inhaber:innen dürfen den Bedarf bestätigen",
    tone: "error",
  },
  entfernt: { text: "Position entfernt", tone: "success" },
  gesperrt: {
    text: "Diese Position oder Sammelrunde ist nicht mehr änderbar",
    tone: "error",
  },
  gespeichert: { text: "Menge gespeichert", tone: "success" },
  hinzugefuegt: { text: "Position hinzugefügt", tone: "success" },
  leer: {
    text: "Trage mindestens eine Position vor der Bestätigung ein",
    tone: "error",
  },
  ungueltig: { text: "Bitte prüfe die eingegebenen Werte", tone: "error" },
  "vorlage-fehlt": {
    text: "Es gibt noch keinen gespeicherten Stammbedarf",
    tone: "error",
  },
  "vorlage-gespeichert": {
    text: "Stammbedarf gespeichert",
    tone: "success",
  },
  "vorlage-uebernommen": {
    text: "Stammbedarf in die Runde übernommen",
    tone: "success",
  },
};

type DemandAction = (formData: FormData) => Promise<void>;
type QuietDemandAction = (formData: FormData) => Promise<{ ok: boolean }>;

type OptimisticUpdate =
  | { type: "quantity"; id: string; amount: number }
  | { type: "remove"; id: string };

function PendingButton({
  children,
  className,
  pendingLabel,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} type="submit">
      {children}
      <span className="sr-only">{pending ? pendingLabel : ""}</span>
    </button>
  );
}

function TextSubmitButton({
  children,
  className,
  pendingLabel,
}: {
  children: React.ReactNode;
  className: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} type="submit">
      {pending ? pendingLabel : children}
    </button>
  );
}

function clampQuantity(amount: number): number {
  if (!Number.isFinite(amount)) return 0.001;
  return Math.min(500, Math.max(0.001, Math.round(amount * 1000) / 1000));
}

export function DemandPlanner({
  addAction,
  applyTemplateAction,
  confirmAction,
  messageCode,
  planning,
  removeQuietAction,
  role,
  saveTemplateAction,
  templateItemCount,
  updateAction,
  updateQuietAction,
  demoMode = false,
}: {
  addAction: DemandAction;
  applyTemplateAction: DemandAction;
  confirmAction: DemandAction;
  messageCode?: string;
  planning: DemandPlanningData;
  removeQuietAction: QuietDemandAction;
  role: StoreRole;
  saveTemplateAction: DemandAction;
  templateItemCount: number;
  updateAction: DemandAction;
  updateQuietAction: QuietDemandAction;
  demoMode?: boolean;
}) {
  const router = useRouter();
  const [composerOpen, setComposerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [product, setProduct] = useState("Kalb-Drehspieß");
  const confirmDialogRef = useRef<HTMLElement>(null);
  const confirmTriggerRef = useRef<HTMLButtonElement>(null);
  const [isMutating, startMutation] = useTransition();
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const [optimisticItems, applyOptimisticUpdate] = useOptimistic(
    planning.items,
    (current: DemandItem[], update: OptimisticUpdate) => {
      if (update.type === "remove") {
        return current.filter((item) => item.id !== update.id);
      }
      return current.map((item) =>
        item.id === update.id ? { ...item, amount: update.amount } : item,
      );
    },
  );
  const snapshot = getBuyingRoundSnapshot(planning.round, optimisticItems);
  const message = messageCode ? messages[messageCode] : undefined;
  const locked = !planning.editable;

  useEffect(() => {
    if (!confirmOpen) return;

    const dialog = confirmDialogRef.current;
    const trigger = confirmTriggerRef.current;
    const initialFocus = dialog?.querySelector<HTMLElement>(
      "[data-initial-focus]",
    );
    initialFocus?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setConfirmOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [confirmOpen]);

  function mutateQuantity(item: DemandItem, nextAmount: number) {
    const amount = clampQuantity(nextAmount);
    startMutation(async () => {
      applyOptimisticUpdate({ type: "quantity", id: item.id, amount });
      const formData = new FormData();
      formData.set("demandItemId", item.id);
      formData.set("quantity", String(amount));
      const result = await updateQuietAction(formData);
      if (!result.ok) {
        setLiveNotice(messages.gesperrt.text);
      }
      router.refresh();
    });
  }

  function removeItem(item: DemandItem) {
    startMutation(async () => {
      applyOptimisticUpdate({ type: "remove", id: item.id });
      const formData = new FormData();
      formData.set("demandItemId", item.id);
      const result = await removeQuietAction(formData);
      if (!result.ok) {
        setLiveNotice(messages.gesperrt.text);
      } else {
        setLiveNotice(messages.entfernt.text);
      }
      router.refresh();
    });
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Gruppeneinkauf</span>
          <h1>Dein Fleischbedarf</h1>
          <p>
            {planning.submissionStatus === "CONFIRMED"
              ? "Dieser Bedarf ist verbindlich bestätigt und nicht mehr änderbar."
              : role === "OWNER"
                ? "Prüfe und bestätige, was du für die nächste Lieferung brauchst."
                : "Trage den Bedarf ein. Der Inhaber bestätigt ihn anschließend."}
          </p>
        </div>
        <div className="deadline-badge">
          <Clock3 size={18} aria-hidden="true" />
          <span>
            Bestellschluss
            <strong>
              {deadlineFormatter.format(new Date(planning.round.closesAt))} Uhr
            </strong>
          </span>
        </div>
      </header>

      {demoMode ? (
        <div className="demo-order-note" role="note">
          <FlaskConical aria-hidden="true" size={18} />
          <span>
            <strong>Demo-Modus:</strong> Bestätigungen verändern nur
            Beispieldaten. Es wird kein realer Lieferantenauftrag ausgelöst.
          </span>
        </div>
      ) : null}

      <section
        className="buying-summary-grid"
        aria-label="Zusammenfassung der Sammelrunde"
      >
        <BuyingRoundMeter round={planning.round} demands={optimisticItems} compact />

        <article className="round-facts">
          <div>
            <span className="eyebrow">Dein Anteil</span>
            <strong>{snapshot.storeKg} kg</strong>
          </div>
          <div>
            <span className="eyebrow">Aktueller Gruppenpreis</span>
            <strong>{formatCurrency(snapshot.activeTier.pricePerKg)} / kg</strong>
          </div>
          <div>
            <span className="eyebrow">Voraussichtliche Ersparnis</span>
            <strong className="value-positive">
              {formatCurrency(snapshot.estimatedSavings)}
            </strong>
          </div>
          <p>
            <CircleHelp size={16} aria-hidden="true" />
            Summe anderer Läden nur nach Bestätigung; Einzelmengen bleiben verborgen.
          </p>
        </article>
      </section>

      <section className="panel demand-panel">
        <div className="panel__header demand-panel__header">
          <div>
            <span className="eyebrow">Lieferung</span>
            <h2>{planning.round.name}</h2>
            <p>{planning.round.deliveryWindow}</p>
          </div>
          {planning.editable ? (
            <div className="demand-panel__header-actions">
              {!locked && templateItemCount > 0 ? (
                <form action={applyTemplateAction}>
                  <input name="buyingRoundId" type="hidden" value={planning.round.id} />
                  <input
                    name="defaultDeliveryDate"
                    type="hidden"
                    value={planning.round.deliveryDate}
                  />
                  <TextSubmitButton
                    className="button button--secondary"
                    pendingLabel="Stammbedarf wird übernommen …"
                  >
                    <Layers size={17} aria-hidden="true" />
                    Stammbedarf übernehmen ({templateItemCount})
                  </TextSubmitButton>
                </form>
              ) : null}
              <button
                className="button button--primary"
                type="button"
                onClick={() => setComposerOpen(true)}
              >
                <Plus size={18} aria-hidden="true" />
                Position hinzufügen
              </button>
            </div>
          ) : (
            <span className="demand-lock-badge">
              <ShieldCheck size={16} aria-hidden="true" />
              {planning.submissionStatus === "CONFIRMED"
                ? "Bestätigt"
                : "Geschlossen"}
            </span>
          )}
        </div>

        {optimisticItems.length > 0 ? (
          <div className="demand-table-wrap">
            <table className="demand-table">
              <thead>
                <tr>
                  <th>Produkt</th>
                  <th>Lieferdatum</th>
                  <th>Menge</th>
                  <th><span className="sr-only">Aktionen</span></th>
                </tr>
              </thead>
              <tbody aria-busy={isMutating}>
                {optimisticItems.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Produkt">
                      <div className="product-cell">
                        <span className="product-cell__icon" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                        </span>
                        <span>
                          <strong>{item.product}</strong>
                          <small>{item.specification}</small>
                        </span>
                      </div>
                    </td>
                    <td data-label="Lieferdatum">
                      <span className="date-cell">
                        <CalendarDays size={17} aria-hidden="true" />
                        {dateFormatter.format(
                          new Date(`${item.deliveryDate}T12:00:00Z`),
                        )}
                      </span>
                    </td>
                    <td data-label="Menge">
                      {planning.editable ? (
                        <div className="quantity-control quantity-control--server">
                          <button
                            aria-label={`Menge für ${item.product} verringern`}
                            className="quantity-control__step"
                            disabled={isMutating}
                            onClick={() => mutateQuantity(item, item.amount - 1)}
                            type="button"
                          >
                            <Minus size={15} aria-hidden="true" />
                          </button>
                          <form
                            action={updateAction}
                            className="quantity-control__input-form"
                          >
                            <input name="demandItemId" type="hidden" value={item.id} />
                            <label>
                              <span className="sr-only">Menge für {item.product}</span>
                              <input
                                aria-label={`Menge für ${item.product}`}
                                defaultValue={item.amount}
                                key={`${item.id}-${item.amount}`}
                                max="500"
                                min="0.001"
                                name="quantity"
                                step="0.001"
                                type="number"
                              />
                              <span>{item.unit}</span>
                            </label>
                            <PendingButton
                              className="quantity-control__save"
                              pendingLabel="Menge wird gespeichert"
                            >
                              <Save size={14} aria-hidden="true" />
                              <span className="sr-only">
                                Menge für {item.product} speichern
                              </span>
                            </PendingButton>
                          </form>
                          <button
                            aria-label={`Menge für ${item.product} erhöhen`}
                            className="quantity-control__step"
                            disabled={isMutating}
                            onClick={() => mutateQuantity(item, item.amount + 1)}
                            type="button"
                          >
                            <Plus size={15} aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <strong className="quantity-readonly">
                          {item.amount} {item.unit}
                        </strong>
                      )}
                    </td>
                    <td>
                      {planning.editable ? (
                        <button
                          aria-label={`${item.product} entfernen`}
                          className="icon-button icon-button--danger"
                          disabled={isMutating}
                          onClick={() => removeItem(item)}
                          type="button"
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <PackagePlus size={30} aria-hidden="true" />
            <h3>Noch kein Bedarf eingetragen</h3>
            <p>
              {locked
                ? "Für diese Runde wurde kein Bedarf bestätigt."
                : templateItemCount > 0
                  ? "Übernimm deinen gespeicherten Stammbedarf oder füge eine erste Position hinzu."
                  : "Füge deine erste Position hinzu, damit sie in die Sammelrunde einfließt."}
            </p>
            {planning.editable ? (
              <button
                className="button button--primary"
                type="button"
                onClick={() => setComposerOpen(true)}
              >
                Bedarf eintragen
              </button>
            ) : null}
          </div>
        )}

        <footer className="demand-panel__footer">
          <span
            className={`save-message save-message--${message?.tone ?? "neutral"}`}
            role="status"
            aria-live="polite"
          >
            {message?.tone === "success" || liveNotice ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <Save size={15} aria-hidden="true" />
            )}
            {message?.text ?? liveNotice ?? "Alle Angaben werden sicher im Ladenkonto gespeichert"}
          </span>
          <span>
            {optimisticItems.length} Positionen · {snapshot.storeKg} kg gesamt
          </span>
        </footer>
      </section>

      {planning.editable ? (
        <section className="template-save-bar">
          <div>
            <span className="eyebrow">Wiederverwenden</span>
            <p>
              Speichere die aktuellen Positionen als Stammbedarf und übernimme
              sie künftig mit einem Klick in neue Sammelrunden.
            </p>
          </div>
          <form action={saveTemplateAction}>
            <TextSubmitButton
              className="button button--secondary"
              pendingLabel="Stammbedarf wird gespeichert …"
            >
              <Save size={17} aria-hidden="true" />
              Als Stammbedarf speichern
            </TextSubmitButton>
          </form>
        </section>
      ) : null}

      {planning.canConfirm ? (
        <section className="demand-confirm-bar">
          <div>
            <span className="eyebrow">Verbindliche Freigabe</span>
            <h2>Bedarf für die Bündelung bestätigen</h2>
            <p>
              Nach der Bestätigung werden die Positionen gesperrt und fließen in
              die regionale Gruppenmenge ein.
            </p>
          </div>
          <button
            className="button button--primary"
            onClick={() => setConfirmOpen(true)}
            ref={confirmTriggerRef}
            type="button"
          >
            Bestätigung prüfen
          </button>
        </section>
      ) : null}

      {confirmOpen && planning.canConfirm ? (
        <div className="modal-layer" role="presentation">
          <button
            className="modal-backdrop"
            type="button"
            aria-label="Prüfung schließen"
            onClick={() => setConfirmOpen(false)}
          />
          <section
            aria-labelledby="confirm-title"
            aria-describedby="confirm-description"
            aria-modal="true"
            className="modal-card demand-confirm-modal"
            ref={confirmDialogRef}
            role="dialog"
          >
            <div className="modal-card__header">
              <div>
                <span className="eyebrow">Letzte Prüfung</span>
                <h2 id="confirm-title">Bedarf verbindlich bestätigen?</h2>
              </div>
              <button
                aria-label="Prüfung schließen"
                className="icon-button"
                data-initial-focus
                onClick={() => setConfirmOpen(false)}
                type="button"
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <p id="confirm-description" className="demand-confirm-modal__intro">
              Nach der Bestätigung sind diese Positionen für die Sammelrunde
              gesperrt und zählen zur sichtbaren Gruppenmenge.
            </p>

            <dl className="demand-confirm-modal__facts">
              <div><dt>Sammelrunde</dt><dd>{planning.round.name}</dd></div>
              <div><dt>Lieferfenster</dt><dd>{planning.round.deliveryWindow}</dd></div>
              <div><dt>Gesamtmenge</dt><dd>{snapshot.storeKg} kg</dd></div>
              <div>
                <dt>Geschätzter Warenwert</dt>
                <dd>{formatCurrency(snapshot.storeKg * snapshot.activeTier.pricePerKg)}</dd>
              </div>
            </dl>

            <ul className="demand-confirm-modal__items" aria-label="Positionen">
              {optimisticItems.map((item) => (
                <li key={item.id}>
                  <span><strong>{item.product}</strong><small>{item.specification}</small></span>
                  <span><strong>{item.amount} {item.unit}</strong><small>{dateFormatter.format(new Date(`${item.deliveryDate}T12:00:00Z`))}</small></span>
                </li>
              ))}
            </ul>

            <div className="demand-confirm-modal__warning">
              <ShieldCheck aria-hidden="true" size={19} />
              <p>
                <strong>In dieser öffentlichen Demo entsteht keine echte Bestellung.</strong>
                Die Bestätigung sperrt ausschließlich die Beispieldaten in diesem Ladenkonto.
              </p>
            </div>

            <div className="modal-card__actions">
              <button
                className="button button--quiet"
                onClick={() => setConfirmOpen(false)}
                type="button"
              >
                Zurück und weiter bearbeiten
              </button>
              <form action={confirmAction}>
                <input name="buyingRoundId" type="hidden" value={planning.round.id} />
                <TextSubmitButton
                  className="button button--primary"
                  pendingLabel="Wird bestätigt …"
                >
                  Jetzt für die Demo-Gruppenmenge bestätigen
                </TextSubmitButton>
              </form>
            </div>
          </section>
        </div>
      ) : null}

      {composerOpen && planning.editable ? (
        <div className="modal-layer" role="presentation">
          <button
            className="modal-backdrop"
            type="button"
            aria-label="Dialog schließen"
            onClick={() => setComposerOpen(false)}
          />
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="composer-title"
          >
            <div className="modal-card__header">
              <div>
                <span className="eyebrow">Neue Position</span>
                <h2 id="composer-title">Bedarf hinzufügen</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Dialog schließen"
                onClick={() => setComposerOpen(false)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <form action={addAction} className="form-stack">
              <input name="buyingRoundId" type="hidden" value={planning.round.id} />
              <input
                name="specification"
                type="hidden"
                value={productSpecifications[product]}
              />
              <input name="unit" type="hidden" value="KG" />
              <label className="field">
                <span>Produkt</span>
                <span className="select-wrap">
                  <select
                    name="productName"
                    value={product}
                    onChange={(event) => setProduct(event.target.value)}
                  >
                    {Object.keys(productSpecifications).map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                  <ChevronDown size={17} aria-hidden="true" />
                </span>
                <small>{productSpecifications[product]}</small>
              </label>
              <div className="form-grid form-grid--two">
                <label className="field">
                  <span>Menge in kg</span>
                  <input
                    autoFocus
                    defaultValue="20"
                    max="500"
                    min="0.001"
                    name="quantity"
                    required
                    step="0.001"
                    type="number"
                  />
                </label>
                <label className="field">
                  <span>Lieferdatum</span>
                  <input
                    defaultValue={planning.round.deliveryDate}
                    name="requestedDeliveryDate"
                    required
                    type="date"
                  />
                </label>
              </div>
              <div className="modal-card__actions">
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => setComposerOpen(false)}
                >
                  Abbrechen
                </button>
                <TextSubmitButton
                  className="button button--primary"
                  pendingLabel="Wird hinzugefügt …"
                >
                  Position hinzufügen
                </TextSubmitButton>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
