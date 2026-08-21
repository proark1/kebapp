import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DecisionForm } from "@/components/admin/decision-form";
import { requirePlatformAdminPage } from "@/server/auth/page-guards";
import { getRegistrationRequest } from "@/server/organizations/admin";
import {
  approveRegistrationAction,
  rejectRegistrationAction,
  suspendOrganizationAction,
} from "../actions";

export const metadata: Metadata = { title: "Antrag prüfen" };

const actionMessages: Record<string, string> = {
  abgelehnt: "Die Ablehnung wurde mit Begründung protokolliert.",
  freigegeben: "Organisation und Inhaberzugang wurden freigegeben.",
  gesperrt: "Der Betrieb und alle aktiven Zugänge wurden pausiert.",
};

export default async function RegistrationRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ aktion?: string }>;
}) {
  const rawRequestId = (await params).requestId;
  const actor = await requirePlatformAdminPage(
    `/admin/antraege/${encodeURIComponent(rawRequestId)}`,
  );
  const requestId = z.uuid().safeParse(rawRequestId);
  if (!requestId.success) notFound();

  const request = await getRegistrationRequest({
    actor,
    requestId: requestId.data,
  });
  if (!request) notFound();

  const actionKey = (await searchParams).aktion ?? "";
  const actionMessage = actionMessages[actionKey];
  const date = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(request.createdAt);

  return (
    <div className="admin-page">
      <Link className="admin-back" href="/admin/antraege">
        ← Zur Prüfmappe
      </Link>

      <header className="dossier-heading">
        <div>
          <p>Ladenakte · {request.id.slice(0, 8).toUpperCase()}</p>
          <h1>{request.storeName}</h1>
          <span>Eingegangen am {date}</span>
        </div>
        <div className={`dossier-stamp dossier-stamp--${request.status.toLowerCase()}`}>
          {request.status === "PENDING"
            ? "OFFEN"
            : request.status === "APPROVED"
              ? "FREIGEGEBEN"
              : "ABGELEHNT"}
        </div>
      </header>

      {actionMessage ? (
        <p className="admin-action-message" role="status">
          {actionMessage}
        </p>
      ) : null}

      <div className="dossier-grid">
        <section className="dossier-sheet" aria-labelledby="dossier-data-title">
          <header>
            <span>Prüfblatt A</span>
            <strong id="dossier-data-title">Betriebsangaben</strong>
          </header>
          <dl>
            <div>
              <dt>Name am Laden</dt>
              <dd>{request.storeName}</dd>
            </div>
            <div>
              <dt>Rechtlicher Name</dt>
              <dd>{request.legalName || "Nicht angegeben"}</dd>
            </div>
            <div>
              <dt>Standort</dt>
              <dd>
                {request.street}
                <br />
                {request.postalCode} {request.city}
              </dd>
            </div>
          </dl>
        </section>

        <section className="dossier-sheet" aria-labelledby="dossier-contact-title">
          <header>
            <span>Prüfblatt B</span>
            <strong id="dossier-contact-title">Kontakt</strong>
          </header>
          <dl>
            <div>
              <dt>Kontaktperson</dt>
              <dd>{request.contactName}</dd>
            </div>
            <div>
              <dt>E-Mail</dt>
              <dd>
                <a href={`mailto:${request.contactEmail}`}>{request.contactEmail}</a>
              </dd>
            </div>
            <div>
              <dt>Telefon</dt>
              <dd>
                <a href={`tel:${request.contactPhone}`}>{request.contactPhone}</a>
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {request.reviewNote ? (
        <section className="dossier-note">
          <span>Dokumentierte Begründung</span>
          <p>{request.reviewNote}</p>
        </section>
      ) : null}

      <section className="decision-desk" aria-labelledby="decision-title">
        <header>
          <p>Vier-Augen-Prinzip für den Pilotbetrieb</p>
          <h2 id="decision-title">
            {request.status === "PENDING"
              ? "Entscheidung festhalten"
              : "Zugangsstatus verwalten"}
          </h2>
        </header>
        {request.status === "PENDING" ? (
          <div className="decision-desk__grid">
            <DecisionForm
              action={approveRegistrationAction}
              kind="approve"
              requestId={request.id}
            />
            <DecisionForm
              action={rejectRegistrationAction}
              kind="reject"
              requestId={request.id}
            />
          </div>
        ) : request.status === "APPROVED" ? (
          <DecisionForm
            action={suspendOrganizationAction}
            kind="suspend"
            organizationId={request.organizationId}
            requestId={request.id}
          />
        ) : (
          <p className="decision-desk__closed">
            Diese Entscheidung ist abgeschlossen. Für einen neuen Versuch ist
            eine bewusst getrennte erneute Prüfung nötig.
          </p>
        )}
      </section>
    </div>
  );
}
