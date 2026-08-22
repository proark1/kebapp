import { describe, expect, it } from "vitest";
import { parseProductionEnv } from "./production-env";
import {
  createDemoAccessContent,
  createProductionEnvContent,
} from "./create-production-env";

const secrets = {
  adminPassword: "a".repeat(48),
  appPassword: "b".repeat(48),
  authSecret: "c".repeat(64),
  employeePassword: "d".repeat(48),
  ownerPassword: "e".repeat(48),
  ownerRolePassword: "f".repeat(48),
  secondOwnerPassword: "1".repeat(48),
  supportPassword: "2".repeat(48),
};

function parseEnvFile(content: string): Record<string, string> {
  return Object.fromEntries(
    content
      .split("\n")
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

describe("createProductionEnvContent", () => {
  it("creates a production-valid demo environment without SMTP", () => {
    const content = createProductionEnvContent(
      { host: "203-0-113-10.sslip.io", project: "kebapp-demo" },
      secrets,
    );
    const environment = parseEnvFile(content);

    expect(parseProductionEnv(environment)).toMatchObject({
      BETTER_AUTH_URL: "https://203-0-113-10.sslip.io",
      DEMO_MODE: "true",
    });
    expect(environment).not.toHaveProperty("SMTP_HOST");
    expect(environment.COMPOSE_PROJECT_NAME).toBe("kebapp-demo");
  });

  it("rejects protocols, paths and unsafe project names", () => {
    expect(() =>
      createProductionEnvContent(
        { host: "https://example.test/path", project: "kebapp-demo" },
        secrets,
      ),
    ).toThrow();
    expect(() =>
      createProductionEnvContent(
        { host: "example.test", project: "Kebapp Demo" },
        secrets,
      ),
    ).toThrow();
  });

  it("creates a separate access sheet without infrastructure secrets", () => {
    const content = createDemoAccessContent("example.test", secrets);

    expect(content).toContain("https://example.test");
    expect(content).toContain(secrets.adminPassword);
    expect(content).toContain(secrets.ownerPassword);
    expect(content).not.toContain(secrets.appPassword);
    expect(content).not.toContain(secrets.authSecret);
    expect(content).not.toContain(secrets.ownerRolePassword);
  });
});
