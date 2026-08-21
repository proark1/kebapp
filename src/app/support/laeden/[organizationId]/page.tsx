import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileClock, PackagePlus, Phone, ShieldAlert, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";
import { requirePlatformSupportPage } from "@/server/auth/page-guards";
import { listSupportOrganizationAudit } from "@/server/audit/queries";
import { getDemandPlanning } from "@/server/procurement/queries";
import { getStorefrontEditor } from "@/server/storefront/queries";
import {
  getAssignedSupportOrganization,
  SupportAssignmentNotFoundError,
} from "@/server/support/service";
import {
  supportAddDemandAction,
  supportRemoveDemandAction,
  supportUpdateDemandAction,
  supportUpdatePhoneAction,
} from "./actions";

export const metadata: Metadata = { title: "Laden betreuen" };

const messages: Record<string, { text: string; tone: "error" | "success" }> = {
  "bedarf-entfernt": { text: "Bedarfsposition wurde entfernt und protokolliert.", tone: "success" },
  "bedarf-gespeichert": { text: "Menge wurde geändert und protokolliert.", tone: "success" },
  "bedarf-hinzugefuegt": { text: "Bedarfsposition wurde ergänzt und protokolliert.", tone: "success" },
  gesperrt: { text: "Die Runde oder Position ist nicht mehr änderbar.", tone: "error" },
  "grund-fehlt": { text: "Bitte einen nachvollziehbaren Änderungsgrund angeben.", tone: "error" },
  ungueltig: { text: "Bitte die Eingaben vollständig prüfen.", tone: "error" },
  "website-gespeichert": { text: "Telefonnummer wurde geändert und protokolliert.", tone: "success" },
  "website-unvollstaendig": { text: "Die veröffentlichte Website ist noch nicht vollständig.", tone: "error" },
};

const actionLabels: Record<string, string> = {
  ORGANIZATION_REGISTRATION_APPROVED: "Pilotzugang freigegeben",
  SUPPORT_DEMAND_ITEM_ADDED: "Bedarfsposition ergänzt",
  SUPPORT_DEMAND_ITEM_REMOVED: "Bedarfsposition entfernt",
  SUPPORT_DEMAND_QUANTITY_UPDATED: "Bedarfsmenge geändert",
  SUPPORT_STOREFRONT_UPDATED: "Ladenwebsite geändert",
};

