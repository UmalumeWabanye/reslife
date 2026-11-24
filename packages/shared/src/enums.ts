// Mirrors the Prisma enums so clients (mobile/web) don't depend on @prisma/client.

export const Roles = ["STUDENT", "LANDLORD_OWNER", "LANDLORD_STAFF", "SUPER_ADMIN"] as const;
export type Role = (typeof Roles)[number];

export const FundingTypes = ["NSFAS", "BURSARY", "SELF", "PRIVATE_SPONSOR"] as const;
export type FundingType = (typeof FundingTypes)[number];

export const ResidenceTypes = ["PRIVATE", "UNIVERSITY", "COMMUNAL"] as const;
export type ResidenceType = (typeof ResidenceTypes)[number];

export const GenderPolicies = ["MIXED", "FEMALE_ONLY", "MALE_ONLY"] as const;
export type GenderPolicy = (typeof GenderPolicies)[number];

export const ApplicationStatuses = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "WAITLISTED",
  "ACCEPTED_BY_STUDENT",
  "DECLINED_BY_STUDENT",
  "WITHDRAWN",
] as const;
export type ApplicationStatus = (typeof ApplicationStatuses)[number];

export const DocumentKinds = ["ID_DOCUMENT", "PROOF_OF_REGISTRATION", "FUNDING_LETTER", "OTHER"] as const;
export type DocumentKind = (typeof DocumentKinds)[number];

export const LANDLORD_ROLES: readonly Role[] = ["LANDLORD_OWNER", "LANDLORD_STAFF"];

/** Funding types that pay rent through the app (others are paid by NSFAS/bursary directly). */
export const SELF_PAYING_FUNDING: readonly FundingType[] = ["SELF", "PRIVATE_SPONSOR"];

export const MaintenanceStatuses = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export type MaintenanceStatus = (typeof MaintenanceStatuses)[number];

export const MaintenancePriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type MaintenancePriority = (typeof MaintenancePriorities)[number];

export const MaintenanceCategories = ["PLUMBING", "ELECTRICAL", "FURNITURE", "WIFI", "APPLIANCE", "SECURITY", "CLEANING", "OTHER"] as const;
export type MaintenanceCategory = (typeof MaintenanceCategories)[number];

export const LeaseStatuses = ["PENDING_MOVE_IN", "ACTIVE", "ENDED", "TERMINATED"] as const;
export type LeaseStatus = (typeof LeaseStatuses)[number];

/** Allowed landlord status changes. Students can only reopen RESOLVED (not fixed) or close it (confirm). */
export const MAINTENANCE_TRANSITIONS: Record<MaintenanceStatus, readonly MaintenanceStatus[]> = {
  OPEN: ["ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"],
  ASSIGNED: ["IN_PROGRESS", "RESOLVED", "OPEN"],
  IN_PROGRESS: ["RESOLVED", "ASSIGNED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
};
