import type { ApplicationStatus, DocumentKind, FundingType, GenderPolicy, ResidenceType } from "@students/shared";

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
