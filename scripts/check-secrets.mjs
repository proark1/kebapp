import { execFileSync } from "node:child_process";

// Pre-Commit-Sicherheitsnetz gegen committete Geheimnisse. Prueft ausschliesslich
// die im Commit NEU hinzugefuegten Zeilen und ergänzt die .gitignore-Regel für
// .env*-Dateien, schützt aber vor `git add -f` und versehentlich kopierten
// Zugängen in Quell-, Text- oder Dokumentdateien.

const ALLOWLIST_MARKERS = [
  "change-me",
  "replace-with",
  "example",
  "beispiel",
  "placeholder",
  "xxxxx",
  "process.env",
  "${",
];

const SECRET_PATTERNS = [
  {
    id: "private-key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    message: "Privater Schlüssel im Diff gefunden.",
  },
  {
    id: "credential-assignment",
    pattern:
      /\b(password|passwd|secret|token|api[_-]?key|access[_-]?key)\b\s*[=:]\s*["']?[A-Za-z0-9+/=_.!-]{16,}["']?\s*$/i,
    message: "Möglicher Zugangsdaten-Eintrag im Diff gefunden.",
  },
  {
    id: "database-url-password",
    pattern: /postgres(ql)?:\/\/[^\s:<"']+:[^@\s/"']{8,}@/i,
    message: "Datenbank-URL mit eingebettetem Passwort im Diff gefunden.",
  },
  {
    id: "long-hex-secret",
    pattern: /\b[0-9a-f]{48,}\b/i,
    message: "Möglicher Hex-Token (>=48 Zeichen) im Diff gefunden.",
  },
];

function getAddedLines() {
  const diff = execFileSync(
    "git",
    ["diff", "--cached", "--no-color", "--unified=0", "--diff-filter=ACMR"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );

  const additions = [];
  let currentFile;
  let nextLineNumber = 0;

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      currentFile = undefined;
      continue;
    }
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6);
      continue;
    }
    if (line.startsWith("@@")) {
      const match = /\+(\d+)/.exec(line);
      nextLineNumber = match ? Number(match[1]) : 0;
      continue;
    }
    if (
      currentFile &&
      line.startsWith("+") &&
      !line.startsWith("+++")
    ) {
      additions.push({ file: currentFile, line: nextLineNumber, text: line.slice(1) });
      nextLineNumber += 1;
      continue;
    }
    if (!line.startsWith("-") && !line.startsWith("\\")) {
      // Kontextzeilen verschieben den Zeilenzaehler nicht bei -U0.
    }
  }

  return additions;
}

function isAllowlisted(text) {
  const lower = text.toLowerCase();
  return ALLOWLIST_MARKERS.some((marker) => lower.includes(marker));
}

const findings = [];
for (const addition of getAddedLines()) {
  if (isAllowlisted(addition.text)) {
    continue;
  }
  for (const rule of SECRET_PATTERNS) {
    if (rule.pattern.test(addition.text)) {
      findings.push(
        `${addition.file}:${addition.line} (${rule.id}) ${rule.message}\n    ${addition.text.trim().slice(0, 120)}`,
      );
    }
  }
}

if (findings.length > 0) {
  console.error(
    `check:secrets hat ${findings.length} Verdachtsstelle(n) im Commit gefunden:\n\n` +
      findings.join("\n\n") +
      "\n\nFalls es sich um einen Fehlalarm handelt, formuliere die Stelle um oder nutze eine Allowlist-Markierung (zum Beispiel 'replace-with'). Ein echter Leak gehört niemals in Git.",
  );
  process.exit(1);
}
