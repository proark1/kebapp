"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  Eye,
  Globe2,
  ImagePlus,
  Palette,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Storefront } from "@/components/storefront";
import {
  STORE_FEATURES,
  type MenuItem,
  type OpeningHour,
  type StoreFeature,
  type StoreProfile,
  type StorefrontEditorData,
} from "@/lib/types";

const MAX_LOGO_BYTES = 350 * 1_024;
const MAX_HERO_BYTES = 1_024 * 1_024;
const logoTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const menuCategories: MenuItem["category"][] = [
  "Döner",
  "Teller",
  "Vegetarisch",
  "Getränke",
];
const featureLabels: Record<StoreFeature, string> = {
  HALAL: "Halal",
  FRESH_VEGETABLES: "Frisches Gemüse",
  HOMEMADE_SAUCES: "Hausgemachte Saucen",
  PREPARED_ON_SITE: "Vor Ort zubereitet",
};

type WebsiteEditorProps = {
  domainAction: (formData: FormData) => Promise<void>;
  initialData: StorefrontEditorData;
  messageCode?: string;
  saveAction: (formData: FormData) => Promise<void>;
};

const messages: Record<string, { text: string; tone: "error" | "success" }> = {
  "domain-fehler": {
    text: "Die Domain konnte nicht vorgemerkt werden.",
    tone: "error",
  },
  "domain-ungueltig": {
    text: "Bitte gib eine gültige Domain ohne https:// oder Pfad ein.",
    tone: "error",
  },
  "domain-vorgemerkt": {
    text: "Domain zur fachlichen Prüfung vorgemerkt",
    tone: "success",
  },
  gespeichert: { text: "Website-Entwurf gespeichert", tone: "success" },
  ungueltig: {
    text: "Einige Angaben sind ungültig. Prüfe die markierten Felder.",
    tone: "error",
  },
  unvollstaendig: {
    text: "Zum Veröffentlichen fehlen Kontakt, Adresse, Öffnungszeiten, Speisekarte oder Bestelloptionen.",
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

function DomainButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button button--secondary" disabled={pending} type="submit">
      <Globe2 size={17} aria-hidden="true" />
      {pending ? "Wird vorgemerkt …" : "Zur Prüfung vormerken"}
    </button>
  );
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function WebsiteEditor({
  domainAction,
  initialData,
  messageCode,
  saveAction,
}: WebsiteEditorProps) {
  const [profile, setProfile] = useState<StoreProfile>(initialData.profile);
  const [isPublished, setIsPublished] = useState(initialData.isPublished);
  const [dirty, setDirty] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [heroError, setHeroError] = useState<string | null>(null);
  const [requestedDomain, setRequestedDomain] = useState(
    initialData.requestedDomain ?? "",
  );
  const resultMessage = messageCode ? messages[messageCode] : undefined;
  const message = dirty
    ? "Ungespeicherte Änderungen"
    : (resultMessage?.text ?? "Noch nicht geändert");
  const messageTone = dirty ? "neutral" : (resultMessage?.tone ?? "neutral");
  const publicAddress = initialData.customDomain
    ? `https://${initialData.customDomain}`
    : initialData.publicPath;

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty]);

  function updateField<K extends keyof StoreProfile>(
    key: K,
    value: StoreProfile[K],
  ) {
    setProfile((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function updateOpeningHour(
    index: number,
    field: keyof OpeningHour,
    value: string,
  ) {
    updateField(
      "openingHours",
      profile.openingHours.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry,
      ),
    );
  }

  function updateMenuItem<K extends keyof MenuItem>(
    id: string,
    field: K,
    value: MenuItem[K],
  ) {
    updateField(
      "menu",
      profile.menu.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  }

  function addMenuItem() {
    if (profile.menu.length >= 40) return;
    updateField("menu", [
      ...profile.menu,
      {
        category: "Döner",
        description: "",
        id: `menu-${crypto.randomUUID()}`,
        name: "Neues Gericht",
        price: 0,
      },
    ]);
  }

  function handleLogo(file?: File) {
    if (!file) return;
    if (!logoTypes.has(file.type)) {
      setLogoError("Bitte PNG, JPEG oder WebP auswählen. SVG-Dateien sind nicht erlaubt.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("Das Logo ist größer als 350 KiB.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") return;
      setLogoError(null);
      updateField("logoUrl", reader.result);
    });
    reader.readAsDataURL(file);
  }

  function handleHeroImage(file?: File) {
    if (!file) return;
    if (!logoTypes.has(file.type)) {
      setHeroError("Bitte PNG, JPEG oder WebP auswählen. SVG-Dateien sind nicht erlaubt.");
      return;
    }
    if (file.size > MAX_HERO_BYTES) {
      setHeroError("Das Headerbild ist größer als 1 MiB.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") return;
      setHeroError(null);
      updateField("heroImageUrl", reader.result);
    });
    reader.readAsDataURL(file);
  }

  function toggleFeature(feature: StoreFeature, checked: boolean) {
    updateField(
      "features",
      checked
        ? [...profile.features, feature]
        : profile.features.filter((candidate) => candidate !== feature),
    );
  }

  return (
    <div className="page-stack website-editor-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Kostenlose Internetseite</span>
          <h1>Deine Website</h1>
          <p>Inhalte, Logo, Öffnungszeiten und Speisekarte an einem Ort pflegen.</p>
        </div>
        <div className="website-live-badge">
          <Globe2 size={18} aria-hidden="true" />
          <span>
            {publicAddress}
            <strong><i aria-hidden="true" />{isPublished ? "Öffentlich" : "Entwurf"}</strong>
          </span>
          {isPublished ? (
            <Link href={initialData.publicPath} target="_blank" aria-label="Öffentliche Website öffnen">
              <ExternalLink size={18} aria-hidden="true" />
            </Link>
          ) : (
            <span className="website-live-badge__inactive" aria-hidden="true"><ExternalLink size={18} /></span>
          )}
        </div>
      </header>

      <div className="editor-layout">
        <form
          action={saveAction}
          className="editor-panel"
          onSubmit={() => setDirty(false)}
        >
          <input name="profile" type="hidden" value={JSON.stringify(profile)} />

          <section className="publication-section">
            <div className="editor-section-title">
              <span><Globe2 size={17} aria-hidden="true" /></span>
              <div><h2>Veröffentlichung</h2><p>Du entscheidest, wann die Seite öffentlich ist.</p></div>
            </div>
            <label className="publication-control">
              <input
                checked={isPublished}
                name="isPublished"
                onChange={(event) => { setIsPublished(event.target.checked); setDirty(true); }}
                type="checkbox"
              />
              <span aria-hidden="true" />
              <strong>{isPublished ? "Website öffentlich anzeigen" : "Als Entwurf speichern"}</strong>
            </label>
          </section>

          <section>
            <div className="editor-section-title">
              <span><Palette size={17} aria-hidden="true" /></span>
              <div><h2>Auftritt</h2><p>Name, Logo, Botschaft und Farbe</p></div>
            </div>
            <div className="form-stack">
              <div className="logo-editor">
                <div className="logo-editor__preview" aria-label="Logo-Vorschau">
                  {profile.logoUrl ? (
                    <Image alt={`Logo von ${profile.name}`} height={84} src={profile.logoUrl} unoptimized width={84} />
                  ) : (
                    <strong>{profile.shortName}</strong>
                  )}
                </div>
                <div>
                  <label className="button button--secondary logo-editor__upload">
                    <ImagePlus size={17} aria-hidden="true" /> Logo auswählen
                    <input
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(event) => handleLogo(event.target.files?.[0])}
                      type="file"
                    />
                  </label>
                  {profile.logoUrl ? (
                    <button className="button button--quiet" onClick={() => updateField("logoUrl", "")} type="button">
                      Logo entfernen
                    </button>
                  ) : null}
                  <small>PNG, JPEG oder WebP · maximal 350 KiB · kein SVG</small>
                  {logoError ? <p className="editor-field-error" role="alert">{logoError}</p> : null}
                </div>
              </div>
              <div className="hero-image-editor">
                <div className="hero-image-editor__preview">
                  <Image
                    alt={`Headerbild-Vorschau von ${profile.name}`}
                    fill
                    sizes="360px"
                    src={profile.heroImageUrl || "/images/storefront/kebapp-doener-hero.webp"}
                    unoptimized={Boolean(profile.heroImageUrl)}
                  />
                  <span>{profile.heroImageUrl ? "Eigenes Headerbild" : "Professionelles Standardmotiv"}</span>
                </div>
                <div>
                  <label className="button button--secondary hero-image-editor__upload">
                    <ImagePlus size={17} aria-hidden="true" /> Headerbild auswählen
                    <input
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(event) => handleHeroImage(event.target.files?.[0])}
                      type="file"
                    />
                  </label>
                  {profile.heroImageUrl ? (
                    <button className="button button--quiet" onClick={() => updateField("heroImageUrl", "")} type="button">
                      Eigenes Bild entfernen
                    </button>
                  ) : null}
                  <small>Breites PNG, JPEG oder WebP · maximal 1 MiB · kein SVG</small>
                  {heroError ? <p className="editor-field-error" role="alert">{heroError}</p> : null}
                </div>
              </div>
              <label className="field">
                <span>Ladenname</span>
                <input maxLength={180} required value={profile.name} onChange={(event) => updateField("name", event.target.value)} />
              </label>
              <label className="field">
                <span>Kürzel</span>
                <input maxLength={12} required value={profile.shortName} onChange={(event) => updateField("shortName", event.target.value)} />
              </label>
              <label className="field">
                <span>Kleine Zeile</span>
                <input maxLength={180} value={profile.eyebrow} onChange={(event) => updateField("eyebrow", event.target.value)} />
              </label>
              <label className="field">
                <span>Hauptüberschrift</span>
                <textarea maxLength={240} required={isPublished} rows={2} value={profile.tagline} onChange={(event) => updateField("tagline", event.target.value)} />
              </label>
              <label className="field">
                <span>Kurzbeschreibung</span>
                <textarea maxLength={2_000} required={isPublished} rows={3} value={profile.description} onChange={(event) => updateField("description", event.target.value)} />
              </label>
              <label className="field color-field">
                <span>Akzentfarbe</span>
                <span>
                  <input type="color" value={profile.accent} onChange={(event) => updateField("accent", event.target.value)} />
                  <input aria-label="Akzentfarbe als Hexwert" pattern="#[0-9A-Fa-f]{6}" value={profile.accent.toUpperCase()} onChange={(event) => updateField("accent", event.target.value)} />
                </span>
              </label>
            </div>
          </section>

          <section>
            <div className="editor-section-title">
              <span><Check size={17} aria-hidden="true" /></span>
              <div><h2>Merkmale</h2><p>Nur zutreffende Aussagen auswählen</p></div>
            </div>
            <div className="feature-editor-grid">
              {STORE_FEATURES.map((feature) => (
                <label key={feature}>
                  <input checked={profile.features.includes(feature)} onChange={(event) => toggleFeature(feature, event.target.checked)} type="checkbox" />
                  <span>{featureLabels[feature]}</span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <div className="editor-section-title">
              <span><Globe2 size={17} aria-hidden="true" /></span>
              <div><h2>Kontakt</h2><p>Direkt erreichbar, ohne Formular</p></div>
            </div>
            <div className="form-stack">
              <label className="field"><span>Telefon</span><input maxLength={40} required={isPublished} type="tel" value={profile.phone} onChange={(event) => updateField("phone", event.target.value)} /></label>
              <div className="whatsapp-editor-row">
                <label className="field">
                  <span>WhatsApp-Nummer</span>
                  <input
                    maxLength={40}
                    placeholder="+49 2166 123456"
                    type="tel"
                    value={profile.whatsappPhone}
                    onChange={(event) => updateField("whatsappPhone", event.target.value)}
                  />
                  <small>Internationales Format mit +49. Leer lassen, um WhatsApp auszublenden.</small>
                </label>
                <button
                  className="button button--secondary"
                  disabled={!profile.phone.trim()}
                  onClick={() => updateField("whatsappPhone", profile.phone)}
                  type="button"
                >
                  Telefonnummer übernehmen
                </button>
              </div>
              <fieldset className="order-options-editor">
                <legend>Bestellarten</legend>
                <label>
                  <input
                    checked={profile.pickupEnabled}
                    onChange={(event) => updateField("pickupEnabled", event.target.checked)}
                    type="checkbox"
                  />
                  <span><strong>Abholung anbieten</strong><small>Kund:innen holen die Bestellung im Laden ab.</small></span>
                </label>
                <label>
                  <input
                    checked={profile.deliveryEnabled}
                    onChange={(event) => updateField("deliveryEnabled", event.target.checked)}
                    type="checkbox"
                  />
                  <span><strong>Lieferung anbieten</strong><small>Die Lieferadresse wird im Bestellzettel abgefragt.</small></span>
                </label>
              </fieldset>
              <label className="field"><span>Straße und Hausnummer</span><input maxLength={220} required={isPublished} value={profile.street} onChange={(event) => updateField("street", event.target.value)} /></label>
              <div className="address-field-row">
                <label className="field"><span>PLZ</span><input maxLength={16} required={isPublished} value={profile.postalCode} onChange={(event) => updateField("postalCode", event.target.value)} /></label>
                <label className="field"><span>Ort</span><input maxLength={120} required={isPublished} value={profile.city} onChange={(event) => updateField("city", event.target.value)} /></label>
              </div>
            </div>
          </section>

          <section>
            <div className="editor-section-title editor-section-title--actions">
              <span><Eye size={17} aria-hidden="true" /></span>
              <div><h2>Öffnungszeiten</h2><p>Bis zu 14 Zeilen, frei sortierbar</p></div>
              <button
                className="button button--secondary"
                disabled={profile.openingHours.length >= 14}
                onClick={() => updateField("openingHours", [...profile.openingHours, { days: "Montag", hours: "11:00–22:00" }])}
                type="button"
              ><Plus size={16} aria-hidden="true" /> Zeile</button>
            </div>
            <div className="opening-hours-editor-list">
              {profile.openingHours.map((entry, index) => (
                <div key={index}>
                  <label className="field"><span>Tage</span><input maxLength={80} required value={entry.days} onChange={(event) => updateOpeningHour(index, "days", event.target.value)} /></label>
                  <label className="field"><span>Zeiten</span><input maxLength={80} required value={entry.hours} onChange={(event) => updateOpeningHour(index, "hours", event.target.value)} /></label>
                  <div className="editor-row-actions">
                    <button aria-label={`${entry.days} nach oben`} disabled={index === 0} onClick={() => updateField("openingHours", moveItem(profile.openingHours, index, -1))} type="button"><ArrowUp size={16} /></button>
                    <button aria-label={`${entry.days} nach unten`} disabled={index === profile.openingHours.length - 1} onClick={() => updateField("openingHours", moveItem(profile.openingHours, index, 1))} type="button"><ArrowDown size={16} /></button>
                    <button aria-label={`${entry.days} entfernen`} onClick={() => updateField("openingHours", profile.openingHours.filter((_, entryIndex) => entryIndex !== index))} type="button"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="editor-section-title editor-section-title--actions">
              <span><Eye size={17} aria-hidden="true" /></span>
              <div><h2>Speisekarte</h2><p>Bis zu 40 Gerichte, vollständig bearbeitbar</p></div>
              <button className="button button--secondary" disabled={profile.menu.length >= 40} onClick={addMenuItem} type="button"><Plus size={16} aria-hidden="true" /> Gericht</button>
            </div>
            <div className="menu-editor-list menu-editor-list--full">
              {profile.menu.map((item, index) => (
                <article key={item.id}>
                  <header><strong>{String(index + 1).padStart(2, "0")}</strong><div className="editor-row-actions">
                    <button aria-label={`${item.name} nach oben`} disabled={index === 0} onClick={() => updateField("menu", moveItem(profile.menu, index, -1))} type="button"><ArrowUp size={16} /></button>
                    <button aria-label={`${item.name} nach unten`} disabled={index === profile.menu.length - 1} onClick={() => updateField("menu", moveItem(profile.menu, index, 1))} type="button"><ArrowDown size={16} /></button>
                    <button aria-label={`${item.name} entfernen`} onClick={() => updateField("menu", profile.menu.filter((entry) => entry.id !== item.id))} type="button"><Trash2 size={16} /></button>
                  </div></header>
                  <div>
                    <label className="field"><span>Gericht</span><input maxLength={120} required value={item.name} onChange={(event) => updateMenuItem(item.id, "name", event.target.value)} /></label>
                    <label className="field"><span>Kategorie</span><select value={item.category} onChange={(event) => updateMenuItem(item.id, "category", event.target.value as MenuItem["category"])}>{menuCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
                    <label className="field menu-description-field"><span>Beschreibung</span><textarea maxLength={300} rows={2} value={item.description} onChange={(event) => updateMenuItem(item.id, "description", event.target.value)} /></label>
                    <label className="field field--price"><span>Preis</span><input max="1000" min="0" required step="0.1" type="number" value={item.price} onChange={(event) => updateMenuItem(item.id, "price", Number(event.target.value))} /><i>€</i></label>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <footer className="editor-panel__footer">
            <span className={`save-message save-message--${messageTone}`} role="status" aria-live="polite">
              {messageTone === "success" ? <Check size={15} aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}{message}
            </span>
            <div className="editor-panel__actions">
              {isPublished ? <Link className="button button--secondary editor-mobile-preview" href={initialData.publicPath} target="_blank"><ExternalLink size={17} aria-hidden="true" />Seite öffnen</Link> : null}
              <SaveButton />
            </div>
          </footer>
        </form>

        <aside className="preview-panel" aria-label="Website-Vorschau">
          <div className="preview-panel__toolbar"><span><i /><i /><i /></span><strong>Live-Vorschau</strong><small>Mobil &amp; Desktop</small></div>
          <div className="preview-panel__viewport"><Storefront profile={profile} preview /></div>
        </aside>
      </div>

      <section className="domain-demo-panel" aria-labelledby="domain-title">
        <div className="domain-demo-panel__heading">
          <span><ShieldCheck aria-hidden="true" size={21} /></span>
          <div>
            <p className="eyebrow">Domain &amp; SSL · Vorbereitung</p>
            <h2 id="domain-title">Eigene Webadresse vormerken</h2>
            <p>Diese Demo registriert keine Domain und ändert kein DNS. Der Wunsch wird nur zur Prüfung gespeichert.</p>
          </div>
        </div>
        <dl className="domain-demo-panel__status">
          <div><dt>Plattform-Adresse</dt><dd>{initialData.publicPath}</dd><small>HTTPS über die Kebapp-Demo</small></div>
          <div><dt>Verbundene Domain</dt><dd>{initialData.customDomain ?? "Noch keine eigene Domain verbunden"}</dd><small>{initialData.customDomain ? "HTTPS aktiv" : "Keine DNS-Verbindung"}</small></div>
          <div><dt>Prüfstatus</dt><dd>{initialData.domainRequestStatus === "REVIEW_REQUESTED" ? "Zur Prüfung vorgemerkt" : "Noch kein Wunsch vorgemerkt"}</dd><small>{initialData.requestedDomain ?? "—"}</small></div>
        </dl>
        <form action={domainAction} className="domain-demo-form">
          <label className="field">
            <span>Gewünschte Domain</span>
            <input
              autoComplete="off"
              maxLength={253}
              name="requestedDomain"
              onChange={(event) => setRequestedDomain(event.target.value)}
              pattern="(?=.{4,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}"
              placeholder="mein-doenerladen.de"
              required
              value={requestedDomain}
            />
            <small>Ohne https://, Pfad oder Leerzeichen. Zum Beispiel mein-doenerladen.de</small>
          </label>
          <DomainButton />
        </form>
      </section>
    </div>
  );
}
