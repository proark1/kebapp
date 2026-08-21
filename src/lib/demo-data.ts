import type { BuyingRound, DemandItem, StoreProfile } from "@/lib/types";

export const buyingRound: BuyingRound = {
  id: "mg-2026-08-24",
  closesAt: "2026-08-22T18:00:00+02:00",
  deliveryDate: "2026-08-24",
  deliveryWindow: "Montag, 24. August · 06:00–09:00 Uhr",
  committedKgWithoutStore: 598,
  name: "Fleisch · 24. August",
  regionalKey: "mg-fleisch-2026-08-24",
  status: "OPEN",
  targetKg: 750,
  referencePricePerKg: 9.18,
  tiers: [
    { minKg: 0, pricePerKg: 9.4, label: "Einzelkondition" },
    { minKg: 300, pricePerKg: 9.05, label: "Gruppenpreis 1" },
    { minKg: 500, pricePerKg: 8.65, label: "Gruppenpreis 2" },
    { minKg: 750, pricePerKg: 8.42, label: "Zielpreis" },
  ],
};

export const initialDemands: DemandItem[] = [
  {
    id: "demand-veal-1",
    product: "Kalb-Drehspieß",
    specification: "20 kg · Scheibenanteil 60 % · halal",
    amount: 60,
    unit: "kg",
    deliveryDate: "2026-08-24",
  },
  {
    id: "demand-chicken-1",
    product: "Hähnchen-Drehspieß",
    specification: "15 kg · gewürzt · halal",
    amount: 26,
    unit: "kg",
    deliveryDate: "2026-08-24",
  },
];

export const demoStoreProfile: StoreProfile = {
  schemaVersion: 1,
  name: "Ocakbaşı Rheydt",
  shortName: "OR",
  eyebrow: "Seit 1998 in Rheydt",
  tagline: "Schicht für Schicht. Jeden Tag frisch.",
  description:
    "Drehspieß, frisches Gemüse und unsere Saucen aus eigener Küche – mitten in Rheydt.",
  phone: "+49 2166 123456",
  street: "Demo-Straße 24",
  city: "41236 Mönchengladbach",
  accent: "#f3b83f",
  openingHours: [
    { days: "Montag–Donnerstag", hours: "11:00–23:00" },
    { days: "Freitag–Samstag", hours: "11:00–00:00" },
    { days: "Sonntag", hours: "12:00–22:00" },
  ],
  menu: [
    {
      id: "menu-doener",
      name: "Döner im Fladenbrot",
      description: "Drehspieß, Salat und Sauce nach Wahl",
      price: 7.5,
      category: "Döner",
    },
    {
      id: "menu-dueruem",
      name: "Dürüm",
      description: "Dünnes Fladenbrot, Drehspieß, Salat und Sauce",
      price: 8.5,
      category: "Döner",
    },
    {
      id: "menu-teller",
      name: "Ocakbaşı Teller",
      description: "Drehspieß, Pommes oder Reis, Salat und Sauce",
      price: 13.9,
      category: "Teller",
    },
    {
      id: "menu-falafel",
      name: "Falafel Tasche",
      description: "Falafel, Salat, Sesamsauce und Kräuter",
      price: 7,
      category: "Vegetarisch",
    },
  ],
};
