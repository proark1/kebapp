import type { BuyingRound, DemandItem, PriceTier } from "@/lib/types";

export type BuyingRoundSnapshot = {
  storeKg: number;
  regionalKg: number;
  progressPercent: number;
  remainingKg: number;
  activeTier: PriceTier;
  nextTier: PriceTier | null;
  estimatedSavings: number;
};

export function sumDemandKg(items: DemandItem[]): number {
  return items.reduce((total, item) => {
    if (item.unit !== "kg" || !Number.isFinite(item.amount)) {
      return total;
    }

    return total + Math.max(0, item.amount);
  }, 0);
}

export function getActiveTier(tiers: PriceTier[], totalKg: number): PriceTier {
  const sortedTiers = [...tiers].sort((a, b) => a.minKg - b.minKg);
  const fallback = sortedTiers[0];

  if (!fallback) {
    throw new Error("Mindestens eine Preisstufe ist erforderlich.");
  }

  return sortedTiers.reduce(
    (active, tier) => (totalKg >= tier.minKg ? tier : active),
    fallback,
  );
}

export function getBuyingRoundSnapshot(
  round: BuyingRound,
  demands: DemandItem[],
): BuyingRoundSnapshot {
  const storeKg = sumDemandKg(demands);
  const regionalKg = round.committedKgWithoutStore + storeKg;
  const sortedTiers = [...round.tiers].sort((a, b) => a.minKg - b.minKg);
  const activeTier = getActiveTier(sortedTiers, regionalKg);
  const nextTier = sortedTiers.find((tier) => tier.minKg > regionalKg) ?? null;
  const remainingKg = Math.max(0, round.targetKg - regionalKg);
  const progressPercent = Math.min(100, (regionalKg / round.targetKg) * 100);
  const estimatedSavings = Math.max(
    0,
    storeKg * (round.referencePricePerKg - activeTier.pricePerKg),
  );

  return {
    storeKg,
    regionalKg,
    progressPercent,
    remainingKg,
    activeTier,
    nextTier,
    estimatedSavings,
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}
