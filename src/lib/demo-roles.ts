export const DEMO_ROLES = [
  {
    description: "Freigaben, Anträge und Audit-Protokoll prüfen.",
    id: "admin",
    label: "Administration",
    stamp: "Plattform",
  },
  {
    description: "Zugewiesene Betriebe sicher und nachvollziehbar betreuen.",
    id: "support",
    label: "Betreuung",
    stamp: "Support",
  },
  {
    description: "Bedarf, Gruppenmenge und eigene Ladenwebsite verwalten.",
    id: "owner-a",
    label: "Inhaberin · Rheydt",
    stamp: "Betrieb A",
  },
  {
    description: "Bedarf erfassen, ohne Bestellungen verbindlich zu bestätigen.",
    id: "employee-a",
    label: "Mitarbeiter · Rheydt",
    stamp: "Betrieb A",
  },
  {
    description: "Mandantentrennung mit einem zweiten Betrieb erleben.",
    id: "owner-b",
    label: "Inhaberin · Viersen",
    stamp: "Betrieb B",
  },
] as const;

export type DemoRoleId = (typeof DEMO_ROLES)[number]["id"];

export function isDemoRoleId(value: string): value is DemoRoleId {
  return DEMO_ROLES.some((role) => role.id === value);
}
