export type PostLoginFacts = {
  accountStatus: "ACTIVE" | "DEACTIVATED" | "SUSPENDED";
  membershipStatuses: readonly (
    | "ACTIVE"
    | "INVITED"
    | "REMOVED"
    | "SUSPENDED"
  )[];
  platformRoles: readonly ("ADMIN" | "SUPPORT")[];
  registrationRequestCount: number;
};

export function chooseSafeContinueDestination(
  defaultDestination: string,
  requestedDestination?: string,
): string {
  if (!requestedDestination) {
    return defaultDestination;
  }

  let normalizedDestination: URL;

  try {
    normalizedDestination = new URL(
      requestedDestination,
      "https://kebapp.local",
    );
  } catch {
    return defaultDestination;
  }

  if (normalizedDestination.origin !== "https://kebapp.local") {
    return defaultDestination;
  }

  const allowedRoot =
    defaultDestination === "/app"
      ? "/app"
      : defaultDestination === "/admin"
        ? "/admin"
        : defaultDestination === "/support"
          ? "/support"
          : null;

  if (
    allowedRoot &&
    (normalizedDestination.pathname === allowedRoot ||
      normalizedDestination.pathname.startsWith(`${allowedRoot}/`))
  ) {
    return `${normalizedDestination.pathname}${normalizedDestination.search}${normalizedDestination.hash}`;
  }

  return defaultDestination;
}

export function choosePostLoginDestination(facts: PostLoginFacts): string {
  if (facts.accountStatus !== "ACTIVE") {
    return "/status";
  }

  if (facts.platformRoles.includes("ADMIN")) {
    return "/admin";
  }

  if (facts.platformRoles.includes("SUPPORT")) {
    return "/support";
  }

  const activeMemberships = facts.membershipStatuses.filter(
    (status) => status === "ACTIVE",
  ).length;

  if (activeMemberships > 1) {
    return "/organisation-waehlen";
  }

  if (activeMemberships === 1) {
    return "/app";
  }

  if (
    facts.registrationRequestCount > 0 ||
    facts.membershipStatuses.some(
      (status) => status === "INVITED" || status === "SUSPENDED",
    )
  ) {
    return "/status";
  }

  return "/antrag";
}
