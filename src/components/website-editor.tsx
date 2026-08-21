"use client";

import {
  Check,
  ExternalLink,
  Eye,
  Globe2,
  Palette,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Storefront } from "@/components/storefront";
import type { StoreProfile, StorefrontEditorData } from "@/lib/types";

type WebsiteEditorProps = {
  initialData: StorefrontEditorData;
  messageCode?: string;
  saveAction: (formData: FormData) => Promise<void>;
};

const messages: Record<
  string,
  { text: string; tone: "error" | "success" }
> = {
  gespeichert: { text: "Website-Entwurf gespeichert", tone: "success" },
  ungueltig: {
    text: "Einige Angaben sind ungültig. Prüfe die markierten Felder.",
    tone: "error",
  },
  unvollstaendig: {
    text: "Zum Veröffentlichen fehlen Kontakt, Adresse, Öffnungszeiten oder Speisekarte.",
    tone: "error",
  },
  veroeffentlicht: {
    text: "Website gespeichert und öffentlich erreichbar",
    tone: "success",
  },
};

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button button--primary" disabled={pending} type="submit">
      <Save size={17} aria-hidden="true" />
      {pending ? "Wird gespeichert …" : "Änderungen speichern"}
    </button>
  );
}

export function WebsiteEditor({
  initialData,
  messageCode,
  saveAction,
}: WebsiteEditorProps) {
  const [profile, setProfile] = useState<StoreProfile>(initialData.profile);
  const [isPublished, setIsPublished] = useState(initialData.isPublished);
  const [dirty, setDirty] = useState(false);
  const resultMessage = messageCode ? messages[messageCode] : undefined;
  const message = dirty
    ? "Ungespeicherte Änderungen"
    : (resultMessage?.text ?? "Noch nicht geändert");
  const messageTone = dirty ? "neutral" : (resultMessage?.tone ?? "neutral");
  const publicAddress = initialData.customDomain ?? initialData.publicPath;

  function updateField<K extends keyof StoreProfile>(
    key: K,
    value: StoreProfile[K],
  ) {
    setProfile((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function updateMenuItem(
    id: string,
    field: "name" | "price",
    value: string,
  ) {
    setProfile((current) => ({
      ...current,
      menu: current.menu.map((item) =>
        item.id === id
          ? { ...item, [field]: field === "price" ? Number(value) : value }
          : item,
      ),
    }));
    setDirty(true);
  }

  return (
    <div className="page-stack website-editor-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Kostenlose Internetseite</span>
          <h1>Deine Website</h1>
          <p>
            Ändere die wichtigsten Angaben. Rechts siehst du sofort das Ergebnis.
          </p>
        </div>
        <div className="website-live-badge">
          <Globe2 size={18} aria-hidden="true" />
          <span>
            {publicAddress}
            <strong>
              <i aria-hidden="true" />
              {isPublished ? "Öffentlich" : "Entwurf"}
            </strong>
          </span>
          {isPublished ? (
            <Link
              href={initialData.publicPath}
              target="_blank"
              aria-label="Öffentliche Website öffnen"
            >
              <ExternalLink size={18} aria-hidden="true" />
            </Link>
          ) : (
            <span className="website-live-badge__inactive" aria-hidden="true">
              <ExternalLink size={18} />
            </span>
          )}
        </div>
      </header>

      <div className="editor-layout">
        <form className="editor-panel" action={saveAction}>
          <input
            name="profile"
            type="hidden"
            value={JSON.stringify(profile)}
          />

          <section className="publication-section">
            <div className="editor-section-title">
              <span>
                <Globe2 size={17} aria-hidden="true" />
              </span>
              <div>
                <h2>Veröffentlichung</h2>
                <p>Du entscheidest, wann die Seite öffentlich ist.</p>
              </div>
            </div>
            <label className="publication-control">
              <input
                checked={isPublished}
                name="isPublished"
                onChange={(event) => {
                  setIsPublished(event.target.checked);
                  setDirty(true);
                }}
                type="checkbox"
              />
              <span aria-hidden="true" />
              <strong>
                {isPublished
                  ? "Website öffentlich anzeigen"
                  : "Als Entwurf speichern"}
              </strong>
            </label>
          </section>

          <section>
            <div className="editor-section-title">
              <span>
                <Palette size={17} aria-hidden="true" />
              </span>
              <div>
                <h2>Auftritt</h2>
                <p>Name, Botschaft und Farbe</p>
              </div>
            </div>
            <div className="form-stack">
              <label className="field">
                <span>Ladenname</span>
                <input
                  maxLength={180}
                  required
                  value={profile.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Kleine Zeile</span>
                <input
                  maxLength={180}
                  value={profile.eyebrow}
                  onChange={(event) =>
                    updateField("eyebrow", event.target.value)
                  }
                />
              </label>
              <label className="field">
                <span>Hauptüberschrift</span>
                <textarea
                  maxLength={240}
                  required={isPublished}
                  rows={2}
                  value={profile.tagline}
                  onChange={(event) =>
                    updateField("tagline", event.target.value)
                  }
                />
              </label>
              <label className="field">
                <span>Kurzbeschreibung</span>
                <textarea
                  maxLength={2_000}
                  required={isPublished}
                  rows={3}
                  value={profile.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                />
              </label>
              <label className="field color-field">
                <span>Akzentfarbe</span>
                <span>
                  <input
                    type="color"
                    value={profile.accent}
                    onChange={(event) =>
                      updateField("accent", event.target.value)
                    }
                  />
                  <input
                    aria-label="Akzentfarbe als Hexwert"
                    pattern="#[0-9A-Fa-f]{6}"
                    value={profile.accent.toUpperCase()}
                    onChange={(event) =>
                      updateField("accent", event.target.value)
                    }
                  />
                </span>
              </label>
            </div>
          </section>

          <section>
            <div className="editor-section-title">
              <span>
                <Globe2 size={17} aria-hidden="true" />
              </span>
              <div>
                <h2>Kontakt</h2>
                <p>Direkt erreichbar, ohne Formular</p>
              </div>
            </div>
            <div className="form-stack">
              <label className="field">
                <span>Telefon</span>
                <input
                  maxLength={40}
                  required={isPublished}
                  type="tel"
                  value={profile.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Straße und Hausnummer</span>
                <input
                  maxLength={220}
                  required={isPublished}
                  value={profile.street}
                  onChange={(event) =>
                    updateField("street", event.target.value)
                  }
                />
              </label>
              <div className="address-field-row">
                <label className="field">
                  <span>PLZ</span>
                  <input
                    maxLength={16}
                    required={isPublished}
                    value={profile.postalCode}
                    onChange={(event) =>
                      updateField("postalCode", event.target.value)
                    }
                  />
                </label>
                <label className="field">
                  <span>Ort</span>
                  <input
                    maxLength={120}
                    required={isPublished}
                    value={profile.city}
                    onChange={(event) =>
                      updateField("city", event.target.value)
                    }
                  />
                </label>
              </div>
            </div>
          </section>

          <section>
            <div className="editor-section-title">
              <span>
                <Eye size={17} aria-hidden="true" />
              </span>
              <div>
                <h2>Speisekarte</h2>
                <p>Auswahl und Preise</p>
              </div>
            </div>
            <div className="menu-editor-list">
              {profile.menu.map((item) => (
                <div key={item.id}>
                  <label className="field">
                    <span>Gericht</span>
                    <input
                      maxLength={120}
                      required
                      value={item.name}
                      onChange={(event) =>
                        updateMenuItem(item.id, "name", event.target.value)
                      }
                    />
                  </label>
                  <label className="field field--price">
                    <span>Preis</span>
                    <input
                      max="1000"
                      min="0"
                      required
                      step="0.1"
                      type="number"
                      value={item.price}
                      onChange={(event) =>
                        updateMenuItem(item.id, "price", event.target.value)
                      }
                    />
                    <i>€</i>
                  </label>
                </div>
              ))}
            </div>
          </section>

          <footer className="editor-panel__footer">
            <span
              className={`save-message save-message--${messageTone}`}
              role="status"
              aria-live="polite"
            >
              {messageTone === "success" ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Save size={15} aria-hidden="true" />
              )}
              {message}
            </span>
            <div className="editor-panel__actions">
              {isPublished ? (
                <Link
                  className="button button--secondary editor-mobile-preview"
                  href={initialData.publicPath}
                  target="_blank"
                >
                  <ExternalLink size={17} aria-hidden="true" />
                  Seite öffnen
                </Link>
              ) : null}
              <SaveButton />
            </div>
          </footer>
        </form>

        <aside className="preview-panel" aria-label="Website-Vorschau">
          <div className="preview-panel__toolbar">
            <span>
              <i />
              <i />
              <i />
            </span>
            <strong>Live-Vorschau</strong>
            <small>Mobil &amp; Desktop</small>
          </div>
          <div className="preview-panel__viewport">
            <Storefront profile={profile} preview />
          </div>
        </aside>
      </div>
    </div>
  );
}
