import { sql } from "drizzle-orm";
import { z } from "zod";
import { getOptionalSession } from "@/server/auth/session";
import { database } from "@/server/db/client";
import {
  getConfirmedRoundBundle,
  RoundNotFoundError,
} from "@/server/procurement/rounds";
import {
  setAdminContext,
  setOrganizationContext,
} from "@/server/organizations/admin";
import { getRegionalSavings } from "@/server/organizations/directory";

const querySchema = z.object({
  report: z.enum(["bundle", "savings"]).default("bundle"),
  round: z.uuid(),
});

function csvEscape(value: string): string {
  if (/[",;\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export async function GET(request: Request): Promise<Response> {
  const actor = await getOptionalSession();
  if (!actor) {
    return new Response("Nicht angemeldet.", { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    report: url.searchParams.get("report") ?? undefined,
    round: url.searchParams.get("round") ?? "",
  });
  if (!parsed.success) {
    return new Response("Ungültige Anfrage.", { status: 400 });
  }

  try {
    const context = await database.transaction(async (transaction) => {
      await setAdminContext(transaction, actor);
      const roundRow = await transaction.execute<{
        name: string;
        organization_id: string;
        regional_key: string;
      }>(sql`
        select
          name,
          organization_id,
          regional_key
        from public.buying_rounds
        where id = ${parsed.data.round}::uuid
        limit 1
      `);
      const round = roundRow.rows[0];
      if (!round) {
        throw new RoundNotFoundError();
      }
      await setOrganizationContext(transaction, round.organization_id);
      return round;
    });

    const fileName =
      parsed.data.report === "savings"
        ? `ersparnis-${context.regional_key}.csv`
        : `buendel-${context.regional_key}.csv`;

    const lines: string[] = [];

    if (parsed.data.report === "savings") {
      const savings = await getRegionalSavings({
        actor,
        roundId: parsed.data.round,
      });
      lines.push(
        ["Laden", "Bestaetigte kg", "Referenzpreis EUR/kg", "Effektiver Preis EUR/kg", "Ersparnis EUR"].join(";"),
        ...savings.map((entry) =>
          [
            csvEscape(entry.storeName),
            entry.confirmedKg.toFixed(3),
            entry.referencePrice?.toFixed(2) ?? "",
            entry.effectivePrice?.toFixed(2) ?? "",
            entry.savingsEur?.toFixed(2) ?? "",
          ].join(";"),
        ),
      );
    } else {
      const entries = await database.transaction(async (transaction) => {
        await setAdminContext(transaction, actor);
        await setOrganizationContext(transaction, context.organization_id);
        return getConfirmedRoundBundle(transaction, parsed.data.round);
      });
      lines.push(
        ["Produkt", "Spezifikation", "Einheit", "Menge gesamt", "Positionen", "Läden"].join(";"),
        ...entries.map((entry) =>
          [
            csvEscape(entry.productName),
            csvEscape(entry.specification),
            entry.unit === "PIECE" ? "Stueck" : "kg",
            entry.totalQuantity,
            String(entry.positionCount),
            String(entry.shopCount),
          ].join(";"),
        ),
      );
    }

    return new Response(`\uFEFF${lines.join("\r\n")}`, {
      headers: {
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof RoundNotFoundError) {
      return new Response("Sammelrunde nicht gefunden.", { status: 404 });
    }
    console.error("Der Bündel-Export ist fehlgeschlagen.");
    return new Response("Export fehlgeschlagen.", { status: 500 });
  }
}
