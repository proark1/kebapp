import { describe, expect, it, vi } from "vitest";
import { parseRuntimeEnv } from "@/lib/env";

vi.mock("server-only", () => ({}));

const validRuntimeEnv = {
  DATABASE_URL:
    "postgresql://kebapp_app:local-app-password@127.0.0.1:5432/kebapp",
  BETTER_AUTH_SECRET:
    "local-only-better-auth-secret-with-at-least-32-characters",
  BETTER_AUTH_URL: "http://localhost:3000",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "1025",
  SMTP_FROM: "Kebapp lokal <no-reply@kebapp.local>",
};

describe("parseRuntimeEnv", () => {
  it("parses the local runtime configuration", () => {
    expect(parseRuntimeEnv(validRuntimeEnv)).toEqual({
      ...validRuntimeEnv,
      SMTP_PORT: 1025,
    });
  });

  it("rejects a short Better Auth secret", () => {
    expect(() =>
      parseRuntimeEnv({
        ...validRuntimeEnv,
        BETTER_AUTH_SECRET: "too-short",
      }),
    ).toThrow();
  });

  it("rejects a non-PostgreSQL database URL", () => {
    expect(() =>
      parseRuntimeEnv({
        ...validRuntimeEnv,
        DATABASE_URL: "https://example.com/kebapp",
      }),
    ).toThrow();
  });

  it("does not include owner-only variables in its result", () => {
    expect(
      parseRuntimeEnv({
        ...validRuntimeEnv,
        DATABASE_OWNER_URL:
          "postgresql://kebapp_owner:owner-password@127.0.0.1:5432/kebapp",
      }),
    ).not.toHaveProperty("DATABASE_OWNER_URL");
  });
});
