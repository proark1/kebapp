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

const querySchema = z.object({ round: z.uuid() });

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
    round: url.searchParams.get("round") ?? "",
  });
  if (!parsed.success) {
    return new Response("Ungültige Anfrage.", { status: 400 });
  }

  try {
    const bundle = await database.transaction(async (transaction) => {
      await setAdminContext(transaction, actor);
      const roundRow = await transaction.execute<{
        closes_at: Date;
        name: string;
        organization_id: string;
        regional_key: string;
      }>(sql`
        select
          closes_at,
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
      const entries = await getConfirmedRoundBundle(
        transaction,
        parsed.data.round,
      );
      return { entries, round };
    });

    const lines = [
      ["Produkt", "Spezifikation", "Einheit", "Menge gesamt", "Positionen", "Läden"].join(";"),
      ...bundle.entries.map((entry) =>
        [
          csvEscape(entry.productName),
          csvEscape(entry.specification),
          entry.unit === "PIECE" ? "Stueck" : "kg",
          entry.totalQuantity,
          String(entry.positionCount),
          String(entry.shopCount),
        ].join(";"),
      ),
    ];

    const fileName = `buendel-${bundle.round.regional_key}.csv`;
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
