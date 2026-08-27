import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LOYALTY_TARGET } from "@/lib/guest-identity";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import {
  getGuestDetail,
  GuestNotFoundError,
  type GuestOrderView,
} from "@/server/guests/service";

export const metadata: Metadata = { title: "Gast" };

const euroFormatter = new Intl.NumberFormat("de-DE", {
  currency: "EUR",
  style: "currency",
});

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const sourceLabels: Record<GuestOrderView["source"], string> = {
  MANUELL: "Im Laden",
  PLATTFORM: "Lieferplattform",
  STOREFRONT: "Ladenseite",
};

const statusLabels: Record<GuestOrderView["status"], string> = {
  ABGESCHLOSSEN: "Abgeschlossen",
  NEU: "Neu",
  STORNIERT: "Storniert",
};

function formatCents(value: number): string {
  return euroFormatter.format(value / 100);
}

async function saveGuestAction(formData: FormData): Promise<void> {
  "use server";
  const { redirect } = await import("next/navigation");
  const { revalidatePath } = await import("next/cache");
  const guestId = String(formData.get("guestId") ?? "");

  const { actor, organization } = await (
    await import("@/server/auth/page-guards")
  ).requireActiveOrganizationPage(`/app/gaeste/${guestId}`);
  const { updateGuest } = await import("@/server/guests/service");

  await updateGuest({
    actor,
    guestId,
    name: String(formData.get("name") ?? ""),
    note: String(formData.get("note") ?? ""),
    organizationId: organization.organizationId,
  });

  revalidatePath(`/app/gaeste/${guestId}`);
  redirect(`/app/gaeste/${guestId}?meldung=gespeichert`);
}

async function redeemLoyaltyAction(formData: FormData): Promise<void> {
  "use server";
  const { redirect } = await import("next/navigation");
  const { revalidatePath } = await import("next/cache");
  const guestId = String(formData.get("guestId") ?? "");

  const { actor, organization } = await (
    await import("@/server/auth/page-guards")
  ).requireActiveOrganizationPage(`/app/gaeste/${guestId}`);
  const { LoyaltyNotReadyError, redeemLoyalty } = await import(
    "@/server/guests/service"
  );

  try {
    await redeemLoyalty({
      actor,
      guestId,
      organizationId: organization.organizationId,
      rewardLabel: String(formData.get("rewardLabel") ?? ""),
    });
  } catch (error) {
    if (error instanceof LoyaltyNotReadyError) {
      return redirect(`/app/gaeste/${guestId}?meldung=nicht-voll`);
    }
    throw error;
  }

  revalidatePath(`/app/gaeste/${guestId}`);
  revalidatePath("/app/gaeste");
  redirect(`/app/gaeste/${guestId}?meldung=eingeloest`);
}

async function deleteGuestAction(formData: FormData): Promise<void> {
  "use server";
  const { redirect } = await import("next/navigation");
  const { revalidatePath } = await import("next/cache");
  const guestId = String(formData.get("guestId") ?? "");

  const { actor, organization } = await (
    await import("@/server/auth/page-guards")
  ).requireActiveOrganizationPage(`/app/gaeste/${guestId}`);
  const { deleteGuest } = await import("@/server/guests/service");

  await deleteGuest({
    actor,
    guestId,
    organizationId: organization.organizationId,
    reason: String(formData.get("reason") ?? ""),
  });

  revalidatePath("/app/gaeste");
  redirect("/app/gaeste?meldung=geloescht");
}

const meldungMessages: Record<string, string> = {
  eingeloest: "Stempelkarte eingelöst.",
  gespeichert: "Gast gespeichert.",
  "nicht-voll": "Die Stempelkarte ist noch nicht voll.",
};

