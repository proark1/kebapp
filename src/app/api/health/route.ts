import { databasePool } from "@/server/db/client";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await databasePool.query("select 1");

    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      {
        headers: { "Cache-Control": "no-store" },
        status: 503,
      },
    );
  }
}