export default async function SupportStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ meldung?: string }>;
}) {
  const actor = await requirePlatformSupportPage("/support");
  const { organizationId } = await params;
  let assignment;
  try {
    assignment = await getAssignedSupportOrganization({ actor, organizationId });
  } catch (error) {
    if (error instanceof SupportAssignmentNotFoundError) {
      redirect("/support?meldung=kein-zugriff");
    }
    throw error;
  }
  const [planning, storefront, audit, query] = await Promise.all([
    getDemandPlanning({ actor, organizationId }),
    getStorefrontEditor({ actor, organizationId }),
    listSupportOrganizationAudit({ actor, organizationId }),
    searchParams,
  ]);
  const message = query.meldung ? messages[query.meldung] : undefined;

  return (
    <div className="support-page support-store-page">
      <Link className="support-back-link" href="/support"><ArrowLeft size={17} /> Meine Läden</Link>
      <header className="support-store-header">
        <div>
          <p>Aktiver Supporteinsatz</p>
          <h1>{assignment.storeName}</h1>
          <span>{assignment.purpose ?? "Operative Unterstützung"}</span>
        </div>
        <div className="support-store-header__scope">
          <ShieldAlert size={20} aria-hidden="true" />
          <span>Du arbeitest als Support<strong>Nicht als Ladeninhaber:in</strong></span>
        </div>
      </header>

      {message ? (
        <p className={`support-message support-message--${message.tone}`} role="status">{message.text}</p>
      ) : null}

      <div className="support-operation-grid">
        <section className="support-operation-card support-operation-card--wide">
          <header>
            <div><p className="eyebrow">Gruppeneinkauf</p><h2>Bedarf unterstützen</h2></div>
            <span>{planning?.editable ? "Entwurf offen" : "Nicht änderbar"}</span>
          </header>
          {!planning ? (
            <p className="support-card-empty">Aktuell ist keine Sammelrunde angelegt.</p>
          ) : (
            <>
              <div className="support-round-summary">
                <strong>{planning.round.name}</strong>
                <span>Lieferung {planning.round.deliveryWindow}</span>
                <small>Bestätigen bleibt ausschließlich dem Ladeninhaber vorbehalten.</small>
              </div>
              <div className="support-demand-list">
                {planning.items.map((item) => (
                  <form action={supportUpdateDemandAction} key={item.id}>
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <input type="hidden" name="demandItemId" value={item.id} />
                    <div><strong>{item.product}</strong><small>{item.specification}</small></div>
                    <label className="field"><span>Menge in {item.unit}</span><input name="quantity" type="number" min="0.001" max="999999" step="0.001" defaultValue={item.amount} required /></label>
                    <label className="field support-reason-field"><span>Änderungsgrund</span><input name="reason" minLength={10} maxLength={600} placeholder="Rücksprache, Quelle, Anlass …" required /></label>
                    <div className="support-row-actions">
                      <button className="button button--primary" type="submit" disabled={!planning.editable}>Menge speichern</button>
                      <button className="support-delete-button" formAction={supportRemoveDemandAction} type="submit" disabled={!planning.editable} aria-label={`${item.product} entfernen`}><Trash2 size={17} /></button>
                    </div>
                  </form>
                ))}
              </div>
              {planning.editable ? (
                <form action={supportAddDemandAction} className="support-add-demand">
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="buyingRoundId" value={planning.round.id} />
                  <input type="hidden" name="requestedDeliveryDate" value={planning.round.deliveryDate} />
                  <input type="hidden" name="unit" value="KG" />
                  <h3><PackagePlus size={19} /> Position ergänzen</h3>
                  <div className="form-grid form-grid--two">
                    <label className="field"><span>Produkt</span><input name="productName" maxLength={160} required /></label>
                    <label className="field"><span>Menge in kg</span><input name="quantity" type="number" min="0.001" step="0.001" required /></label>
                  </div>
                  <label className="field"><span>Spezifikation</span><input name="specification" maxLength={300} required /></label>
                  <label className="field"><span>Änderungsgrund</span><textarea name="reason" minLength={10} maxLength={600} required /></label>
                  <button className="button button--secondary" type="submit">Position protokolliert ergänzen</button>
                </form>
              ) : null}
            </>
          )}
        </section>

        <section className="support-operation-card">
          <header><div><p className="eyebrow">Kostenlose Website</p><h2>Kontakt korrigieren</h2></div><Phone size={20} /></header>
          <form action={supportUpdatePhoneAction} className="support-phone-form">
            <input type="hidden" name="organizationId" value={organizationId} />
            <label className="field"><span>Öffentliche Telefonnummer</span><input name="phone" defaultValue={storefront.profile.phone} maxLength={40} required /></label>
            <label className="field"><span>Änderungsgrund</span><textarea name="reason" minLength={10} maxLength={600} placeholder="Wie wurde die neue Nummer bestätigt?" required /></label>
            <button className="button button--primary" type="submit">Kontakt speichern</button>
          </form>
          <Link className="support-public-link" href={storefront.publicPath} target="_blank">Öffentliche Website ansehen <ExternalLink size={15} /></Link>
        </section>

        <section className="support-operation-card">
          <header><div><p className="eyebrow">Ereignisspur</p><h2>Letzte Änderungen</h2></div><FileClock size={20} /></header>
          {audit.length === 0 ? <p className="support-card-empty">Noch keine protokollierten Änderungen.</p> : (
            <ol className="support-audit-list">
              {audit.map((event) => (
                <li key={event.id}>
                  <span>{actionLabels[event.action] ?? event.action}</span>
                  <p>{event.reason ?? "Ohne gesonderte Begründung"}</p>
                  <small>{event.actorLabel} · {new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(event.createdAt))}</small>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
