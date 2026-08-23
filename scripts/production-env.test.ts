import { describe, expect, it } from "vitest";
import { parseProductionEnv } from "./production-env";

const validEnv = {
  ALLOW_PUBLIC_DEMO: "true",
  BETTER_AUTH_SECRET: "a-production-auth-secret-with-at-least-32-characters",
  BETTER_AUTH_URL: "https://203-0-113-10.sslip.io",
  DATABASE_OWNER_URL:
    "postgresql://kebapp_owner:owner-password-long@postgres:5432/kebapp",
  DATABASE_URL:
    "postgresql://kebapp_app:runtime-password-long@postgres:5432/kebapp",
  DEMO_ADMIN_EMAIL: "admin@demo.kebapp.local",
  DEMO_ADMIN_PASSWORD: "admin-password-long",
  DEMO_EMPLOYEE_EMAIL: "employee@demo.kebapp.local",
  DEMO_EMPLOYEE_PASSWORD: "employee-password-long",
  DEMO_MODE: "true",
  DEMO_OWNER_EMAIL: "owner@demo.kebapp.local",
  DEMO_OWNER_PASSWORD: "owner-password-long",
  DEMO_SECOND_OWNER_EMAIL: "owner-b@demo.kebapp.local",
  DEMO_SECOND_OWNER_PASSWORD: "owner-b-password-long",
  DEMO_SUPPORT_EMAIL: "support@demo.kebapp.local",
  DEMO_SUPPORT_PASSWORD: "support-password-long",
  POSTGRES_APP_PASSWORD: "runtime-password-long",
  POSTGRES_APP_USER: "kebapp_app",
  POSTGRES_DB: "kebapp",
  POSTGRES_OWNER_PASSWORD: "owner-password-long",
  POSTGRES_OWNER_USER: "kebapp_owner",
};

describe("parseProductionEnv", () => {
  it("accepts separated owner and runtime connections for the public demo", () => {
    expect(parseProductionEnv(validEnv)).toMatchObject({
      DEMO_MODE: "true",
      POSTGRES_APP_USER: "kebapp_app",
      POSTGRES_DB: "kebapp",
    });
  });

  it("rejects a runtime connection using the owner role", () => {
    expect(() =>
      parseProductionEnv({
        ...validEnv,
        DATABASE_URL: validEnv.DATABASE_OWNER_URL,
      }),
    ).toThrow("Die Verbindung muss die Rolle kebapp_app verwenden.");
  });

  it("rejects duplicate demo email addresses", () => {
    expect(() =>
      parseProductionEnv({
        ...validEnv,
        DEMO_SUPPORT_EMAIL: validEnv.DEMO_ADMIN_EMAIL,
      }),
    ).toThrow("Jedes Demo-Konto benötigt eine eigene E-Mail-Adresse.");
  });

  it("rejects non-demo and short-secret configurations", () => {
    expect(() =>
      parseProductionEnv({ ...validEnv, DEMO_MODE: "false" }),
    ).toThrow();
    expect(() =>
      parseProductionEnv({ ...validEnv, BETTER_AUTH_SECRET: "short" }),
    ).toThrow();
    expect(() =>
      parseProductionEnv({ ...validEnv, ALLOW_PUBLIC_DEMO: "false" }),
    ).toThrow();
  });
});
