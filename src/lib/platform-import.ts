import { normalizeGuestPhone } from "@/lib/guest-identity";

// Lieferplattformen exportieren CSV in sehr unterschiedlicher Form. Der Parser
// erwartet deshalb nur benannte Spalten, erkennt das Trennzeichen selbst und
// meldet jede uebersprungene Zeile einzeln zurueck, statt still zu schlucken.

export type PlatformOrderMode = "PICKUP" | "DELIVERY";

export type PlatformOrderItem = {
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export type PlatformOrderRow = {
  externalReference: string;
  items: PlatformOrderItem[];
  line: number;
  mode: PlatformOrderMode;
  name: string | null;
  phone: string;
  placedAt: Date;
  totalCents: number;
};

export type PlatformImportIssue = {
  line: number;
  reason: string;
};

export type PlatformImportResult = {
  issues: PlatformImportIssue[];
  rows: PlatformOrderRow[];
};

const columnAliases = {
  amount: ["betrag", "summe", "gesamt", "gesamtbetrag", "total", "amount"],
  date: ["datum", "zeitpunkt", "bestelldatum", "date", "placed_at"],
  items: ["artikel", "positionen", "gerichte", "items"],
  mode: ["art", "bestellart", "typ", "lieferart", "mode"],
  name: ["name", "kunde", "kundenname", "customer"],
  phone: ["telefon", "telefonnummer", "handy", "mobil", "phone"],
  reference: ["bestellnummer", "referenz", "nummer", "id", "order_id"],
} as const;

type ColumnKey = keyof typeof columnAliases;

export const PLATFORM_IMPORT_COLUMNS =
  "bestellnummer, datum, telefon, betrag (optional: name, art, artikel)";

function detectSeparator(headerLine: string): string {
  const candidates = [";", "\t", ","];
  let best = ";";
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = headerLine.split(candidate).length;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

function splitLine(line: string, separator: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === separator) {
      fields.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  fields.push(current);
  return fields.map((field) => field.trim());
}

function mapColumns(header: string[]): Partial<Record<ColumnKey, number>> {
  const mapping: Partial<Record<ColumnKey, number>> = {};
  header.forEach((rawLabel, index) => {
    const label = rawLabel.trim().toLowerCase().replace(/^﻿/, "");
    for (const [key, aliases] of Object.entries(columnAliases)) {
      if (mapping[key as ColumnKey] !== undefined) continue;
      if ((aliases as readonly string[]).includes(label)) {
        mapping[key as ColumnKey] = index;
      }
    }
  });
  return mapping;
}

export function parseAmountToCents(value: string): number | null {
  const cleaned = value.replace(/[^\d,.-]/g, "").trim();
  if (cleaned === "") return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized: string;

  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = cleaned.replace(",", ".");
  } else {
    normalized = cleaned;
  }

  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export function parsePlatformDate(value: string): Date | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const germanMatch =
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/.exec(trimmed);
  if (germanMatch) {
    const [, day, month, year, hour, minute] = germanMatch;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour ?? 0),
      Number(minute ?? 0),
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(
    trimmed,
  );
  if (isoMatch) {
    const parsed = new Date(trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T"));
    if (!Number.isNaN(parsed.getTime())) return parsed;
    const [, year, month, day, hour, minute] = isoMatch;
    const fallback = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour ?? 0),
      Number(minute ?? 0),
    );
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  return null;
}

function parseMode(value: string | undefined): PlatformOrderMode {
  const normalized = (value ?? "").trim().toLowerCase();
  if (
    normalized.startsWith("abhol") ||
    normalized.startsWith("pickup") ||
    normalized.startsWith("selbstabhol")
  ) {
    return "PICKUP";
  }
  return "DELIVERY";
}

export function parsePlatformItems(
  value: string | undefined,
  totalCents: number,
): PlatformOrderItem[] {
  const raw = (value ?? "").trim();
  if (raw === "") {
    return [
      { name: "Plattformbestellung", quantity: 1, unitPriceCents: totalCents },
    ];
  }

  const parts = raw
    .split(/[|;]/)
    .map((part) => part.trim())
    .filter((part) => part !== "");

  const items: PlatformOrderItem[] = [];
  for (const part of parts) {
    const match = /^(\d{1,2})\s*[x×*]\s*(.+)$/i.exec(part);
    const quantity = match ? Number(match[1]) : 1;
    const name = (match ? match[2] : part).trim().slice(0, 160);
    if (name === "" || quantity < 1 || quantity > 99) continue;
    items.push({ name, quantity, unitPriceCents: 0 });
  }

  if (items.length === 0) {
    return [
      { name: "Plattformbestellung", quantity: 1, unitPriceCents: totalCents },
    ];
  }

  // Der Export nennt keine Einzelpreise. Der Gesamtbetrag wird deshalb auf die
  // Positionen verteilt, damit die Summe der Positionen zum Auftrag passt.
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const perUnit = Math.floor(totalCents / units);
  return items.map((item) => ({ ...item, unitPriceCents: perUnit }));
}

export function parsePlatformCsv(content: string): PlatformImportResult {
  const issues: PlatformImportIssue[] = [];
  const rows: PlatformOrderRow[] = [];

  const lines = content
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line, index) => index === 0 || line.trim() !== "");

  if (lines.length === 0 || (lines[0] ?? "").trim() === "") {
    return { issues: [{ line: 1, reason: "Die Datei ist leer." }], rows };
  }

  const separator = detectSeparator(lines[0]!);
  const columns = mapColumns(splitLine(lines[0]!, separator));

  const missing = (["reference", "date", "phone", "amount"] as const).filter(
    (key) => columns[key] === undefined,
  );
  if (missing.length > 0) {
    return {
      issues: [
        {
          line: 1,
          reason: `Kopfzeile unvollstaendig. Erwartet werden Spalten: ${PLATFORM_IMPORT_COLUMNS}.`,
        },
      ],
      rows,
    };
  }

  const seen = new Set<string>();

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.trim() === "") continue;
    const lineNumber = index + 1;
    const fields = splitLine(line, separator);
    const read = (key: ColumnKey) => fields[columns[key]!] ?? "";

    const externalReference = read("reference").trim().slice(0, 120);
    if (externalReference === "") {
      issues.push({ line: lineNumber, reason: "Bestellnummer fehlt." });
      continue;
    }
    if (seen.has(externalReference)) {
      issues.push({
        line: lineNumber,
        reason: `Bestellnummer ${externalReference} kommt in der Datei mehrfach vor.`,
      });
      continue;
    }

    const placedAt = parsePlatformDate(read("date"));
    if (!placedAt) {
      issues.push({
        line: lineNumber,
        reason: `Datum "${read("date")}" ist nicht lesbar.`,
      });
      continue;
    }

    const phone = normalizeGuestPhone(read("phone"));
    if (!phone) {
      issues.push({
        line: lineNumber,
        reason: `Telefonnummer "${read("phone")}" ist nicht lesbar.`,
      });
      continue;
    }

    const totalCents = parseAmountToCents(read("amount"));
    if (totalCents === null) {
      issues.push({
        line: lineNumber,
        reason: `Betrag "${read("amount")}" ist nicht lesbar.`,
      });
      continue;
    }

    seen.add(externalReference);
    rows.push({
      externalReference,
      items: parsePlatformItems(
        columns.items === undefined ? "" : read("items"),
        totalCents,
      ),
      line: lineNumber,
      mode: parseMode(columns.mode === undefined ? "" : read("mode")),
      name:
        columns.name === undefined
          ? null
          : (read("name").trim().slice(0, 120) || null),
      phone,
      placedAt,
      totalCents,
    });
  }

  return { issues, rows };
}
