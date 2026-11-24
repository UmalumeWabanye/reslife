import { z } from "zod";
import {
  ApplicationStatuses,
  LeaseStatuses,
  MaintenanceCategories,
  MaintenancePriorities,
  MaintenanceStatuses,
  DocumentKinds,
  FundingTypes,
  GenderPolicies,
  ResidenceTypes,
} from "./enums.js";

// ─── Auth ───

export const studentOtpRequestSchema = z.object({
  institutionId: z.string().min(1),
  studentNumber: z.string().trim().min(3).max(32).transform((s) => s.toUpperCase()),
  email: z.string().trim().toLowerCase().email(),
});
export type StudentOtpRequest = z.infer<typeof studentOtpRequestSchema>;

export const studentOtpVerifySchema = studentOtpRequestSchema.extend({
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});
export type StudentOtpVerify = z.infer<typeof studentOtpVerifySchema>;

export const passwordLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});
export type PasswordLogin = z.infer<typeof passwordLoginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(10) });

export const landlordSignupSchema = z.object({
  organisationName: z.string().trim().min(2),
  registrationNumber: z.string().trim().optional(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().optional(),
  password: z.string().min(8),
});
export type LandlordSignup = z.infer<typeof landlordSignupSchema>;

export const studentProfileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  fundingType: z.enum(FundingTypes).optional(),
  yearOfStudy: z.number().int().min(1).max(10).optional(),
  gender: z.string().trim().optional(),
});
export type StudentProfileUpdate = z.infer<typeof studentProfileUpdateSchema>;

// ─── Residences ───

const boolish = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((v) => v === true || v === "true");

export const residenceSearchSchema = z.object({
  type: z.enum(ResidenceTypes).optional(),
  nsfasAccredited: boolish.optional(),
  bursaryFunded: boolish.optional(),
  genderPolicy: z.enum(GenderPolicies).optional(),
  maxRentCents: z.coerce.number().int().positive().optional(),
  maxDistanceKm: z.coerce.number().positive().optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type ResidenceSearch = z.infer<typeof residenceSearchSchema>;

export const roomTypeInputSchema = z.object({
  name: z.string().trim().min(1),
  occupancy: z.number().int().min(1).max(12),
  monthlyRentCents: z.number().int().positive(),
  depositCents: z.number().int().min(0).default(0),
  description: z.string().optional(),
});
export type RoomTypeInput = z.infer<typeof roomTypeInputSchema>;

export const residenceInputSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().min(10),
  type: z.enum(ResidenceTypes),
  genderPolicy: z.enum(GenderPolicies).default("MIXED"),
  nsfasAccredited: z.boolean().default(false),
  bursaryFunded: z.boolean().default(false),
  addressLine: z.string().trim().min(3),
  city: z.string().trim().min(2),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  amenities: z.array(z.string()).default([]),
  photos: z.array(z.string()).default([]),
  logoUrl: z.string().url().optional(),
  primaryColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#2563EB"),
  isPublished: z.boolean().default(false),
  institutions: z
    .array(z.object({ institutionId: z.string(), distanceKm: z.number().nonnegative().optional() }))
    .min(1, "Link at least one institution"),
});
export type ResidenceInput = z.infer<typeof residenceInputSchema>;

export const roomInputSchema = z.object({
  label: z.string().trim().min(1),
  bedLabels: z.array(z.string().trim().min(1)).min(1),
});
export type RoomInput = z.infer<typeof roomInputSchema>;

// ─── Applications ───

export const applicationCreateSchema = z.object({
  residenceId: z.string().min(1),
  roomTypeId: z.string().min(1),
  academicYear: z.number().int().min(2024).max(2100),
  fundingType: z.enum(FundingTypes),
  motivation: z.string().trim().max(2000).optional(),
});
export type ApplicationCreate = z.infer<typeof applicationCreateSchema>;

export const applicationDocumentSchema = z.object({
  kind: z.enum(DocumentKinds),
  fileKey: z.string().min(1),
  fileName: z.string().min(1),
});
export type ApplicationDocumentInput = z.infer<typeof applicationDocumentSchema>;

export const applicationDecisionSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("ACCEPT"),
    bedId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    note: z.string().optional(),
  }),
  z.object({ decision: z.literal("REJECT"), note: z.string().optional() }),
  z.object({ decision: z.literal("WAITLIST"), note: z.string().optional() }),
]);
export type ApplicationDecision = z.infer<typeof applicationDecisionSchema>;

export const applicationListQuerySchema = z.object({
  residenceId: z.string().optional(),
  status: z.enum(ApplicationStatuses).optional(),
});

// ─── Uploads ───

export const uploadRequestSchema = z.object({
  purpose: z.enum(["application-document", "residence-photo", "maintenance-photo"]),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});
export type UploadRequest = z.infer<typeof uploadRequestSchema>;

// ─── Announcements ───

export const announcementInputSchema = z.object({
  residenceId: z.string().min(1),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(1).max(5000),
  pinned: z.boolean().default(false),
  /** Also email every current resident. */
  sendEmail: z.boolean().default(false),
});
export type AnnouncementInput = z.infer<typeof announcementInputSchema>;

export const announcementUpdateSchema = announcementInputSchema.pick({ title: true, body: true, pinned: true }).partial();

// ─── Maintenance ───

export const maintenanceCreateSchema = z.object({
  category: z.enum(MaintenanceCategories),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(5).max(3000),
  location: z.string().trim().max(120).optional(),
  priority: z.enum(MaintenancePriorities).default("MEDIUM"),
  photoKeys: z.array(z.string().min(1)).max(5).default([]),
});
export type MaintenanceCreate = z.infer<typeof maintenanceCreateSchema>;

export const maintenanceUpdateSchema = z
  .object({
    status: z.enum(MaintenanceStatuses),
    priority: z.enum(MaintenancePriorities),
    /** null unassigns. */
    assigneeId: z.string().min(1).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type MaintenanceUpdate = z.infer<typeof maintenanceUpdateSchema>;

export const maintenanceCommentSchema = z.object({ body: z.string().trim().min(1).max(2000) });

export const maintenanceListQuerySchema = z.object({
  residenceId: z.string().optional(),
  status: z.enum(MaintenanceStatuses).optional(),
  priority: z.enum(MaintenancePriorities).optional(),
  /** "open" = everything not RESOLVED/CLOSED. */
  view: z.enum(["open", "all"]).default("open"),
});

// ─── Leases ───

export const leaseListQuerySchema = z.object({
  residenceId: z.string().optional(),
  status: z.enum(LeaseStatuses).optional(),
});

export const leaseEndSchema = z.object({
  reason: z.enum(["ENDED", "TERMINATED"]).default("ENDED"),
  note: z.string().trim().max(500).optional(),
});
