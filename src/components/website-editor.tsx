"use client";

import { Check, ExternalLink, Eye, Globe2, Palette, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Storefront } from "@/components/storefront";
import { demoStoreProfile } from "@/lib/demo-data";
import { loadStoreProfile, saveStoreProfile } from "@/lib/storage";
import type { StoreProfile } from "@/lib/types";

export function WebsiteEditor() {
  const [profile, setProfile] = useState<StoreProfile>(demoStoreProfile);
  const [message, setMessage] = useState("Noch nicht geändert");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "error">("neutral");

  useEffect(() => {
    const savedProfile = loadStoreProfile(window.localStorage);
    if (!savedProfile) {
      return;
    }

    const timer = window.setTimeout(() => {
      setProfile(savedProfile);
      setMessage("Gespeicherte Website geladen");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function updateField<K extends keyof StoreProfile>(key: K, value: StoreProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setMessage("Ungespeicherte Änderungen");
    setMessageTone("neutral");
  }

  function updateMenuItem(id: string, field: "name" | "price", value: string) {
    setProfile((current) => ({
      ...current,
      menu: current.menu.map((item) =>
        item.id === id
          ? { ...item, [field]: field === "price" ? Number(value) : value }
          : item,
      ),
    }));
    setMessage("Ungespeicherte Änderungen");
    setMessageTone("neutral");
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile.name.trim() || !profile.phone.trim() || !profile.street.trim()) {
      setMessage("Name, Telefon und Adresse müssen ausgefüllt sein");
      setMessageTone("error");
      return;
    }

    const saved = saveStoreProfile(window.localStorage, profile);
    setMessage(saved ? "Website-Einstellungen gespeichert" : "Einstellungen konnten nicht gespeichert werden");
    setMessageTone(saved ? "success" : "error");
  }

  return (
    <div className="page-stack website-editor-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Kostenlose Internetseite</span>
          <h1>Deine Website</h1>
          <p>Ändere die wichtigsten Angaben. Rechts siehst du sofort das Ergebnis.</p>
        </div>
        <div className="website-live-badge">
          <Globe2 size={18} aria-hidden="true" />
          <span>
            ocakbasi-rheydt.de
            <strong><i aria-hidden="true" /> SSL aktiv</strong>
          </span>
          <Link href="/laden/ocakbasi-rheydt" target="_blank" aria-label="Öffentliche Website öffnen">
            <ExternalLink size={18} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <div className="editor-layout">
        <form className="editor-panel" onSubmit={save}>
          <section>
            <div className="editor-section-title">
              <span><Palette size={17} aria-hidden="true" /></span>
              <div>
                <h2>Auftritt</h2>
                <p>Name, Botschaft und Farbe</p>
              </div>
            </div>
            <div className="form-stack">
              <label className="field">
                <span>Ladenname</span>
                <input value={profile.name} onChange={(event) => updateField("name", event.target.value)} />
              </label>
              <label className="field">
                <span>Kleine Zeile</span>
                <input value={profile.eyebrow} onChange={(event) => updateField("eyebrow", event.target.value)} />
              </label>
              <label className="field">
                <span>Hauptüberschrift</span>
                <textarea rows={2} value={profile.tagline} onChange={(event) => updateField("tagline", event.target.value)} />
              </label>
              <label className="field">
                <span>Kurzbeschreibung</span>
                <textarea rows={3} value={profile.description} onChange={(event) => updateField("description", event.target.value)} />
              </label>
              <label className="field color-field">
                <span>Akzentfarbe</span>
                <span>
                  <input type="color" value={profile.accent} onChange={(event) => updateField("accent", event.target.value)} />
                  <input value={profile.accent.toUpperCase()} onChange={(event) => updateField("accent", event.target.value)} />
                </span>
              </label>
            </div>
          </section>

          <section>
            <div className="editor-section-title">
              <span><Globe2 size={17} aria-hidden="true" /></span>
              <div>
                <h2>Kontakt</h2>
                <p>Direkt erreichbar, ohne Formular</p>
              </div>
            </div>
            <div className="form-stack">
              <label className="field">
                <span>Telefon</span>
                <input type="tel" value={profile.phone} onChange={(event) => updateField("phone", event.target.value)} />
              </label>
              <label className="field">
                <span>Straße und Hausnummer</span>
                <input value={profile.street} onChange={(event) => updateField("street", event.target.value)} />
              </label>
              <label className="field">
                <span>PLZ und Ort</span>
                <input value={profile.city} onChange={(event) => updateField("city", event.target.value)} />
              </label>
            </div>
          </section>

          <section>
            <div className="editor-section-title">
              <span><Eye size={17} aria-hidden="true" /></span>
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
                    <input value={item.name} onChange={(event) => updateMenuItem(item.id, "name", event.target.value)} />
                  </label>
                  <label className="field field--price">
                    <span>Preis</span>
                    <input type="number" min="0" step="0.1" value={item.price} onChange={(event) => updateMenuItem(item.id, "price", event.target.value)} />
                    <i>€</i>
                  </label>
                </div>
              ))}
            </div>
          </section>

          <footer className="editor-panel__footer">
            <span className={`save-message save-message--${messageTone}`} role="status" aria-live="polite">
              {messageTone === "success" ? <Check size={15} aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
              {message}
            </span>
            <div className="editor-panel__actions">
              <Link className="button button--secondary editor-mobile-preview" href="/laden/ocakbasi-rheydt" target="_blank">
                <ExternalLink size={17} aria-hidden="true" />
                Vorschau öffnen
              </Link>
              <button className="button button--primary" type="submit">
                <Save size={17} aria-hidden="true" />
                Änderungen speichern
              </button>
            </div>
          </footer>
        </form>

        <aside className="preview-panel" aria-label="Website-Vorschau">
          <div className="preview-panel__toolbar">
            <span>
              <i /><i /><i />
            </span>
            <strong>Live-Vorschau</strong>
            <small>Mobil & Desktop</small>
          </div>
          <div className="preview-panel__viewport">
            <Storefront initialProfile={profile} preview />
          </div>
        </aside>
      </div>
    </div>
  );
}
