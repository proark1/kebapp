import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function StorefrontNotFound() {
  return (
    <main className="storefront-not-found">
      <BrandMark />
      <span className="eyebrow">Ladenwebsite</span>
      <h1>Diese Seite ist nicht öffentlich.</h1>
      <p>
        Der Link ist unbekannt, die Website befindet sich im Entwurf oder der
        Laden ist derzeit nicht freigeschaltet.
      </p>
      <Link className="button button--secondary" href="/">
        Zu Kebapp
      </Link>
    </main>
  );
}
