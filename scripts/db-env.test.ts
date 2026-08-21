import { describe, expect, it } from "vitest";
import { parseDbEnv } from "./db-env";

const validDbEnv = {
  POSTGRES_DB: "kebapp",
  POSTGRES_TEST_DB: "kebapp_test",
  POSTGRES_PORT: "5432",
  POSTGRES_OWNER_USER: "kebapp_owner",
  POSTGRES_OWNER_PASSWORD: "local-owner-password",
  POSTGRES_APP_USER: "kebapp_app",
  POSTGRES_APP_PASSWORD: "local-app-password",
  DATABASE_URL:
    "postgresql://kebapp_app:local-app-password@127.0.0.1:5432/kebapp",
  DATABASE_OWNER_URL:
    "postgresql://kebapp_owner:local-owner-password@127.0.0.1:5432/kebapp",
  TEST_DATABASE_URL:
    "postgresql://kebapp_app:local-app-password@127.0.0.1:5432/kebapp_test",
  TEST_DATABASE_OWNER_URL:
    "postgresql://kebapp_owner:local-owner-password@127.0.0.1:5432/kebapp_test",
  MAILPIT_SMTP_PORT: "1025",
  MAILPIT_HTTP_PORT: "8025",
  SEED_ADMIN_EMAIL: "admin@kebapp.local",
  SEED_ADMIN_PASSWORD: "local-admin-password",
};

describe("parseDbEnv", () => {
  it("parses distinct owner, runtime, and test connections", () => {
    expect(parseDbEnv(validDbEnv)).toMatchObject({
      POSTGRES_DB: "kebapp",
      POSTGRES_TEST_DB: "kebapp_test",
      POSTGRES_PORT: 5432,
      POSTGRES_OWNER_USER: "kebapp_owner",
      POSTGRES_APP_USER: "kebapp_app",
    });
  });

  it("rejects identical owner and runtime users", () => {
    expect(() =>
      parseDbEnv({
        ...validDbEnv,
        POSTGRES_APP_USER: "kebapp_owner",
        DATABASE_URL: validDbEnv.DATABASE_OWNER_URL,
      }),
    ).toThrow();
  });

  it("keeps the migration-bound runtime role name stable", () => {
    expect(() =>
      parseDbEnv({
        ...validDbEnv,
        POSTGRES_APP_USER: "custom_runtime",
        DATABASE_URL:
          "postgresql://custom_runtime:local-app-password@127.0.0.1:5432/kebapp",
        TEST_DATABASE_URL:
          "postgresql://custom_runtime:local-app-password@127.0.0.1:5432/kebapp_test",
      }),
    ).toThrow();
  });

  it("requires the test database name to end in _test", () => {
    expect(() =>
      parseDbEnv({
        ...validDbEnv,
        POSTGRES_TEST_DB: "kebapp",
      }),
    ).toThrow();
  });

  it("rejects a test connection that targets the development database", () => {
    expect(() =>
      parseDbEnv({
        ...validDbEnv,
        TEST_DATABASE_URL: validDbEnv.DATABASE_URL,
      }),
    ).toThrow();
  });
});
