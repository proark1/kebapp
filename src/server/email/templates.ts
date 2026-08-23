import "server-only";

export type AuthEmail = {
  html: string;
  subject: string;
  text: string;
  to: string;
};

type AuthEmailInput = {
  name: string;
  to: string;
  url: string;
};

type EmployeeInvitationEmailInput = {
  expiresAt: Date;
  inviterName: string;
  storeName: string;
  to: string;
  url: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailShell(input: {
  action: string;
  explanation: string;
  name: string;
  url: string;
}): string {
  const action = escapeHtml(input.action);
  const explanation = escapeHtml(input.explanation);
  const name = escapeHtml(input.name);
  const url = escapeHtml(input.url);

  return `<!doctype html>
<html lang="de">
  <body style="margin:0;background:#f7f2e8;color:#231f20;font-family:Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:32px 20px">
      <div style="background:#ffffff;border:1px solid #e5dccd;border-radius:18px;padding:32px">
        <p style="margin:0 0 20px;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#b5482c">Kebapp</p>
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">${action}</h1>
        <p style="margin:0 0 12px;line-height:1.6">Hallo ${name},</p>
        <p style="margin:0 0 24px;line-height:1.6">${explanation}</p>
        <p style="margin:0 0 24px">
          <a href="${url}" style="display:inline-block;border-radius:999px;background:#b5482c;color:#ffffff;padding:13px 22px;text-decoration:none;font-weight:700">${action}</a>
        </p>
        <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6f665c">Falls die Schaltfläche nicht funktioniert:</p>
        <p style="margin:0;overflow-wrap:anywhere;font-size:13px;line-height:1.5;color:#6f665c">${url}</p>
      </div>
      <p style="margin:18px 0 0;text-align:center;font-size:12px;color:#81766b">Lokale Kebapp-Entwicklungsumgebung · keine echte Zustellung</p>
    </div>
  </body>
</html>`;
}

type RoundReminderEmailInput = {
  closesAt: Date;
  roundName: string;
  storeName: string;
  to: string;
  url: string;
};

export function roundReminderEmail(
  input: RoundReminderEmailInput,
): AuthEmail {
  const deadline = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(input.closesAt);
  const action = "Bedarf bestätigen";
  const explanation = `Die Sammelrunde "${input.roundName}" schließt am ${deadline} Uhr. Trage deinen Fleischbedarf ein oder bestätige ihn verbindlich, damit er in die regionale Gruppenmenge einfließt.`;

  return {
    html: emailShell({
      action,
      explanation,
      name: "Kebapp-Nutzer:in",
      url: input.url,
    }),
    subject: `Kebapp: Bestellschluss ${input.roundName}`,
    text: `Hallo,\n\n${explanation}\n\n${input.url}\n\nKebapp`,
    to: input.to,
  };
}

export function verificationEmail(input: AuthEmailInput): AuthEmail {
  const explanation =
    "Bitte bestätige deine E-Mail-Adresse. Der Link ist 60 Minuten gültig. Wenn du dich nicht bei Kebapp registriert hast, kannst du diese Nachricht ignorieren.";

  return {
    html: emailShell({
      action: "E-Mail-Adresse bestätigen",
      explanation,
      name: input.name,
      url: input.url,
    }),
    subject: "Kebapp: E-Mail-Adresse bestätigen",
    text: `Hallo ${input.name},\n\n${explanation}\n\n${input.url}\n\nKebapp lokal`,
    to: input.to,
  };
}

export function passwordResetEmail(input: AuthEmailInput): AuthEmail {
  const explanation =
    "Über diesen Link kannst du dein Passwort zurücksetzen. Der Link ist 30 Minuten gültig und kann nur einmal verwendet werden. Wenn du das nicht angefordert hast, kannst du diese Nachricht ignorieren.";

  return {
    html: emailShell({
      action: "Passwort zurücksetzen",
      explanation,
      name: input.name,
      url: input.url,
    }),
    subject: "Kebapp: Passwort zurücksetzen",
    text: `Hallo ${input.name},\n\n${explanation}\n\n${input.url}\n\nKebapp lokal`,
    to: input.to,
  };
}

export function employeeInvitationEmail(
  input: EmployeeInvitationEmailInput,
): AuthEmail {
  const expiry = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(input.expiresAt);
  const explanation = `${input.inviterName} lädt dich als Mitarbeiter:in zu ${input.storeName} ein. Melde dich mit dieser E-Mail-Adresse an und nimm die Einladung bis ${expiry} Uhr an.`;

  return {
    html: emailShell({
      action: "Einladung annehmen",
      explanation,
      name: "Kebapp-Teammitglied",
      url: input.url,
    }),
    subject: `Kebapp: Einladung zu ${input.storeName}`,
    text: `Hallo,\n\n${explanation}\n\n${input.url}\n\nKebapp lokal`,
    to: input.to,
  };
}
