import type { StoreProfile } from "@/lib/types";

export const demoStoreProfile: StoreProfile = {
  accent: "#f3b83f",
  city: "Mönchengladbach",
  description:
    "Drehspieß, frisches Gemüse und unsere Saucen aus eigener Küche – mitten in Rheydt.",
  eyebrow: "Seit 1998 in Rheydt",
  features: [
    "HALAL",
    "FRESH_VEGETABLES",
    "HOMEMADE_SAUCES",
    "PREPARED_ON_SITE",
  ],
  logoUrl: "",
  menu: [
    {
      category: "Döner",
      description: "Drehspieß, Salat und Sauce nach Wahl",
      id: "menu-doener",
      name: "Döner im Fladenbrot",
      price: 7.5,
    },
    {
      category: "Döner",
      description: "Dünnes Fladenbrot, Drehspieß, Salat und Sauce",
      id: "menu-dueruem",
      name: "Dürüm",
      price: 8.5,
    },
    {
      category: "Teller",
      description: "Drehspieß, Pommes oder Reis, Salat und Sauce",
      id: "menu-teller",
      name: "Ocakbaşı Teller",
      price: 13.9,
    },
    {
      category: "Vegetarisch",
      description: "Falafel, Salat, Sesamsauce und Kräuter",
      id: "menu-falafel",
      name: "Falafel Tasche",
      price: 7,
    },
  ],
  name: "Ocakbaşı Rheydt",
  openingHours: [
    { days: "Montag–Donnerstag", hours: "11:00–23:00" },
    { days: "Freitag–Samstag", hours: "11:00–00:00" },
    { days: "Sonntag", hours: "12:00–22:00" },
  ],
  phone: "+49 2166 123456",
  postalCode: "41236",
  schemaVersion: 2,
  shortName: "OR",
  street: "Demo-Straße 24",
  tagline: "Schicht für Schicht. Jeden Tag frisch.",
};
