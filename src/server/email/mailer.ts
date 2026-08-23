import "server-only";

import nodemailer from "nodemailer";
import type { AuthEmail } from "./templates";

export type MailerConfig = {
  from: string;
  host: string;
  port: number;
  requireTls?: boolean;
  secure?: boolean;
};

export type KebappMailer = {
  close: () => void;
  send: (message: AuthEmail) => Promise<void>;
};

export function createMailer(config: MailerConfig): KebappMailer {
  const implicitTls = config.port === 465;
  // In Produktion wird STARTTLS erzwungen; lokal (Mailpit) und in Tests darf
  // der Relay ohne TLS sprechen, damit die Entwicklungsumgebung funktioniert.
  const requireTls =
    config.requireTls ?? process.env.NODE_ENV === "production";

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure ?? implicitTls,
    requireTLS: !implicitTls && requireTls,
    tls: {
      rejectUnauthorized: true,
    },
  });

  return {
    close() {
      transporter.close();
    },
    async send(message) {
      await transporter.sendMail({
        from: config.from,
        html: message.html,
        subject: message.subject,
        text: message.text,
        to: message.to,
      });
    },
  };
}
