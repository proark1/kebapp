import { betterAuth } from "better-auth";

/**
 * CLI-only schema contract. Runtime authentication lives in src/lib/auth.ts.
 * Email/password and Next.js cookies add no tables; database-backed rate
 * limiting is the only optional schema feature that must be mirrored here.
 */
export const auth = betterAuth({
  rateLimit: {
    enabled: true,
    storage: "database",
  },
});
