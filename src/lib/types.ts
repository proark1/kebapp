export type DemandUnit = "kg" | "Stück";

export type DemandItem = {
  id: string;
  product: string;
  specification: string;
  amount: number;
  unit: DemandUnit;
  deliveryDate: string;
};

export type PriceTier = {
  minKg: number;
  pricePerKg: number;
  label: string;
};

export type BuyingRound = {
  id: string;
  closesAt: string;
  deliveryDate: string;
  deliveryWindow: string;
  committedKgWithoutStore: number;
  name: string;
  regionalKey: string;
  status: "PLANNING" | "OPEN" | "CLOSED" | "SUBMITTED" | "CANCELLED";
  targetKg: number;
  referencePricePerKg: number;
  tiers: PriceTier[];
};

export type DemandPlanningData = {
  canConfirm: boolean;
  editable: boolean;
  items: DemandItem[];
  round: BuyingRound;
  submissionStatus: "DRAFT" | "CONFIRMED";
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: "Döner" | "Teller" | "Vegetarisch" | "Getränke";
};

export type OpeningHour = {
  days: string;
  hours: string;
};

export type StoreProfile = {
  schemaVersion: 1;
  name: string;
  shortName: string;
  eyebrow: string;
  tagline: string;
  description: string;
  phone: string;
  street: string;
  city: string;
  accent: string;
  openingHours: OpeningHour[];
  menu: MenuItem[];
};
