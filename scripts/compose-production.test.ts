import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const composeSource = readFileSync("compose.production.yaml", "utf8");

describe("compose.production.yaml", () => {
  it("passes every server-side demo credential to the app container", () => {
    const appEnvironment = composeSource.slice(
      composeSource.indexOf("x-app-environment:"),
      composeSource.indexOf("x-tooling-environment:"),
    );

    for (const key of [
      "DEMO_ADMIN_EMAIL",
      "DEMO_ADMIN_PASSWORD",
      "DEMO_SUPPORT_EMAIL",
      "DEMO_SUPPORT_PASSWORD",
      "DEMO_OWNER_EMAIL",
      "DEMO_OWNER_PASSWORD",
      "DEMO_EMPLOYEE_EMAIL",
      "DEMO_EMPLOYEE_PASSWORD",
      "DEMO_SECOND_OWNER_EMAIL",
      "DEMO_SECOND_OWNER_PASSWORD",
    ]) {
      expect(appEnvironment).toContain(`${key}:`);
    }
  });
});
