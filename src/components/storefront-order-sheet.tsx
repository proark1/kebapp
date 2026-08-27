"use client";

import { Check, Minus, Plus, Send, X } from "lucide-react";
import type { FormEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { MenuItem } from "@/lib/types";
import {
  formatStorefrontPrice,
  prepareStorefrontOrder,
  type StorefrontOrderDraft,
  type StorefrontOrderErrors,
} from "@/lib/storefront-order";

type StorefrontOrderSheetProps = {
  children: ReactNode;
  deliveryEnabled: boolean;
  menu: MenuItem[];
  pickupEnabled: boolean;
  preview?: boolean;
  publicSlug?: string;
  storeName: string;
  whatsappPhone: string;
};

const focusableSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function initialDraft(
  menu: MenuItem[],
  pickupEnabled: boolean,
  itemId?: string,
): StorefrontOrderDraft {
  return {
    address: "",
    consent: false,
    itemId: menu.some((item) => item.id === itemId)
      ? itemId!
      : (menu[0]?.id ?? ""),
    mode: pickupEnabled ? "PICKUP" : "DELIVERY",
    name: "",
    note: "",
    phone: "",
    quantity: 1,
  };
}

export function StorefrontOrderSheet({
  children,
  deliveryEnabled,
  menu,
  pickupEnabled,
  preview = false,
  publicSlug,
  storeName,
  whatsappPhone,
}: StorefrontOrderSheetProps) {
  const [draft, setDraft] = useState(() =>
    initialDraft(menu, pickupEnabled),
  );
  const [errors, setErrors] = useState<StorefrontOrderErrors>({});
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const addressRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const selectedItem = menu.find((item) => item.id === draft.itemId);
  const totalPrice = selectedItem ? selectedItem.price * draft.quantity : 0;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstFieldRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus();
    };
  }, [open]);

  function closeSheet() {
    setOpen(false);
    setFallbackUrl(null);
    setErrors({});
    setSaveNotice(null);
    setSaveFailed(false);
  }

  function handleDelegatedClick(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest<HTMLElement>(
      "[data-storefront-order-trigger]",
    );
    if (!trigger) return;
    event.preventDefault();
    openerRef.current = trigger;
    setDraft(
      initialDraft(
        menu,
        pickupEnabled,
        trigger.dataset.storefrontOrderItem,
      ),
    );
    setErrors({});
    setFallbackUrl(null);
    setSaveNotice(null);
    setSaveFailed(false);
    setOpen(true);
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSheet();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    );
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function updateDraft<K extends keyof StorefrontOrderDraft>(
    key: K,
    value: StorefrontOrderDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFallbackUrl(null);
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = prepareStorefrontOrder({
      deliveryEnabled,
      draft,
      menu,
      pickupEnabled,
      storeName,
      whatsappPhone,
    });
    if (!result.ok) {
      setErrors(result.errors);
      if (result.errors.phone) phoneRef.current?.focus();
      else if (result.errors.address) addressRef.current?.focus();
      return;
    }
    setErrors({});
    setSaveNotice(null);
    setSaveFailed(false);

    // Ohne Haken bleibt es bei der reinen WhatsApp-Nachricht. Nur mit
    // Einwilligung wird die Bestellung ueberhaupt an den Server geschickt.
    if (draft.consent && publicSlug && !preview) {
      setPending(true);
      try {
        const { submitStorefrontOrderAction } = await import(
          "@/app/laden/order-actions"
        );
        const saved = await submitStorefrontOrderAction({
          deliveryAddress: draft.address,
          itemId: draft.itemId,
          mode: draft.mode,
          name: draft.name,
          note: draft.note,
          phone: draft.phone,
          quantity: draft.quantity,
          slug: publicSlug,
        });
        if (saved.ok) {
          setSaveNotice(
            `Gespeichert – du hast jetzt ${saved.stampCount} Stempel bei ${storeName}.`,
          );
        } else {
          setSaveFailed(true);
          setSaveNotice(saved.message);
        }
      } catch {
        setSaveFailed(true);
        setSaveNotice(
          "Die Stempelkarte konnte nicht aktualisiert werden. Die Bestellung kannst du trotzdem senden.",
        );
      } finally {
        setPending(false);
      }
    }

    setFallbackUrl(result.url);
    if (!preview) {
      window.open(result.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="storefront-order-boundary" onClick={handleDelegatedClick}>
      {children}
      {open ? (
        <div
          className="storefront-order-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSheet();
          }}
        >
          <div
            aria-describedby="storefront-order-description"
            aria-labelledby="storefront-order-title"
            aria-modal="true"
            className="storefront-order-sheet"
            onKeyDown={handleDialogKeyDown}
            ref={dialogRef}
            role="dialog"
          >
            <header>
              <div>
                <span>Direkt beim Restaurant</span>
                <h2 id="storefront-order-title">Bestellung vorbereiten</h2>
                <p id="storefront-order-description">
                  Angaben ergänzen und anschließend selbst in WhatsApp senden.
                </p>
              </div>
              <button
                aria-label="Bestellfenster schließen"
                className="storefront-order-sheet__close"
                onClick={closeSheet}
                type="button"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </header>

            <form noValidate onSubmit={submitOrder}>
              <label className="storefront-order-field">
                <span>Gericht</span>
                <select
                  aria-describedby={errors.itemId ? "order-item-error" : undefined}
                  aria-invalid={Boolean(errors.itemId)}
                  onChange={(event) => updateDraft("itemId", event.target.value)}
                  ref={firstFieldRef}
                  value={draft.itemId}
                >
                  {menu.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {formatStorefrontPrice(item.price)}
                    </option>
                  ))}
                </select>
                {errors.itemId ? <small id="order-item-error" role="alert">{errors.itemId}</small> : null}
              </label>

              <div className="storefront-order-quantity">
                <span>Menge</span>
                <div>
                  <button
                    aria-label="Menge verringern"
                    disabled={draft.quantity <= 1}
                    onClick={() => updateDraft("quantity", draft.quantity - 1)}
                    type="button"
                  ><Minus aria-hidden="true" size={16} /></button>
                  <input
                    aria-describedby={errors.quantity ? "order-quantity-error" : undefined}
                    aria-invalid={Boolean(errors.quantity)}
                    aria-label="Menge"
                    max={20}
                    min={1}
                    onChange={(event) => updateDraft("quantity", Number(event.target.value))}
                    type="number"
                    value={draft.quantity}
                  />
                  <button
                    aria-label="Menge erhöhen"
                    disabled={draft.quantity >= 20}
                    onClick={() => updateDraft("quantity", draft.quantity + 1)}
                    type="button"
                  ><Plus aria-hidden="true" size={16} /></button>
                </div>
                {errors.quantity ? <small id="order-quantity-error" role="alert">{errors.quantity}</small> : null}
              </div>

              {pickupEnabled && deliveryEnabled ? (
                <fieldset className="storefront-order-modes">
                  <legend>Bestellart</legend>
                  {([
                    ["PICKUP", "Abholung"],
                    ["DELIVERY", "Lieferung"],
                  ] as const).map(([value, label]) => (
                    <label key={value}>
                      <input
                        checked={draft.mode === value}
                        name="order-mode"
                        onChange={() => updateDraft("mode", value)}
                        type="radio"
                        value={value}
                      />
                      <span><Check aria-hidden="true" size={14} />{label}</span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <p className="storefront-order-mode-summary">
                  Bestellart: <strong>{pickupEnabled ? "Abholung" : "Lieferung"}</strong>
                </p>
              )}
              {errors.mode ? <small className="storefront-order-error" role="alert">{errors.mode}</small> : null}

              <label className="storefront-order-field">
                <span>Name <small>optional</small></span>
                <input
                  autoComplete="name"
                  maxLength={120}
                  onChange={(event) => updateDraft("name", event.target.value)}
                  value={draft.name}
                />
                {errors.name ? <small role="alert">{errors.name}</small> : null}
              </label>

              {draft.mode === "DELIVERY" ? (
                <label className="storefront-order-field">
                  <span>Lieferadresse</span>
                  <input
                    aria-describedby={errors.address ? "order-address-error" : undefined}
                    aria-invalid={Boolean(errors.address)}
                    autoComplete="street-address"
                    maxLength={240}
                    onChange={(event) => updateDraft("address", event.target.value)}
                    ref={addressRef}
                    value={draft.address}
                  />
                  {errors.address ? <small id="order-address-error" role="alert">{errors.address}</small> : null}
                </label>
              ) : null}

              <label className="storefront-order-field">
                <span>Anmerkung <small>optional</small></span>
                <textarea
                  maxLength={300}
                  onChange={(event) => updateDraft("note", event.target.value)}
                  placeholder="Zum Beispiel: ohne Zwiebeln"
                  rows={3}
                  value={draft.note}
                />
                {errors.note ? <small role="alert">{errors.note}</small> : null}
              </label>

              <div className="storefront-order-consent">
                <label className="storefront-order-consent__check">
                  <input
                    checked={draft.consent}
                    onChange={(event) =>
                      updateDraft("consent", event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>
                    Stempelkarte sammeln: Nummer und Bestellung bei{" "}
                    {storeName} speichern
                  </span>
                </label>
                {draft.consent ? (
                  <label className="storefront-order-field">
                    <span>Telefonnummer</span>
                    <input
                      aria-describedby={
                        errors.phone ? "order-phone-error" : undefined
                      }
                      aria-invalid={Boolean(errors.phone)}
                      autoComplete="tel"
                      inputMode="tel"
                      maxLength={40}
                      onChange={(event) =>
                        updateDraft("phone", event.target.value)
                      }
                      placeholder="0176 1234567"
                      ref={phoneRef}
                      type="tel"
                      value={draft.phone}
                    />
                    {errors.phone ? (
                      <small id="order-phone-error" role="alert">
                        {errors.phone}
                      </small>
                    ) : null}
                  </label>
                ) : null}
              </div>

              <div className="storefront-order-summary">
                <span>Zusammenfassung</span>
                <strong>{draft.quantity} × {selectedItem?.name ?? "Gericht"}</strong>
                <b>{formatStorefrontPrice(totalPrice)}</b>
              </div>

              <button
                className="storefront-order-submit"
                disabled={pending}
                type="submit"
              >
                <Send aria-hidden="true" size={18} />
                {pending
                  ? "Wird gespeichert …"
                  : preview
                    ? "WhatsApp-Nachricht prüfen"
                    : "In WhatsApp öffnen"}
              </button>
              <p className="storefront-order-privacy">
                {draft.consent
                  ? `${storeName} speichert Nummer, Name und diese Bestellung für die Stempelkarte. Du kannst die Löschung jederzeit im Laden verlangen. Die Nachricht sendest du weiterhin selbst in WhatsApp.`
                  : "Ohne Haken speichert Kebapp nichts. Du prüfst und sendest die Nachricht selbst in WhatsApp."}
              </p>
              {saveNotice ? (
                <p
                  className={
                    saveFailed
                      ? "storefront-order-notice storefront-order-notice--error"
                      : "storefront-order-notice"
                  }
                  role="status"
                >
                  {saveNotice}
                </p>
              ) : null}
              {fallbackUrl ? (
                preview ? (
                  <p className="storefront-order-preview-status" role="status">
                    Vorschau geprüft – WhatsApp wird im Editor nicht geöffnet.
                  </p>
                ) : (
                  <a className="storefront-order-fallback" href={fallbackUrl} rel="noreferrer" target="_blank">
                    WhatsApp erneut öffnen
                  </a>
                )
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
