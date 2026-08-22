import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadDbEnv } from "./db-env";
import { requireTestDatabaseUrl } from "../src/server/testing/database";

const dbEnv = loadDbEnv();
requireTestDatabaseUrl(dbEnv.TEST_DATABASE_URL);

const nextCli = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);
const child = spawn(process.execPath, [nextCli, ...process.argv.slice(2)], {
  env: {
    ...process.env,
    BETTER_AUTH_URL: "http://127.0.0.1:3100",
    DATABASE_URL: dbEnv.TEST_DATABASE_URL,
  },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
