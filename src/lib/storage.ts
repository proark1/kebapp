import type { DemandItem, StoreProfile } from "@/lib/types";

export const DEMANDS_STORAGE_KEY = "kebapp:demands:v1";
export const STORE_STORAGE_KEY = "kebapp:store-profile:v1";

type VersionedDemands = {
  schemaVersion: 1;
  items: DemandItem[];
};

function isDemandItem(value: unknown): value is DemandItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<DemandItem>;
  return (
    typeof item.id === "string" &&
    typeof item.product === "string" &&
    typeof item.specification === "string" &&
    typeof item.amount === "number" &&
    Number.isFinite(item.amount) &&
    item.amount > 0 &&
    (item.unit === "kg" || item.unit === "Stück") &&
    typeof item.deliveryDate === "string"
  );
}

function isStoreProfile(value: unknown): value is StoreProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const profile = value as Partial<StoreProfile>;
  return (
    profile.schemaVersion === 1 &&
    typeof profile.name === "string" &&
    typeof profile.shortName === "string" &&
    typeof profile.eyebrow === "string" &&
    typeof profile.tagline === "string" &&
    typeof profile.description === "string" &&
    typeof profile.phone === "string" &&
    typeof profile.street === "string" &&
    typeof profile.city === "string" &&
    typeof profile.accent === "string" &&
    Array.isArray(profile.openingHours) &&
    Array.isArray(profile.menu)
  );
}

export function loadDemands(storage: Storage): DemandItem[] | null {
  try {
    const raw = storage.getItem(DEMANDS_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const value = JSON.parse(raw) as Partial<VersionedDemands>;
    if (
      value.schemaVersion !== 1 ||
      !Array.isArray(value.items) ||
      !value.items.every(isDemandItem)
    ) {
      return null;
    }

    return value.items;
  } catch {
    return null;
  }
}

export function saveDemands(storage: Storage, items: DemandItem[]): boolean {
  try {
    const value: VersionedDemands = { schemaVersion: 1, items };
    storage.setItem(DEMANDS_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadStoreProfile(storage: Storage): StoreProfile | null {
  try {
    const raw = storage.getItem(STORE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const value = JSON.parse(raw) as unknown;
    return isStoreProfile(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveStoreProfile(storage: Storage, profile: StoreProfile): boolean {
  try {
    storage.setItem(STORE_STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}
