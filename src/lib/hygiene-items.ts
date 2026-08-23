export type HygieneItemDefinition = {
  key: string;
  kind: "CHECK" | "TEMPERATURE";
  label: string;
  warnAboveCelsius?: number;
  targetLabel?: string;
};

export const HYGIENE_ITEMS: HygieneItemDefinition[] = [
  {
    key: "haende",
    kind: "CHECK",
    label: "Händehygiene eingehalten",
  },
  {
    key: "oberflaechen",
    kind: "CHECK",
    label: "Arbeitsflächen desinfiziert",
  },
  {
    key: "geraete",
    kind: "CHECK",
    label: "Geräte und Schneidbretter sauber",
  },
  {
    key: "muell",
    kind: "CHECK",
    label: "Müll und Leergut entsorgt",
  },
  {
    key: "kuehlschrank",
    kind: "TEMPERATURE",
    label: "Kühlschrank",
    targetLabel: "Ziel ≤ 4 °C",
    warnAboveCelsius: 6,
  },
  {
    key: "tiefkuehler",
    kind: "TEMPERATURE",
    label: "Tiefkühler",
    targetLabel: "Ziel ≤ −18 °C",
    warnAboveCelsius: -15,
  },
];

export function hygieneItemByKey(
  key: string,
): HygieneItemDefinition | undefined {
  return HYGIENE_ITEMS.find((item) => item.key === key);
}
