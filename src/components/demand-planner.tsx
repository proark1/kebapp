"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Minus,
  PackagePlus,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { BuyingRoundMeter } from "@/components/buying-round-meter";
import {
  formatCurrency,
  getBuyingRoundSnapshot,
} from "@/lib/calculations";
import { buyingRound, initialDemands } from "@/lib/demo-data";
import { loadDemands, saveDemands } from "@/lib/storage";
import type { DemandItem } from "@/lib/types";

const productSpecifications: Record<string, string> = {
  "Kalb-Drehspieß": "20 kg · Scheibenanteil 60 % · halal",
  "Hähnchen-Drehspieß": "15 kg · gewürzt · halal",
  "Rind-Drehspieß": "20 kg · Hackanteil max. 40 % · halal",
};

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `demand-${Date.now()}`;
}

export function DemandPlanner() {
  const [items, setItems] = useState<DemandItem[]>(initialDemands);
  const [composerOpen, setComposerOpen] = useState(false);
  const [product, setProduct] = useState("Kalb-Drehspieß");
  const [amount, setAmount] = useState("20");
  const [deliveryDate, setDeliveryDate] = useState("2026-08-24");
  const [message, setMessage] = useState("Demodaten geladen");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "error">("neutral");

  useEffect(() => {
    const savedItems = loadDemands(window.localStorage);
    if (!savedItems) {
      return;
    }

    const timer = window.setTimeout(() => {
      setItems(savedItems);
      setMessage("Gespeicherter Bedarf geladen");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const snapshot = getBuyingRoundSnapshot(buyingRound, items);

  function persist(nextItems: DemandItem[], successMessage: string) {
    const saved = saveDemands(window.localStorage, nextItems);
    if (!saved) {
      setMessage("Änderung sichtbar, aber lokal nicht gespeichert");
      setMessageTone("error");
      return;
    }

    setMessage(successMessage);
    setMessageTone("success");
  }

  function updateAmount(id: string, nextAmount: number) {
    if (!Number.isFinite(nextAmount) || nextAmount < 1 || nextAmount > 500) {
      setMessage("Menge muss zwischen 1 und 500 liegen");
      setMessageTone("error");
      return;
    }

    const nextItems = items.map((item) =>
      item.id === id ? { ...item, amount: nextAmount } : item,
    );
    setItems(nextItems);
    persist(nextItems, "Menge automatisch gespeichert");
  }

  function removeItem(id: string) {
    const nextItems = items.filter((item) => item.id !== id);
    setItems(nextItems);
    persist(nextItems, "Position entfernt");
  }

  function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount.replace(",", "."));

    if (!Number.isFinite(parsedAmount) || parsedAmount < 1 || parsedAmount > 500) {
      setMessage("Bitte eine Menge zwischen 1 und 500 kg eintragen");
      setMessageTone("error");
      return;
    }

    const nextItem: DemandItem = {
      id: createId(),
      product,
      specification: productSpecifications[product] ?? "Standardspezifikation",
      amount: parsedAmount,
      unit: "kg",
      deliveryDate,
    };
    const nextItems = [...items, nextItem];
    setItems(nextItems);
    persist(nextItems, "Position hinzugefügt und gespeichert");
    setComposerOpen(false);
    setAmount("20");
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Gruppeneinkauf</span>
          <h1>Dein Fleischbedarf</h1>
          <p>Bestätige, was du für die nächste Lieferung brauchst.</p>
        </div>
        <div className="deadline-badge">
          <Clock3 size={18} aria-hidden="true" />
          <span>
            Bestellschluss
            <strong>Sa., 18:00 Uhr</strong>
          </span>
        </div>
      </header>

      <section className="buying-summary-grid" aria-label="Zusammenfassung der Sammelrunde">
        <BuyingRoundMeter round={buyingRound} demands={items} compact />

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
            Berechnet gegen deinen bisherigen Referenzpreis von {formatCurrency(buyingRound.referencePricePerKg)} je kg.
          </p>
        </article>
      </section>

      <section className="panel demand-panel">
        <div className="panel__header demand-panel__header">
          <div>
            <span className="eyebrow">Lieferung</span>
            <h2>Montag, 24. August</h2>
            <p>Geplant zwischen 06:00 und 09:00 Uhr</p>
          </div>
          <button
            className="button button--primary"
            type="button"
            onClick={() => setComposerOpen(true)}
          >
            <Plus size={18} aria-hidden="true" />
            Position hinzufügen
          </button>
        </div>

        {items.length > 0 ? (
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
              <tbody>
                {items.map((item) => (
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
                        24.08.2026
                      </span>
                    </td>
                    <td data-label="Menge">
                      <div className="quantity-control">
                        <button
                          type="button"
                          aria-label={`${item.product}: Menge um 1 kg verringern`}
                          onClick={() => updateAmount(item.id, item.amount - 1)}
                        >
                          <Minus size={15} aria-hidden="true" />
                        </button>
                        <label>
                          <span className="sr-only">Menge für {item.product}</span>
                          <input
                            aria-label={`Menge für ${item.product}`}
                            type="number"
                            min="1"
                            max="500"
                            value={item.amount}
                            onChange={(event) =>
                              updateAmount(item.id, Number(event.target.value))
                            }
                          />
                          <span>{item.unit}</span>
                        </label>
                        <button
                          type="button"
                          aria-label={`${item.product}: Menge um 1 kg erhöhen`}
                          onClick={() => updateAmount(item.id, item.amount + 1)}
                        >
                          <Plus size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                    <td>
                      <button
                        className="icon-button icon-button--danger"
                        type="button"
                        aria-label={`${item.product} entfernen`}
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
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
            <p>Füge deine erste Position hinzu, damit sie in die Sammelrunde einfließt.</p>
            <button className="button button--primary" type="button" onClick={() => setComposerOpen(true)}>
              Bedarf eintragen
            </button>
          </div>
        )}

        <footer className="demand-panel__footer">
          <span className={`save-message save-message--${messageTone}`} role="status" aria-live="polite">
            {messageTone === "success" ? <Check size={15} aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
            {message}
          </span>
          <span>{items.length} Positionen · {snapshot.storeKg} kg gesamt</span>
        </footer>
      </section>

      {composerOpen ? (
        <div className="modal-layer" role="presentation">
          <button
            className="modal-backdrop"
            type="button"
            aria-label="Dialog schließen"
            onClick={() => setComposerOpen(false)}
          />
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="composer-title">
            <div className="modal-card__header">
              <div>
                <span className="eyebrow">Neue Position</span>
                <h2 id="composer-title">Bedarf hinzufügen</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Dialog schließen" onClick={() => setComposerOpen(false)}>
                <X aria-hidden="true" />
              </button>
            </div>
            <form className="form-stack" onSubmit={addItem}>
              <label className="field">
                <span>Produkt</span>
                <span className="select-wrap">
                  <select value={product} onChange={(event) => setProduct(event.target.value)}>
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
                    type="number"
                    min="1"
                    max="500"
                    step="1"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    autoFocus
                  />
                </label>
                <label className="field">
                  <span>Lieferdatum</span>
                  <input type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} />
                </label>
              </div>
              <div className="modal-card__actions">
                <button className="button button--quiet" type="button" onClick={() => setComposerOpen(false)}>
                  Abbrechen
                </button>
                <button className="button button--primary" type="submit">
                  <Plus size={17} aria-hidden="true" />
                  Position hinzufügen
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
