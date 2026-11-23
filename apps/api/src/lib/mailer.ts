import nodemailer from "nodemailer";
import { env } from "../env.js";

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465, // implicit TLS; other ports upgrade with STARTTLS when offered
  ...(env.SMTP_USER && env.SMTP_PASS ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
});

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Swappable for tests. */
export const mailer = {
  async send(mail: Mail): Promise<void> {
    await transport.sendMail({ from: env.MAIL_FROM, ...mail });
  },
};
