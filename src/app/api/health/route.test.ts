import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();

vi.mock("@/server/db/client", () => ({
  databasePool: { query },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("reports a healthy app and database without caching", async () => {
    query.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns only a generic 503 response when the database is unavailable", async () => {
    query.mockRejectedValueOnce(new Error("secret connection details"));
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "unavailable" });
  });
});
