import { ArrowDown, Clock3, MapPin, Navigation, Phone } from "lucide-react";
import Image from "next/image";
import type { CSSProperties } from "react";
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

function menuPrice(price: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

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
  const phoneHref = `tel:${profile.phone.replace(/\s/g, "")}`;

  return (
    <div className={`storefront ${preview ? "storefront--preview" : ""}`} style={style}>
      {!preview ? (
        <div className="demo-ribbon">Informationsseite · keine Bestellfunktion</div>
      ) : null}

      <header className="storefront-header">
        <a className="storefront-logo" href="#start" aria-label={`${profile.name} Startseite`}>
          <StoreLogo profile={profile} />
          <strong>{profile.name}</strong>
        </a>
        <nav aria-label="Seitennavigation">
          <a href="#speisekarte">Speisekarte</a>
          <a href="#zeiten">Öffnungszeiten</a>
          <a href="#kontakt">Kontakt</a>
        </nav>
        <a className="storefront-call" href={phoneHref}>
          <Phone size={16} aria-hidden="true" />
          Anrufen
        </a>
      </header>

      <main>
        <section className="storefront-hero" id="start">
          <div className="storefront-hero__copy">
            <span className="storefront-eyebrow">{profile.eyebrow}</span>
            <h1>{profile.tagline}</h1>
            <p>{profile.description}</p>
            <div className="storefront-hero__actions">
              <a className="storefront-button storefront-button--primary" href={phoneHref}>
                <Phone size={18} aria-hidden="true" />
                Jetzt anrufen
              </a>
              <a
                className="storefront-button storefront-button--secondary"
                href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                target="_blank"
                rel="noreferrer"
              >
                <Navigation size={18} aria-hidden="true" />
                Route öffnen
              </a>
            </div>
            <a className="storefront-scroll" href="#speisekarte">
              Speisekarte ansehen
              <ArrowDown size={16} aria-hidden="true" />
            </a>
          </div>

          <div className="storefront-hero__visual" aria-hidden="true">
            <span className="storefront-hero__stamp">DEIN LADEN<br />IN {profile.city.toUpperCase()}</span>
            <div className="hero-skewer">
              <i className="hero-skewer__rod" />
              <span className="hero-skewer__slice hero-skewer__slice--1" />
              <span className="hero-skewer__slice hero-skewer__slice--2" />
              <span className="hero-skewer__slice hero-skewer__slice--3" />
              <span className="hero-skewer__slice hero-skewer__slice--4" />
              <span className="hero-skewer__slice hero-skewer__slice--5" />
              <span className="hero-skewer__slice hero-skewer__slice--6" />
              <i className="hero-skewer__tray" />
            </div>
            <span className="hero-skewer__caption">Speisekarte &amp; Öffnungszeiten</span>
          </div>
        </section>

        {profile.features.length > 0 ? (
          <div className="storefront-marquee" aria-label="Merkmale des Ladens">
            {profile.features.map((feature, index) => (
              <span key={feature}>
                {featureLabels[feature]}
                {index < profile.features.length - 1 ? <i aria-hidden="true" /> : null}
              </span>
            ))}
          </div>
        ) : null}

        <section className="storefront-menu" id="speisekarte">
          <div className="storefront-section-heading">
            <span>Was wir machen</span>
            <h2>Unsere Speisekarte</h2>
            <p>Unsere Auswahl auf einen Blick. Allergene und Zusatzstoffe erfährst du bei unserem Team.</p>
          </div>
          <div className="storefront-menu__grid">
            {profile.menu.map((item, index) => (
              <article className="storefront-menu-item" key={item.id}>
                <span className="storefront-menu-item__number">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <small>{item.category}</small>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                </div>
                <strong>{menuPrice(item.price)}</strong>
              </article>
            ))}
          </div>
          <p className="storefront-menu__note">Alle Preise inklusive gesetzlicher Umsatzsteuer. Über diese Website werden keine Onlinebestellungen angenommen.</p>
        </section>

        <section className="storefront-contact" id="kontakt">
          <div className="storefront-contact__statement">
            <span className="storefront-eyebrow">Komm vorbei</span>
            <h2>Dein Platz ist schon warm.</h2>
            <p>Du findest uns in {profile.city}.</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noreferrer"
            >
              Route in Karten öffnen
              <Navigation size={17} aria-hidden="true" />
            </a>
          </div>
          <div className="storefront-contact__facts">
            <div>
              <MapPin size={21} aria-hidden="true" />
              <span>
                <small>Adresse</small>
                <strong>{profile.street}<br />{profile.postalCode} {profile.city}</strong>
              </span>
            </div>
            <div>
              <Phone size={21} aria-hidden="true" />
              <span>
                <small>Telefon</small>
                <a href={phoneHref}>{profile.phone}</a>
              </span>
            </div>
          </div>
        </section>

        <section className="storefront-hours" id="zeiten">
          <div>
            <Clock3 size={24} aria-hidden="true" />
            <h2>Öffnungszeiten</h2>
          </div>
          <dl>
            {profile.openingHours.map((entry) => (
              <div key={entry.days}>
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
          <p>Informationswebsite mit Kebapp · keine Onlinebestellung.</p>
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
    </div>
  );
}
