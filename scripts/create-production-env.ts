import { randomBytes } from "node:crypto";
import { chmod, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { parseProductionEnv } from "./production-env";

const optionsSchema = z.object({
  accessOutput: z.string().min(1).optional(),
  host: z
    .string()
    .min(1)
    .max(253)
    .regex(/^(?:localhost|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)$/),
  output: z.string().min(1),
  project: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9_-]*$/),
});

type GeneratorOptions = z.infer<typeof optionsSchema>;

type GeneratedSecrets = {
  adminPassword: string;
  appPassword: string;
  authSecret: string;
  employeePassword: string;
  ownerPassword: string;
  ownerRolePassword: string;
  secondOwnerPassword: string;
  supportPassword: string;
};

function createSecrets(): GeneratedSecrets {
  const secret = (bytes = 24) => randomBytes(bytes).toString("hex");
  return {
    adminPassword: secret(),
    appPassword: secret(),
    authSecret: secret(32),
    employeePassword: secret(),
    ownerPassword: secret(),
    ownerRolePassword: secret(),
    secondOwnerPassword: secret(),
    supportPassword: secret(),
  };
}

export function createProductionEnvContent(
  input: Pick<GeneratorOptions, "host" | "project">,
  secrets: GeneratedSecrets,
): string {
  const options = optionsSchema.pick({ host: true, project: true }).parse(input);
  const ownerUrl = `postgresql://kebapp_owner:${secrets.ownerRolePassword}@postgres:5432/kebapp`;
  const appUrl = `postgresql://kebapp_app:${secrets.appPassword}@postgres:5432/kebapp`;
  const environment = {
    ALLOW_PUBLIC_DEMO: "true" as const,
    BETTER_AUTH_SECRET: secrets.authSecret,
    BETTER_AUTH_URL: `https://${options.host}`,
    DATABASE_OWNER_URL: ownerUrl,
    DATABASE_URL: appUrl,
    DEMO_ADMIN_EMAIL: "admin@demo.kebapp.local",
    DEMO_ADMIN_PASSWORD: secrets.adminPassword,
    DEMO_EMPLOYEE_EMAIL: "mitarbeiter@demo.kebapp.local",
    DEMO_EMPLOYEE_PASSWORD: secrets.employeePassword,
    DEMO_MODE: "true" as const,
    DEMO_OWNER_EMAIL: "inhaber@demo.kebapp.local",
    DEMO_OWNER_PASSWORD: secrets.ownerPassword,
    DEMO_SECOND_OWNER_EMAIL: "inhaber-b@demo.kebapp.local",
    DEMO_SECOND_OWNER_PASSWORD: secrets.secondOwnerPassword,
    DEMO_SUPPORT_EMAIL: "support@demo.kebapp.local",
    DEMO_SUPPORT_PASSWORD: secrets.supportPassword,
    POSTGRES_APP_PASSWORD: secrets.appPassword,
    POSTGRES_APP_USER: "kebapp_app" as const,
    POSTGRES_DB: "kebapp",
    POSTGRES_OWNER_PASSWORD: secrets.ownerRolePassword,
    POSTGRES_OWNER_USER: "kebapp_owner",
  };

  parseProductionEnv(environment);

  return [
    `KEBAPP_HOST=${options.host}`,
    `COMPOSE_PROJECT_NAME=${options.project}`,
    "",
    "POSTGRES_DB=kebapp",
    "POSTGRES_OWNER_USER=kebapp_owner",
    `POSTGRES_OWNER_PASSWORD=${secrets.ownerRolePassword}`,
    "POSTGRES_APP_USER=kebapp_app",
    `POSTGRES_APP_PASSWORD=${secrets.appPassword}`,
    `DATABASE_OWNER_URL=${ownerUrl}`,
    `DATABASE_URL=${appUrl}`,
    "",
    `BETTER_AUTH_SECRET=${secrets.authSecret}`,
    `BETTER_AUTH_URL=https://${options.host}`,
    "DEMO_MODE=true",
    "ALLOW_PUBLIC_DEMO=true",
    "",
    "DEMO_ADMIN_EMAIL=admin@demo.kebapp.local",
    `DEMO_ADMIN_PASSWORD=${secrets.adminPassword}`,
    "DEMO_SUPPORT_EMAIL=support@demo.kebapp.local",
    `DEMO_SUPPORT_PASSWORD=${secrets.supportPassword}`,
    "DEMO_OWNER_EMAIL=inhaber@demo.kebapp.local",
    `DEMO_OWNER_PASSWORD=${secrets.ownerPassword}`,
    "DEMO_EMPLOYEE_EMAIL=mitarbeiter@demo.kebapp.local",
    `DEMO_EMPLOYEE_PASSWORD=${secrets.employeePassword}`,
    "DEMO_SECOND_OWNER_EMAIL=inhaber-b@demo.kebapp.local",
    `DEMO_SECOND_OWNER_PASSWORD=${secrets.secondOwnerPassword}`,
    "",
  ].join("\n");
}

export function createDemoAccessContent(
  host: string,
  secrets: Pick<
    GeneratedSecrets,
    | "adminPassword"
    | "employeePassword"
    | "ownerPassword"
    | "secondOwnerPassword"
    | "supportPassword"
  >,
): string {
  const parsedHost = optionsSchema.shape.host.parse(host);
  return [
    "Kebapp · öffentliche Demo",
    `URL: https://${parsedHost}`,
    "",
    "Admin",
    "E-Mail: admin@demo.kebapp.local",
    `Passwort: ${secrets.adminPassword}`,
    "",
    "Support",
    "E-Mail: support@demo.kebapp.local",
    `Passwort: ${secrets.supportPassword}`,
    "",
    "Inhaber:in Ocakbasi Rheydt",
    "E-Mail: inhaber@demo.kebapp.local",
    `Passwort: ${secrets.ownerPassword}`,
    "",
    "Mitarbeiter:in Ocakbasi Rheydt",
    "E-Mail: mitarbeiter@demo.kebapp.local",
    `Passwort: ${secrets.employeePassword}`,
    "",
    "Inhaber:in Mangal am Markt",
    "E-Mail: inhaber-b@demo.kebapp.local",
    `Passwort: ${secrets.secondOwnerPassword}`,
    "",
  ].join("\n");
}

function readArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  const options = optionsSchema.parse({
    accessOutput: readArgument("--access-output"),
    host: readArgument("--host"),
    output: readArgument("--output") ?? ".env.kebapp-production",
    project: readArgument("--project") ?? "kebapp-demo",
  });
  const outputPath = path.resolve(process.cwd(), options.output);
  const secrets = createSecrets();
  const content = createProductionEnvContent(options, secrets);

  await writeFile(outputPath, content, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await chmod(outputPath, 0o600);
  if (options.accessOutput) {
    const accessOutputPath = path.resolve(process.cwd(), options.accessOutput);
    await writeFile(
      accessOutputPath,
      createDemoAccessContent(options.host, secrets),
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
    await chmod(accessOutputPath, 0o600);
    console.info(
      `Getrennte Demo-Zugangsdaten wurden exklusiv angelegt: ${accessOutputPath}`,
    );
  }
  console.info(`Produktionsumgebung wurde exklusiv angelegt: ${outputPath}`);
}

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  main().catch(() => {
    console.error(
      "Produktionsumgebung konnte nicht angelegt werden; eine vorhandene Datei wird nie überschrieben.",
    );
    process.exitCode = 1;
  });
}
