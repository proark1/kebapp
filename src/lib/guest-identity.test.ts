import { describe, expect, it } from "vitest";
import {
  formatGuestPhone,
  loyaltyStatus,
  LOYALTY_TARGET,
  normalizeGuestPhone,
} from "@/lib/guest-identity";

describe("normalizeGuestPhone", () => {
  it("fuehrt nationale, internationale und Null-Null-Schreibweise zusammen", () => {
    const expected = "491761234567";
    expect(normalizeGuestPhone("0176 1234567")).toBe(expected);
    expect(normalizeGuestPhone("+49 176 1234567")).toBe(expected);
    expect(normalizeGuestPhone("0049 176 1234567")).toBe(expected);
    expect(normalizeGuestPhone("0176/123 45 67")).toBe(expected);
    expect(normalizeGuestPhone("(0176) 1234567")).toBe(expected);
  });

  it("behaelt fremde Laendercodes bei", () => {
    expect(normalizeGuestPhone("+31 6 12345678")).toBe("31612345678");
  });

  it("weist unbrauchbare Eingaben zurueck", () => {
    expect(normalizeGuestPhone("")).toBeNull();
    expect(normalizeGuestPhone("   ")).toBeNull();
    expect(normalizeGuestPhone("abc")).toBeNull();
    expect(normalizeGuestPhone("0176")).toBeNull();
    expect(normalizeGuestPhone("+49 176 1234567890123")).toBeNull();
  });
});

describe("formatGuestPhone", () => {
  it("gruppiert deutsche Nummern lesbar", () => {
    expect(formatGuestPhone("491761234567")).toBe("+49 176 1234567");
  });

  it("gibt fremde Nummern unveraendert mit Plus aus", () => {
    expect(formatGuestPhone("31612345678")).toBe("+31612345678");
  });
});

describe("loyaltyStatus", () => {
  it("zaehlt bis zum Ziel und schaltet dann frei", () => {
    expect(loyaltyStatus(0)).toEqual({
      collected: 0,
      redeemable: false,
      remaining: LOYALTY_TARGET,
      target: LOYALTY_TARGET,
    });
    expect(loyaltyStatus(LOYALTY_TARGET - 1).redeemable).toBe(false);
    expect(loyaltyStatus(LOYALTY_TARGET).redeemable).toBe(true);
    expect(loyaltyStatus(LOYALTY_TARGET + 3).remaining).toBe(0);
  });

  it("faengt negative Zaehler ab", () => {
    expect(loyaltyStatus(-5).collected).toBe(0);
  });
});
