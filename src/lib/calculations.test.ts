import { describe, expect, it } from "vitest";
import {
  getActiveTier,
  getBuyingRoundSnapshot,
  sumDemandKg,
} from "@/lib/calculations";
import { buyingRound, initialDemands } from "@/lib/demo-data";

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
});
