import { describe, expect, it } from "vitest";
import { requireTestDatabaseUrl } from "./database";

describe("requireTestDatabaseUrl", () => {
  it("accepts an explicitly named test database", () => {
    expect(
      requireTestDatabaseUrl(
        "postgresql://runtime:secret@127.0.0.1:5432/kebapp_test",
      ),
    ).toBe("kebapp_test");
  });

  it("rejects a development or production database", () => {
    expect(() =>
      requireTestDatabaseUrl(
        "postgresql://runtime:secret@127.0.0.1:5432/kebapp",
      ),
    ).toThrow(/_test/);
  });
});
