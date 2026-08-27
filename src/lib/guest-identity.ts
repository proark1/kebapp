// Die Telefonnummer ist die Identitaet eines Gastes. Sie wird an genau einer
// Stelle normalisiert, damit "0176 123", "+49 176 123" und "0049176123"
// denselben Datensatz treffen.

export const LOYALTY_TARGET = 10;
export const LOYALTY_DEFAULT_REWARD = "Ein Gericht gratis";

const DEFAULT_COUNTRY_CODE = "49";
const e164Pattern = /^[1-9]\d{7,14}$/;

export function normalizeGuestPhone(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const digits = trimmed.replace(/\D/g, "");
  if (digits === "") return null;

  let normalized: string;
  if (trimmed.startsWith("+")) {
    normalized = digits;
  } else if (digits.startsWith("00")) {
    normalized = digits.slice(2);
  } else if (digits.startsWith("0")) {
    // Nationale Schreibweise im Pilotgebiet: fuehrende Null durch Laendercode
    // ersetzen.
    normalized = `${DEFAULT_COUNTRY_CODE}${digits.replace(/^0+/, "")}`;
  } else {
    normalized = digits;
  }

  return e164Pattern.test(normalized) ? normalized : null;
}

export function formatGuestPhone(normalized: string): string {
  if (!normalized.startsWith(DEFAULT_COUNTRY_CODE)) {
    return `+${normalized}`;
  }
  const national = normalized.slice(DEFAULT_COUNTRY_CODE.length);
  if (national.length < 4) {
    return `+${DEFAULT_COUNTRY_CODE} ${national}`;
  }
  return `+${DEFAULT_COUNTRY_CODE} ${national.slice(0, 3)} ${national.slice(3)}`;
}

export type LoyaltyStatus = {
  collected: number;
  redeemable: boolean;
  remaining: number;
  target: number;
};

export function loyaltyStatus(collected: number): LoyaltyStatus {
  const safeCollected = Math.max(0, Math.trunc(collected));
  return {
    collected: safeCollected,
    redeemable: safeCollected >= LOYALTY_TARGET,
    remaining: Math.max(0, LOYALTY_TARGET - safeCollected),
    target: LOYALTY_TARGET,
  };
}
