import {
  Clock3,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
} from "lucide-react";
import Image from "next/image";
import type { CSSProperties } from "react";
import { StorefrontOrderSheet } from "@/components/storefront-order-sheet";
import {
  formatStorefrontPrice,
  normalizeWhatsappPhone,
} from "@/lib/storefront-order";
import type { StoreFeature, StoreProfile } from "@/lib/types";

type StorefrontProps = {
  profile: StoreProfile;
  preview?: boolean;
  publicSlug?: string;
};

const featureLabels: Record<StoreFeature, string> = {
  HALAL: "Halal",
  FRESH_VEGETABLES: "Frisches Gemüse",
  HOMEMADE_SAUCES: "Hausgemachte Saucen",
  PREPARED_ON_SITE: "Vor Ort zubereitet",
};

function StoreLogo({ profile }: { profile: StoreProfile }) {
  return profile.logoUrl ? (
    <Image
      alt={`Logo von ${profile.name}`}
      className="storefront-logo__image"
      height={48}
      src={profile.logoUrl}
      unoptimized
      width={48}
    />
  ) : (
    <span>{profile.shortName}</span>
  );
}

export function Storefront({
  profile,
  preview = false,
  publicSlug,
}: StorefrontProps) {
  const style = { "--store-accent": profile.accent } as CSSProperties;
  const address = `${profile.street}, ${profile.postalCode} ${profile.city}`;
  const mapQuery = encodeURIComponent(address);
  const phoneHref = `tel:${profile.phone.replace(/[^\d+]/g, "")}`;
  const hasWhatsapp = Boolean(
    normalizeWhatsappPhone(profile.whatsappPhone) &&
      (profile.pickupEnabled || profile.deliveryEnabled),
  );
  const heroImage =
    profile.heroImageUrl || "/images/storefront/kebapp-doener-hero.webp";
  const orderModes = [
    profile.pickupEnabled ? "Abholung" : null,
    profile.deliveryEnabled ? "Lieferung" : null,
  ].filter(Boolean);

  const content = (
    <div
      className={`storefront ${preview ? "storefront--preview" : ""}`}
      style={style}
    >
      {!preview ? (
        <div className="demo-ribbon">
          Öffentliche Demo · Kontaktdaten und Speisekarte sind Beispieldaten
        </div>
      ) : null}

      <header className="storefront-header">
        <div className="storefront-header__meta">
          <span>{profile.street} · {profile.postalCode} {profile.city}</span>
          <a aria-disabled={preview} href={preview ? undefined : phoneHref}>
            {profile.phone}
          </a>
        </div>
        <div className="storefront-header__nav">
          <a
            aria-label={`${profile.name} Startseite`}
            className="storefront-logo"
            href="#start"
          >
            <StoreLogo profile={profile} />
            <strong>{profile.name}</strong>
          </a>
          <nav aria-label="Seitennavigation">
            <a href="#speisekarte">Speisekarte</a>
            <a href="#ueber-uns">Über uns</a>
            <a href="#zeiten">Öffnungszeiten</a>
            <a href="#kontakt">Kontakt</a>
          </nav>
          {hasWhatsapp ? (
            <button
              className="storefront-header__order"
              data-storefront-order-trigger
              type="button"
            >
              Jetzt bestellen
            </button>
          ) : (
            <a
              aria-disabled={preview}
              className="storefront-header__order"
              href={preview ? undefined : phoneHref}
            >
              Jetzt anrufen
            </a>
          )}
        </div>
      </header>

      <main>
        <section className="storefront-hero" id="start">
          <Image
            alt=""
            className="storefront-hero__image"
            fill
            preload={!preview}
            sizes="100vw"
            src={heroImage}
            unoptimized={Boolean(profile.heroImageUrl)}
          />
          <div className="storefront-hero__shade" aria-hidden="true" />
          <div className="storefront-hero__copy">
            <span className="storefront-eyebrow">{profile.eyebrow}</span>
            <h1>{profile.tagline}</h1>
            <p>{profile.description}</p>
            <div className="storefront-hero__actions">
              {hasWhatsapp ? (
                <button
                  className="storefront-button storefront-button--whatsapp"
                  data-storefront-order-trigger
                  type="button"
                >
                  <MessageCircle aria-hidden="true" size={18} />
                  Über WhatsApp bestellen
                </button>
              ) : null}
              <a
                aria-disabled={preview}
                className="storefront-button storefront-button--secondary"
                href={preview ? undefined : phoneHref}
              >
                <Phone aria-hidden="true" size={18} />
                Jetzt anrufen
              </a>
            </div>
          </div>
          <div className="storefront-hero__facts">
            <div><small>Bestellung</small><strong>Direkt beim Restaurant</strong></div>
            <div><small>Optionen</small><strong>{orderModes.join(" & ") || "Telefonisch anfragen"}</strong></div>
            <div><small>Standort</small><strong>{profile.city}</strong></div>
          </div>
        </section>

        <section className="storefront-about" id="ueber-uns">
          <div>
            <span className="storefront-section-label">Unser Laden</span>
            <h2>Direkt, persönlich und frisch zubereitet.</h2>
          </div>
          <div>
            <p>{profile.description}</p>
            {profile.features.length > 0 ? (
              <ul aria-label="Merkmale des Ladens">
                {profile.features.map((feature) => (
                  <li key={feature}>{featureLabels[feature]}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>

        <section className="storefront-menu" id="speisekarte">
          <div className="storefront-section-heading">
            <div>
              <span className="storefront-section-label">Unsere Auswahl</span>
              <h2>Speisekarte</h2>
            </div>
            <p>
              Wähle ein Gericht und bereite deine Bestellung direkt für
              WhatsApp vor. Allergene und Zusatzstoffe erfährst du bei unserem
              Team.
            </p>
          </div>
          <div className="storefront-menu__grid">
            {profile.menu.map((item) => (
              <article className="storefront-menu-item" key={item.id}>
                <div>
                  <small>{item.category}</small>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                </div>
                <div className="storefront-menu-item__order">
                  <strong>{formatStorefrontPrice(item.price)}</strong>
                  {hasWhatsapp ? (
                    <button
                      data-storefront-order-item={item.id}
                      data-storefront-order-trigger
                      type="button"
                    >
                      <MessageCircle aria-hidden="true" size={15} />
                      Per WhatsApp bestellen
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          <p className="storefront-menu__note">
            Alle Preise inklusive gesetzlicher Umsatzsteuer. Die Bestellung
            wird erst versendet, wenn du sie selbst in WhatsApp bestätigst.
          </p>
        </section>

        <section className="storefront-contact" id="kontakt">
          <div className="storefront-contact__statement">
            <span className="storefront-eyebrow">Direkter Kontakt</span>
            <h2>Bestellen oder einfach vorbeikommen.</h2>
            <p>Du findest uns in {profile.city}.</p>
            <a
              aria-disabled={preview}
              href={preview ? undefined : `https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              rel="noreferrer"
              target={preview ? undefined : "_blank"}
            >
              Route in Karten öffnen
              <Navigation aria-hidden="true" size={17} />
            </a>
          </div>
          <div className="storefront-contact__facts">
            <div>
              <MapPin aria-hidden="true" size={21} />
              <span>
                <small>Adresse</small>
                <strong>{profile.street}<br />{profile.postalCode} {profile.city}</strong>
              </span>
            </div>
            <div>
              <Phone aria-hidden="true" size={21} />
              <span>
                <small>Telefon</small>
                <a aria-disabled={preview} href={preview ? undefined : phoneHref}>{profile.phone}</a>
              </span>
            </div>
          </div>
        </section>

        <section className="storefront-hours" id="zeiten">
          <div>
            <Clock3 aria-hidden="true" size={24} />
            <span>
              <small className="storefront-section-label">Heute vorbeikommen</small>
              <h2>Öffnungszeiten</h2>
            </span>
          </div>
          <dl>
            {profile.openingHours.map((entry, hourEntryIndex) => (
              <div key={`${hourEntryIndex}-${entry.days}`}>
                <dt>{entry.days}</dt>
                <dd>{entry.hours} Uhr</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="storefront-footer">
        <div>
          <span className="storefront-logo storefront-logo--footer">
            <StoreLogo profile={profile} />
            <strong>{profile.name}</strong>
          </span>
          <p>
            Direkter Kontakt zum Restaurant. Kebapp speichert oder versendet
            keine Endkundenbestellungen.
          </p>
        </div>
        <nav className="storefront-footer__legal" aria-label="Rechtliche Informationen">
          {preview || !publicSlug ? (
            <><span>Impressum</span><span>Datenschutz</span></>
          ) : (
            <>
              <a href={`/laden/${publicSlug}/impressum`}>Impressum</a>
              <a href={`/laden/${publicSlug}/datenschutz`}>Datenschutz</a>
            </>
          )}
        </nav>
        <span className="storefront-footer__powered">Erstellt mit Kebapp</span>
      </footer>

      <div className="storefront-mobile-actions">
        {hasWhatsapp ? (
          <button data-storefront-order-trigger type="button">
            <MessageCircle aria-hidden="true" size={18} />
            WhatsApp
          </button>
        ) : null}
        <a aria-disabled={preview} href={preview ? undefined : phoneHref}>
          <Phone aria-hidden="true" size={18} />
          Anrufen
        </a>
      </div>
    </div>
  );

  return hasWhatsapp ? (
    <StorefrontOrderSheet
      deliveryEnabled={profile.deliveryEnabled}
      menu={profile.menu}
      pickupEnabled={profile.pickupEnabled}
      preview={preview}
      publicSlug={publicSlug}
      storeName={profile.name}
      whatsappPhone={profile.whatsappPhone}
    >
      {content}
    </StorefrontOrderSheet>
  ) : content;
}
