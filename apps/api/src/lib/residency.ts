import { prisma, type Prisma } from "@students/db";
import { forbidden } from "./errors.js";
import { getStudentProfile } from "./guards.js";

/**
 * A lease that makes someone a resident: pending move-in or active, and either created
 * directly by the landlord or from an offer the student has accepted.
 */
export const residentLeaseWhere: Prisma.LeaseWhereInput = {
  status: { in: ["PENDING_MOVE_IN", "ACTIVE"] },
  OR: [{ applicationId: null }, { application: { status: "ACCEPTED_BY_STUDENT" } }],
};

/** Leases at a given residence that count as residents. */
export function residentsOf(residenceId: string): Prisma.LeaseWhereInput {
  return { ...residentLeaseWhere, bed: { room: { roomType: { residenceId } } } };
}

/** The calling student's current lease with its residence id, or null. */
export async function findCurrentLease(studentProfileId: string) {
  const lease = await prisma.lease.findFirst({
    where: { studentId: studentProfileId, ...residentLeaseWhere },
    orderBy: { startDate: "desc" },
    include: { bed: { include: { room: { include: { roomType: { select: { residenceId: true } } } } } } },
  });
  return lease ? { ...lease, residenceId: lease.bed.room.roomType.residenceId } : null;
}

/** For student residence-space routes: the student, their lease and residence, or 403. */
export async function requireResidency(userId: string) {
  const student = await getStudentProfile(userId);
  const lease = await findCurrentLease(student.id);
  if (!lease) throw forbidden("You don't have a residence yet");
  return { student, lease, residenceId: lease.residenceId };
}
