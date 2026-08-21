import { defineConfig } from "drizzle-kit";
import { loadDbEnv } from "./scripts/db-env";

const env = loadDbEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: env.DATABASE_OWNER_URL,
  },
  strict: true,
  verbose: true,
});
