import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { parse } from "dotenv";
import { parseProductionEnv } from "./production-env";

type RoleCheck = {
  deniedPath: string;
  email: string;
  expectedPath: string;
  expectedText: string;
  label: string;
  password: string;
};

function readArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function assertPath(page: Page, expectedPath: string, label: string): void {
  const pathname = new URL(page.url()).pathname;
  if (
    pathname !== expectedPath &&
    !pathname.startsWith(`${expectedPath}/`)
  ) {
    throw new Error(`${label}: unerwarteter Zielpfad ${pathname}`);
  }
}

async function checkRole(
  page: Page,
  baseUrl: string,
  check: RoleCheck,
): Promise<void> {
  await page.goto(`${baseUrl}/anmelden`);
  await page.getByLabel("E-Mail-Adresse").fill(check.email);
  await page.getByLabel("Passwort").fill(check.password);
  await page.getByRole("button", { name: "Sicher anmelden" }).click();
  await page.waitForURL(
    (url) => !url.pathname.startsWith("/anmelden"),
    { timeout: 20_000 },
  );
  assertPath(page, check.expectedPath, check.label);
  await page.getByText(check.expectedText, { exact: false }).first().waitFor();

  await page.goto(`${baseUrl}${check.deniedPath}`);
  await page.waitForLoadState("domcontentloaded");
  assertPath(page, check.expectedPath, `${check.label} Rollenabgrenzung`);

  console.info(`${check.label}: Anmeldung und Rollenabgrenzung erfolgreich.`);
}

async function main(): Promise<void> {
  const envPath = path.resolve(
    process.cwd(),
    readArgument("--env-file") ?? ".env.production",
  );
  const env = parseProductionEnv(parse(await readFile(envPath, "utf8")));
  const baseUrl = (readArgument("--url") ?? env.BETTER_AUTH_URL).replace(
    /\/$/,
    "",
  );
  const browser = await chromium.launch({ headless: true });

  try {
    const demoContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const blockedSignUp = await demoContext.request.post(
      `${baseUrl}/api/auth/sign-up/email`,
      {
        data: {
          email: "blocked-signup@demo.kebapp.local",
          name: "Gesperrte Registrierung",
          password: "not-used-demo-password",
        },
      },
    );
    if (blockedSignUp.status() !== 404) {
      throw new Error(
        `Direkte Demo-Registrierung lieferte ${blockedSignUp.status()} statt 404.`,
      );
    }
    await demoContext.close();

    const checks: RoleCheck[] = [
      {
        deniedPath: "/app",
        email: env.DEMO_ADMIN_EMAIL,
        expectedPath: "/admin",
        expectedText: "Prüftisch NRW",
        label: "Admin",
        password: env.DEMO_ADMIN_PASSWORD,
      },
      {
        deniedPath: "/admin",
        email: env.DEMO_SUPPORT_EMAIL,
        expectedPath: "/support",
        expectedText: "Supportdesk NRW",
        label: "Support",
        password: env.DEMO_SUPPORT_PASSWORD,
      },
      {
        deniedPath: "/admin",
        email: env.DEMO_OWNER_EMAIL,
        expectedPath: "/app",
        expectedText: "Ocakbasi Rheydt",
        label: "Inhaber:in A",
        password: env.DEMO_OWNER_PASSWORD,
      },
      {
        deniedPath: "/app/website",
        email: env.DEMO_EMPLOYEE_EMAIL,
        expectedPath: "/app",
        expectedText: "Ocakbasi Rheydt",
        label: "Mitarbeiter:in",
        password: env.DEMO_EMPLOYEE_PASSWORD,
      },
      {
        deniedPath: "/admin",
        email: env.DEMO_SECOND_OWNER_EMAIL,
        expectedPath: "/app",
        expectedText: "Mangal am Markt",
        label: "Inhaber:in B",
        password: env.DEMO_SECOND_OWNER_PASSWORD,
      },
    ];

    for (const check of checks) {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      try {
        await checkRole(await context.newPage(), baseUrl, check);
      } finally {
        await context.close();
      }
    }

    console.info("Alle öffentlichen Demo-Rollen sind korrekt abgegrenzt.");
  } finally {
    await browser.close();
  }
}

main().catch(() => {
  console.error("Der Rollen-Smoke-Test ist fehlgeschlagen.");
  process.exitCode = 1;
});
