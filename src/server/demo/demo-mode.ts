import "server-only";

import type { AuthFormState } from "@/lib/auth-form-state";
import { getRuntimeEnv, type RuntimeEnv } from "@/lib/env";

export const publicDemoMessage =
  "Diese öffentliche Demo versendet keine E-Mails. Nutze bitte einen bereitgestellten Demo-Zugang.";

export function isPublicDemo(
  env: Pick<RuntimeEnv, "DEMO_MODE"> = getRuntimeEnv(),
): boolean {
  return env.DEMO_MODE;
}

export function publicDemoAuthState(): AuthFormState {
  return {
    message: publicDemoMessage,
    status: "error",
  };
}
