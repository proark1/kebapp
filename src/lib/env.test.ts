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
const validDemoEnv = {
  DATABASE_URL: validRuntimeEnv.DATABASE_URL,
  BETTER_AUTH_SECRET: validRuntimeEnv.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: validRuntimeEnv.BETTER_AUTH_URL,
  DEMO_MODE: "true",
};

describe("parseRuntimeEnv", () => {
  it("parses the local runtime configuration", () => {
    expect(parseRuntimeEnv(validRuntimeEnv)).toEqual({
      ...validRuntimeEnv,
      ALLOW_PUBLIC_DEMO: false,
      DEMO_MODE: false,
      SMTP_PORT: 1025,
    });
  });

  it("allows the public demo without SMTP configuration", () => {
    expect(parseRuntimeEnv(validDemoEnv)).toEqual({
      DATABASE_URL: validDemoEnv.DATABASE_URL,
      BETTER_AUTH_SECRET: validDemoEnv.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: validDemoEnv.BETTER_AUTH_URL,
      ALLOW_PUBLIC_DEMO: false,
      DEMO_MODE: true,
    });
  });

  it("rejects demo mode in production without the explicit opt-in", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(() => parseRuntimeEnv(validDemoEnv)).toThrow(
        /ALLOW_PUBLIC_DEMO=true setzen/,
      );
      expect(() =>
        parseRuntimeEnv({
          ...validDemoEnv,
          ALLOW_PUBLIC_DEMO: "true",
        }),
      ).not.toThrow();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("requires SMTP configuration outside the public demo", () => {
    expect(() =>
      parseRuntimeEnv({
        DATABASE_URL: validRuntimeEnv.DATABASE_URL,
        BETTER_AUTH_SECRET: validRuntimeEnv.BETTER_AUTH_SECRET,
        BETTER_AUTH_URL: validRuntimeEnv.BETTER_AUTH_URL,
      }),
    ).toThrow("Außerhalb des Demo-Modus ist SMTP erforderlich.");
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
