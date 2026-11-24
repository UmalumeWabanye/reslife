import type {
  ApplicationStatus,
  DocumentKind,
  FundingType,
  GenderPolicy,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  ResidenceType,
} from "@students/shared";

export const residenceTypeLabel: Record<ResidenceType, string> = {
  PRIVATE: "Private",
  UNIVERSITY: "University",
  COMMUNAL: "Communal",
};

export const genderPolicyLabel: Record<GenderPolicy, string> = {
  MIXED: "Mixed",
  FEMALE_ONLY: "Female only",
  MALE_ONLY: "Male only",
};

export const fundingLabel: Record<FundingType, string> = {
  NSFAS: "NSFAS",
  BURSARY: "Bursary",
  SELF: "Self-funded",
  PRIVATE_SPONSOR: "Private sponsor",
};

export const documentLabel: Record<DocumentKind, string> = {
  ID_DOCUMENT: "ID / passport",
  PROOF_OF_REGISTRATION: "Proof of registration",
  FUNDING_LETTER: "Funding letter",
  OTHER: "Other",
};

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const statusMeta: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SUBMITTED: { label: "New", tone: "info" },
  UNDER_REVIEW: { label: "In review", tone: "warning" },
  ACCEPTED: { label: "Offer sent", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  WAITLISTED: { label: "Waitlisted", tone: "warning" },
  ACCEPTED_BY_STUDENT: { label: "Offer accepted", tone: "success" },
  DECLINED_BY_STUDENT: { label: "Offer declined", tone: "neutral" },
  WITHDRAWN: { label: "Withdrawn", tone: "neutral" },
};

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

export const fullName = (u: { firstName: string | null; lastName: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";


export const maintenanceStatusMeta: Record<MaintenanceStatus, { label: string; tone: Tone }> = {
  OPEN: { label: "New", tone: "info" },
  ASSIGNED: { label: "Assigned", tone: "info" },
  IN_PROGRESS: { label: "In progress", tone: "warning" },
  RESOLVED: { label: "Resolved", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
};

export const priorityMeta: Record<MaintenancePriority, { label: string; tone: Tone }> = {
  LOW: { label: "Low", tone: "neutral" },
  MEDIUM: { label: "Normal", tone: "neutral" },
  HIGH: { label: "High", tone: "warning" },
  URGENT: { label: "Urgent", tone: "danger" },
};

export const maintenanceCategoryLabel: Record<MaintenanceCategory, string> = {
  PLUMBING: "Plumbing",
  ELECTRICAL: "Electrical",
  FURNITURE: "Furniture",
  WIFI: "Wi-Fi",
  APPLIANCE: "Appliance",
  SECURITY: "Security",
  CLEANING: "Cleaning",
  OTHER: "Other",
};

export const leaseStatusMeta: Record<string, { label: string; tone: Tone }> = {
  PENDING_MOVE_IN: { label: "Awaiting move-in", tone: "info" },
  ACTIVE: { label: "Living here", tone: "success" },
  ENDED: { label: "Moved out", tone: "neutral" },
  TERMINATED: { label: "Terminated", tone: "danger" },
};

export function timeAgo(iso: string, now: number) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
