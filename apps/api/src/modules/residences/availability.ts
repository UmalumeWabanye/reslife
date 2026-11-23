import { prisma, type Prisma } from "@students/db";

export const OCCUPYING_LEASE_STATUSES = ["PENDING_MOVE_IN", "ACTIVE"] as const;

/** Prisma filter for beds that have no occupying lease. */
export const freeBedWhere: Prisma.BedWhereInput = {
  leases: { none: { status: { in: [...OCCUPYING_LEASE_STATUSES] } } },
};

/** Number of free beds per room type id. */
export async function freeBedsByRoomType(roomTypeIds: string[]): Promise<Map<string, number>> {
  if (!roomTypeIds.length) return new Map();
  const rooms = await prisma.room.findMany({
    where: { roomTypeId: { in: roomTypeIds } },
    select: { roomTypeId: true, _count: { select: { beds: { where: freeBedWhere } } } },
  });
  const out = new Map<string, number>(roomTypeIds.map((id) => [id, 0]));
  for (const r of rooms) out.set(r.roomTypeId, (out.get(r.roomTypeId) ?? 0) + r._count.beds);
  return out;
}
