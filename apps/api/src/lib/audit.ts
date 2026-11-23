import { prisma, type Prisma } from "@students/db";

type Tx = Prisma.TransactionClient | typeof prisma;

export async function audit(
  tx: Tx,
  entry: {
    actorId?: string | null;
    action: string;
    entity: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    ip?: string;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
      ip: entry.ip,
    },
  });
}
