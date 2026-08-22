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
    itemId: menu.some((item) => item.id === itemId)
      ? itemId!
      : (menu[0]?.id ?? ""),
    mode: pickupEnabled ? "PICKUP" : "DELIVERY",
    name: "",
    note: "",
    quantity: 1,
  };
}

export function StorefrontOrderSheet({
  children,
  deliveryEnabled,
  menu,
  pickupEnabled,
  preview = false,
  storeName,
  whatsappPhone,
}: StorefrontOrderSheetProps) {
  const [draft, setDraft] = useState(() =>
    initialDraft(menu, pickupEnabled),
  );
  const [errors, setErrors] = useState<StorefrontOrderErrors>({});
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const addressRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

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

  function submitOrder(event: FormEvent<HTMLFormElement>) {
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
      if (result.errors.address) addressRef.current?.focus();
      return;
    }
    setErrors({});
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

              <div className="storefront-order-summary">
                <span>Zusammenfassung</span>
                <strong>{draft.quantity} × {selectedItem?.name ?? "Gericht"}</strong>
                <b>{formatStorefrontPrice(totalPrice)}</b>
              </div>

              <button className="storefront-order-submit" type="submit">
                <Send aria-hidden="true" size={18} />
                {preview ? "WhatsApp-Nachricht prüfen" : "In WhatsApp öffnen"}
              </button>
              <p className="storefront-order-privacy">
                Kebapp speichert oder sendet diese Bestellung nicht. Du prüfst
                und sendest die Nachricht selbst in WhatsApp.
              </p>
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
