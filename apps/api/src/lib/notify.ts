import { prisma, type Prisma } from "@students/db";
import { mailer } from "./mailer.js";

export interface NotificationInput {
  title: string;
  body: string;
  /** Lets the app deep-link, e.g. { type: "maintenance", id }. */
  data?: Record<string, string>;
}

/**
 * In-app notifications (shown in the student app). Push delivery to devices comes with the
 * native app builds; DeviceToken rows are already modelled for it.
 */
export async function notifyUsers(userIds: string[], n: NotificationInput) {
  const unique = [...new Set(userIds)];
  if (!unique.length) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({ userId, title: n.title, body: n.body, data: n.data as Prisma.InputJsonValue })),
  });
}

/**
 * Best-effort email fan-out; failures are logged, never thrown, so a mail outage can't
 * block posting an announcement. Sent sequentially to stay under SMTP rate limits.
 */
export async function emailUsers(
  recipients: { email: string }[],
  mail: { subject: string; text: string },
  log: { warn: (obj: object, msg: string) => void },
) {
  let sent = 0;
  for (const r of recipients) {
    try {
      await mailer.send({ to: r.email, ...mail });
      sent++;
    } catch (err) {
      log.warn({ err, to: r.email }, "announcement email failed");
    }
  }
  return sent;
}
