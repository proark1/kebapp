import "server-only";

export type StoreRole = "EMPLOYEE" | "OWNER";

export type OrganizationChoiceDTO = {
  initials: string;
  organizationId: string;
  role: StoreRole;
  roleLabel: "Inhaberbereich" | "Mitarbeiterzugang";
  storeName: string;
};

export type ActiveOrganizationDTO = OrganizationChoiceDTO & {
  organizationCount: number;
};

export function createInitials(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const selectedWords = words.length > 1 ? words.slice(0, 2) : words;
  const initials = selectedWords
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toLocaleUpperCase("de-DE");

  return initials || "KB";
}

export function toOrganizationChoiceDTO(input: {
  organizationId: string;
  role: StoreRole;
  storeName: string;
}): OrganizationChoiceDTO {
  return {
    initials: createInitials(input.storeName),
    organizationId: input.organizationId,
    role: input.role,
    roleLabel: input.role === "OWNER" ? "Inhaberbereich" : "Mitarbeiterzugang",
    storeName: input.storeName,
  };
}
