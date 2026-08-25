import type { Metadata } from "next";
import { Calculator } from "lucide-react";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import {
  listCalculations,
  upsertCalculation,
} from "@/server/calculation/service";

export const metadata: Metadata = { title: "Kalkulation" };

function euro(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

async function saveCalculationAction(formData: FormData): Promise<void> {
  "use server";
  const { redirect } = await import("next/navigation");
  const { revalidatePath } = await import("next/cache");
  const guard = await (
    await import("@/server/auth/page-guards")
  ).requireActiveOrganizationPage("/app/kalkulation");
  const fail = (meldung: string): never =>
    redirect(`/app/kalkulation?meldung=${encodeURIComponent(meldung)}`);

  const value = (name: string) => String(formData.get(name) ?? "").trim();
  const menuName = value("menuName");
  if (menuName.length < 2) return fail("Bitte einen Gerichtnamen angeben.");

  // Zeilenformat: Zutat;Menge;Einkaufspreis je Einheit in EUR
  const ingredients = value("ingredients")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, quantity, price] = line.split(/[;\t]/).map((c) => c.trim());
      return {
        name: name ?? "",
        quantity: Number((quantity ?? "").replace(",", ".")),
        unitPriceCents: Math.round(Number((price ?? "").replace(",", ".")) * 100),
      };
    });

  const salePriceRaw = value("salePrice").replace(",", ".");
  const { calculationInputSchema, upsertCalculation } = await import(
    "@/server/calculation/service"
  );
  const parsed = calculationInputSchema.safeParse({
    ingredients,
    menuItemKey: menuName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80),
    menuName,
    salePriceCents: salePriceRaw ? Math.round(Number(salePriceRaw) * 100) : undefined,
  });
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Bitte Zutatenzeilen prüfen (Zutat;Menge;Preis).",
    );
  }

  try {
    await upsertCalculation({
      actor: guard.actor,
      input: parsed.data,
      organizationId: guard.organization.organizationId,
    });
  } catch (error) {
    console.error("Kalkulation konnte nicht gespeichert werden.", error);
    return fail("Speichern fehlgeschlagen.");
  }
  revalidatePath("/app/kalkulation");
  return fail("gespeichert");
}

const meldungMessages: Record<string, string> = {
  gespeichert: "Kalkulation gespeichert",
};

export default async function KalkulationPage({
  searchParams,
}: {
  searchParams: Promise<{ meldung?: string }>;
}) {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/kalkulation",
  );
  const [calculations, query] = await Promise.all([
    listCalculations({
      actor,
      organizationId: organization.organizationId,
    }),
    searchParams,
  ]);
  const message = query.meldung
    ? (meldungMessages[query.meldung] ?? query.meldung)
    : undefined;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Lager &amp; Kalkulation</span>
          <h1>Waren-Einsatz</h1>
          <p>
            Was kostet dich ein Gericht wirklich? Zutaten erfassen, Marge zum
            Verkaufspreis sehen.
          </p>
        </div>
        <div className="admin-date-block">
          <strong>{calculations.length}</strong>
          <span>kalkuliert</span>
        </div>
      </header>

      {message ? (
        <p
          className={`save-message save-message--${query.meldung === "gespeichert" ? "success" : "error"}`}
          role="status"
        >
          {message}
        </p>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Neu / Ändern</span>
            <h2>Gericht kalkulieren</h2>
            <p>Eine Zutat pro Zeile: <strong>Zutat;Menge;Einkaufspreis €</strong></p>
          </div>
        </div>
        <form action={saveCalculationAction} className="form-stack sales-manual">
          <div className="form-grid form-grid--three">
            <label className="field">
              <span>Gericht</span>
              <input maxLength={180} name="menuName" placeholder="Döner im Fladenbrot" required />
            </label>
            <label className="field">
              <span>Verkaufspreis in € (optional)</span>
              <input min="0" name="salePrice" step="0.01" type="number" />
            </label>
          </div>
          <label className="field">
            <span>Zutaten (eine Zeile je Zutat)</span>
            <textarea
              name="ingredients"
              placeholder={"Fleisch;0.2;9.18\nBrot;0.15;2.40\nSalat;0.05;3.20"}
              required
              rows={5}
            />
          </label>
          <div className="receipt-form__footer">
            <button className="button button--primary" type="submit">
              <Calculator size={17} aria-hidden="true" /> Berechnen &amp; speichern
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Übersicht</span>
            <h2>Kalkulierte Gerichte</h2>
          </div>
        </div>
        {calculations.length === 0 ? (
          <p className="request-file__empty">Noch keine Gerichte kalkuliert.</p>
        ) : (
          <div className="demand-table-wrap">
            <table className="demand-table">
              <thead>
                <tr>
                  <th>Gericht</th>
                  <th>Zutaten</th>
                  <th>Waren-Einsatz</th>
                  <th>Marge</th>
                </tr>
              </thead>
              <tbody>
                {calculations.map((calculation) => (
                  <tr key={calculation.menuKey}>
                    <td data-label="Gericht">
                      <strong>{calculation.menuName}</strong>
                      {calculation.salePriceCents !== null ? (
                        <small>Verkauf {euro(calculation.salePriceCents)}</small>
                      ) : null}
                    </td>
                    <td data-label="Zutaten">
                      {calculation.ingredients.map((ingredient) => (
                        <small key={ingredient.name}>
                          {ingredient.name}: {ingredient.quantity} ×{" "}
                          {euro(ingredient.unitPriceCents)}
                        </small>
                      ))}
                    </td>
                    <td data-label="Waren-Einsatz">
                      <strong>{euro(calculation.totalCostCents)}</strong>
                    </td>
                    <td data-label="Marge">
                      {calculation.marginCents === null ? (
                        "—"
                      ) : (
                        <>
                          <strong
                            className={
                              calculation.marginPercent !== null &&
                              calculation.marginPercent < 60
                                ? "receipt-missing"
                                : "value-positive"
                            }
                          >
                            {euro(calculation.marginCents)}
                          </strong>
                          <small>
                            {calculation.marginPercent ?? "—"} % Marge
                            {calculation.marginPercent !== null &&
                            calculation.marginPercent < 60
                              ? " · unter 60 %"
                              : ""}
                          </small>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