export default async function GuestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ guestId: string }>;
  searchParams: Promise<{ meldung?: string }>;
}) {
  const { guestId } = await params;
  const { actor, organization } = await requireActiveOrganizationPage(
    `/app/gaeste/${guestId}`,
  );

  let detail;
  try {
    detail = await getGuestDetail({
      actor,
      guestId,
      organizationId: organization.organizationId,
    });
  } catch (error) {
    if (error instanceof GuestNotFoundError) {
      notFound();
    }
    throw error;
  }

  const query = await searchParams;
  const message = query.meldung
    ? (meldungMessages[query.meldung] ?? query.meldung)
    : undefined;
  const { guest } = detail;
  const stampsShown = Math.min(guest.stampCount, LOYALTY_TARGET);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">
            <Link href="/app/gaeste">
              <ArrowLeft aria-hidden="true" size={13} /> Alle Gäste
            </Link>
          </span>
          <h1>{guest.name ?? "Gast ohne Namen"}</h1>
          <p>
            {guest.phoneLabel} · Einwilligung am{" "}
            {dateTimeFormatter.format(new Date(detail.consentAt))} über{" "}
            {detail.consentSource === "STOREFRONT" ? "die Ladenseite" : "den Laden"}
          </p>
        </div>
        <div className="admin-date-block">
          <strong>{formatCents(guest.totalCents)}</strong>
          <span>{guest.orderCount} Bestellungen</span>
        </div>
      </header>

      {message ? (
        <p
          className={`save-message save-message--${
            query.meldung === "nicht-voll" ? "error" : "success"
          }`}
          role="alert"
        >
          {message}
        </p>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Stempelkarte</span>
            <h2>
              {guest.stampCount} von {LOYALTY_TARGET} Stempeln
            </h2>
            <p>
              {guest.redeemable
                ? "Die Karte ist voll und kann eingelöst werden."
                : `Noch ${LOYALTY_TARGET - guest.stampCount} Bestellungen bis zur Prämie.`}
            </p>
          </div>
        </div>

        <ul className="stamp-row" aria-label="Gesammelte Stempel">
          {Array.from({ length: LOYALTY_TARGET }, (_, index) => (
            <li
              className={index < stampsShown ? "stamp stamp--filled" : "stamp"}
              key={index}
            >
              {index + 1}
            </li>
          ))}
        </ul>

        {guest.redeemable ? (
          <form action={redeemLoyaltyAction} className="form-grid form-grid--three">
            <input name="guestId" type="hidden" value={guest.id} />
            <label className="field">
              <span>Prämie</span>
              <input
                defaultValue="Ein Gericht gratis"
                maxLength={120}
                name="rewardLabel"
                type="text"
              />
            </label>
            <button className="button button--primary" type="submit">
              Stempelkarte einlösen
            </button>
          </form>
        ) : null}

        {detail.redemptions.length > 0 ? (
          <div className="demand-table-wrap">
            <table className="demand-table">
              <thead>
                <tr>
                  <th>Eingelöst am</th>
                  <th>Prämie</th>
                  <th>Stempel</th>
                </tr>
              </thead>
              <tbody>
                {detail.redemptions.map((redemption) => (
                  <tr key={redemption.id}>
                    <td data-label="Eingelöst am">
                      {dateTimeFormatter.format(new Date(redemption.redeemedAt))}
                    </td>
                    <td data-label="Prämie">{redemption.rewardLabel}</td>
                    <td data-label="Stempel">{redemption.stampsUsed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Verlauf</span>
            <h2>Bestellungen</h2>
          </div>
        </div>
        {detail.orders.length === 0 ? (
          <p className="request-file__empty">Noch keine Bestellung erfasst.</p>
        ) : (
          <div className="demand-table-wrap">
            <table className="demand-table">
              <thead>
                <tr>
                  <th>Zeitpunkt</th>
                  <th>Positionen</th>
                  <th>Art</th>
                  <th>Quelle</th>
                  <th>Betrag</th>
                </tr>
              </thead>
              <tbody>
                {detail.orders.map((order) => (
                  <tr key={order.id}>
                    <td data-label="Zeitpunkt">
                      {dateTimeFormatter.format(new Date(order.placedAt))}
                      {order.status !== "ABGESCHLOSSEN" ? (
                        <>
                          <br />
                          <small>{statusLabels[order.status]}</small>
                        </>
                      ) : null}
                    </td>
                    <td data-label="Positionen">
                      {order.items.length === 0
                        ? "—"
                        : order.items
                            .map((item) => `${item.quantity} × ${item.name}`)
                            .join(", ")}
                      {order.note ? (
                        <>
                          <br />
                          <small>{order.note}</small>
                        </>
                      ) : null}
                    </td>
                    <td data-label="Art">
                      {order.mode === "DELIVERY" ? "Lieferung" : "Abholung"}
                    </td>
                    <td data-label="Quelle">{sourceLabels[order.source]}</td>
                    <td data-label="Betrag">{formatCents(order.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Stammdaten</span>
            <h2>Name und Notiz</h2>
            <p>Die Telefonnummer ist die Identität und lässt sich nicht ändern.</p>
          </div>
        </div>
        <form action={saveGuestAction} className="form-grid form-grid--three">
          <input name="guestId" type="hidden" value={guest.id} />
          <label className="field">
            <span>Name</span>
            <input
              defaultValue={guest.name ?? ""}
              maxLength={120}
              name="name"
              type="text"
            />
          </label>
          <label className="field">
            <span>Notiz</span>
            <input
              defaultValue={guest.note ?? ""}
              maxLength={300}
              name="note"
              placeholder="Zum Beispiel: immer ohne Zwiebeln"
              type="text"
            />
          </label>
          <button className="button button--secondary" type="submit">
            Speichern
          </button>
        </form>
      </section>

      {organization.role === "OWNER" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Datenschutz</span>
              <h2>Gast löschen</h2>
              <p>
                Löscht die Nummer, alle Bestellungen und die Stempelkarte
                unwiderruflich. Für Auskunfts- und Löschanfragen nach DSGVO.
              </p>
            </div>
          </div>
          <form action={deleteGuestAction} className="form-grid form-grid--three">
            <input name="guestId" type="hidden" value={guest.id} />
            <label className="field">
              <span>Grund (wird im Protokoll vermerkt)</span>
              <input
                defaultValue="Löschanfrage des Gastes"
                maxLength={300}
                name="reason"
                type="text"
              />
            </label>
            <button className="button button--danger" type="submit">
              Endgültig löschen
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
