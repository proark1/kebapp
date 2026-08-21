import "server-only";

import nodemailer from "nodemailer";
import type { AuthEmail } from "./templates";

export type MailerConfig = {
  from: string;
  host: string;
  port: number;
};

export type KebappMailer = {
  close: () => void;
  send: (message: AuthEmail) => Promise<void>;
};

export function createMailer(config: MailerConfig): KebappMailer {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
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
