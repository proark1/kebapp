import { describe, expect, it } from "vitest";
import {
  getActiveTier,
  getBuyingRoundSnapshot,
  sumDemandKg,
} from "@/lib/calculations";
import type { BuyingRound, DemandItem } from "@/lib/types";

const buyingRound: BuyingRound = {
  closesAt: "2026-08-22T16:00:00.000Z",
  committedKgWithoutStore: 598,
  deliveryDate: "2026-08-24",
  deliveryWindow: "24. August 2026 · 06:00–09:00 Uhr",
  id: "20000000-0000-4000-8000-000000000001",
  name: "Fleisch · 24. August",
  referencePricePerKg: 9.18,
  regionalKey: "mg-fleisch-2026-08-24",
  status: "OPEN",
  targetKg: 750,
  tiers: [
    { minKg: 0, pricePerKg: 9.4, label: "Einzelkondition" },
    { minKg: 300, pricePerKg: 9.05, label: "Gruppenpreis 1" },
    { minKg: 500, pricePerKg: 8.65, label: "Gruppenpreis 2" },
    { minKg: 750, pricePerKg: 8.42, label: "Zielpreis" },
  ],
};
const initialDemands: DemandItem[] = [
  {
    amount: 60,
    deliveryDate: "2026-08-24",
    id: "kalb",
    product: "Kalb-Drehspieß",
    specification: "20 kg · halal",
    unit: "kg",
  },
  {
    amount: 26,
    deliveryDate: "2026-08-24",
    id: "haehnchen",
    product: "Hähnchen-Drehspieß",
    specification: "15 kg · halal",
    unit: "kg",
  },
];

describe("buying round calculations", () => {
  it("aggregates only kilogram positions", () => {
    expect(sumDemandKg(initialDemands)).toBe(86);
    expect(
      sumDemandKg([
        ...initialDemands,
        {
          ...initialDemands[0],
          id: "piece-item",
          amount: 20,
          unit: "Stück",
        },
      ]),
    ).toBe(86);
  });

  it("selects the highest reached price tier", () => {
    expect(getActiveTier(buyingRound.tiers, 684).label).toBe("Gruppenpreis 2");
    expect(getActiveTier(buyingRound.tiers, 750).label).toBe("Zielpreis");
  });

  it("builds a transparent snapshot for the current store demand", () => {
    const snapshot = getBuyingRoundSnapshot(buyingRound, initialDemands);

    expect(snapshot.storeKg).toBe(86);
    expect(snapshot.regionalKg).toBe(684);
    expect(snapshot.remainingKg).toBe(66);
    expect(snapshot.activeTier.pricePerKg).toBe(8.65);
    expect(snapshot.estimatedSavings).toBeCloseTo(45.58);
  });

  it("combines only the approved anonymous regional total with the own draft", () => {
    const snapshot = getBuyingRoundSnapshot(
      { ...buyingRound, committedKgWithoutStore: 70 },
      [{ ...initialDemands[0], amount: 60 }],
    );

    expect(snapshot.storeKg).toBe(60);
    expect(snapshot.regionalKg).toBe(130);
  });
});
