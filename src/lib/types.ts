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

export const STORE_FEATURES = [
  "HALAL",
  "FRESH_VEGETABLES",
  "HOMEMADE_SAUCES",
  "PREPARED_ON_SITE",
] as const;

export type StoreFeature = (typeof STORE_FEATURES)[number];

export type StoreDomainRequestStatus = "NONE" | "REVIEW_REQUESTED";

export type StoreProfile = {
  schemaVersion: 2;
  name: string;
  shortName: string;
  eyebrow: string;
  tagline: string;
  description: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  accent: string;
  features: StoreFeature[];
  logoUrl: string;
  openingHours: OpeningHour[];
  menu: MenuItem[];
};

export type StorefrontEditorData = {
  customDomain: string | null;
  domainRequestStatus: StoreDomainRequestStatus;
  requestedDomain: string | null;
  isPublished: boolean;
  profile: StoreProfile;
  publicPath: string;
  publicSlug: string;
};

export type PublicStorefrontData = {
  profile: StoreProfile;
  publicSlug: string;
};
