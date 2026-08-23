import type { Metadata } from "next";
import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { saveGoodsReceiptAction } from "@/app/app/eingang/actions";
import { GoodsReceiptForm } from "@/components/goods-receipt-form";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import {
  getGoodsReceipt,
  listReceiptRounds,
  ReceiptNotFoundError,
  ReceiptRoundNotAllowedError,
} from "@/server/procurement/receipts";

export const metadata: Metadata = {
  title: "Wareneingang",
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeZone: "Europe/Berlin",
});

const meldungMessages: Record<string, string> = {
  gespeichert: "gespeichert",
  gesperrt: "gesperrt",
  ungueltig: "ungueltig",
};

export default async function WareneingangPage({
  searchParams,
}: {
  searchParams: Promise<{ meldung?: string; runde?: string }>;
}) {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/eingang",
  );
  const query = await searchParams;

  if (query.runde) {
    let receipt;
    try {
      receipt = await getGoodsReceipt({
        actor,
        buyingRoundId: query.runde,
        organizationId: organization.organizationId,
      });
    } catch (error) {
      if (
        error instanceof ReceiptNotFoundError ||
        error instanceof ReceiptRoundNotAllowedError
      ) {
        return (
          <div className="page-stack">
            <header className="page-header">
              <div>
                <span className="eyebrow">Wareneingang</span>
                <h1>Nicht verfügbar</h1>
                <p>
                  Diese Runde kann nicht erfasst werden. Sie gehört zu deinem
                  Laden oder ist noch nicht abgeschlossen.
                </p>
              </div>
            </header>
            <Link
              className="button button--secondary"
              href="/app/eingang"
            >
              Zurück zur Übersicht
            </Link>
          </div>
        );
      }
      throw error;
    }

    return (
      <div className="page-stack">
        <header className="page-header">
          <div>
            <p>
              <Link href="/app/eingang">← Wareneingang</Link>
            </p>
            <h1>{receipt.round.name}</h1>
            <p>
              Trage ein, was angekommen ist. Fehlmengen helfen dem
              Einkaufsteam, beim Lieferanten nachzufordern.
            </p>
          </div>
          {receipt.savedAt ? (
            <span className="live-status">
              Erfasst am {dateFormatter.format(new Date(receipt.savedAt))}
            </span>
          ) : null}
        </header>

        <GoodsReceiptForm
          initialLines={receipt.lines}
          initialNote={receipt.note}
          messageCode={query.meldung ? meldungMessages[query.meldung] : undefined}
          roundId={receipt.round.id}
          roundName={receipt.round.name}
          saveAction={saveGoodsReceiptAction}
        />
      </div>
    );
  }

  const rounds = await listReceiptRounds({
    actor,
    organizationId: organization.organizationId,
  });

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Wareneingang</span>
          <h1>Was ist angekommen?</h1>
          <p>
            Dokumentiere Lieferungen abgeschlossener Sammelrunden — inklusive
            Fehlmengen für das Einkaufsteam.
          </p>
        </div>
      </header>

      {rounds.length === 0 ? (
        <section className="panel empty-state">
          <PackageCheck size={30} aria-hidden="true" />
          <h2>Noch keine abgeschlossene Runde</h2>
          <p>
            Sobald eine Sammelrunde geschlossen und geliefert wurde, kannst du
            hier den Wareneingang erfassen.
          </p>
        </section>
      ) : (
        <div className="demand-table-wrap panel">
          <table className="demand-table receipt-table">
            <thead>
              <tr>
                <th>Runde</th>
                <th>Lieferfenster bis</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Aktion</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((round) => (
                <tr key={round.buyingRoundId}>
                  <td data-label="Runde">
                    <strong>{round.name}</strong>
                  </td>
                  <td data-label="Lieferfenster bis">
                    {dateFormatter.format(round.deliveryWindowEnd)}
                  </td>
                  <td data-label="Erfassung">
                    {round.receiptSavedAt ? (
                      <span className="live-status">
                        Erfasst am{" "}
                        {dateFormatter.format(round.receiptSavedAt)}
                      </span>
                    ) : (
                      <strong className="receipt-missing">Offen</strong>
                    )}
                  </td>
                  <td>
                    <Link
                      className="button button--secondary button--small"
                      href={`/app/eingang?runde=${round.buyingRoundId}`}
                    >
                      {round.receiptSavedAt ? "Ansehen / ändern" : "Erfassen"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
