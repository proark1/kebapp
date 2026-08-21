import { betterAuth } from "better-auth";

/**
 * CLI-only schema contract. Runtime authentication is configured separately in
 * Task 4; keeping this file minimal makes the generated Better Auth tables
 * reproducible before the HTTP authentication flow exists.
 */
export const auth = betterAuth({
  rateLimit: {
    enabled: true,
    storage: "database",
  },
});
