type MailpitMessage = {
  Created: string;
  ID: string;
  Subject: string;
  To: { Address: string }[];
};

type MailpitList = {
  messages: MailpitMessage[];
};

type MailpitDetail = {
  HTML: string;
  Text: string;
};

const mailpitUrl = "http://127.0.0.1:8025";

export async function waitForMailLink({
  after,
  path,
  subject,
  to,
}: {
  after: Date;
  path: RegExp;
  subject: RegExp;
  to: string;
}): Promise<string> {
  const timeoutAt = Date.now() + 15_000;

  while (Date.now() < timeoutAt) {
    const response = await fetch(`${mailpitUrl}/api/v1/messages?limit=100`);
    if (!response.ok) throw new Error("Mailpit ist nicht erreichbar.");

    const listing = (await response.json()) as MailpitList;
    const message = listing.messages.find(
      (entry) =>
        new Date(entry.Created) >= after &&
        entry.To.some((recipient) => recipient.Address.toLowerCase() === to.toLowerCase()) &&
        subject.test(entry.Subject),
    );

    if (message) {
      const detailResponse = await fetch(
        `${mailpitUrl}/api/v1/message/${encodeURIComponent(message.ID)}`,
      );
      if (!detailResponse.ok) throw new Error("Mailpit-Nachricht konnte nicht gelesen werden.");
      const detail = (await detailResponse.json()) as MailpitDetail;
      const match = `${detail.Text}\n${detail.HTML}`.match(/https?:\/\/[^\s<>"']+/g)?.find((url) =>
        path.test(url.replace(/&amp;/g, "&")),
      );
      if (match) return match.replace(/&amp;/g, "&");
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Keine passende Mailpit-Nachricht für ${to} gefunden.`);
}
