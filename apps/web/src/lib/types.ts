import type {
  ApplicationStatus,
  DocumentKind,
  FundingType,
  GenderPolicy,
  ResidenceType,
  Role,
} from "@students/shared";

export interface Me {
  id: string;
  role: Role;
  email: string;
  firstName: string | null;
  lastName: string | null;
  memberships: { organisation: { id: string; name: string; status: "PENDING" | "VERIFIED" | "SUSPENDED" | "REJECTED" } }[];
}

export interface Institution {
  id: string;
  name: string;
  shortName: string;
  city: string;
}

export interface ResidenceListItem {
  id: string;
  name: string;
  slug: string;
  type: ResidenceType;
  city: string;
  addressLine: string;
  isPublished: boolean;
  nsfasAccredited: boolean;
  bursaryFunded: boolean;
  primaryColour: string;
  pendingApplications: number;
  availableBeds: number;
}

export interface Bed {
  id: string;
  label: string;
}

export interface Room {
  id: string;
  label: string;
  beds: Bed[];
}

export interface RoomType {
  id: string;
  name: string;
  occupancy: number;
  monthlyRentCents: number;
  depositCents: number;
  description: string | null;
  rooms: Room[];
}

export interface ResidenceDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: ResidenceType;
  genderPolicy: GenderPolicy;
  nsfasAccredited: boolean;
  bursaryFunded: boolean;
  addressLine: string;
  city: string;
  latitude: number;
  longitude: number;
  amenities: string[];
  photos: string[];
  logoUrl: string | null;
  primaryColour: string;
  isPublished: boolean;
  institutions: { institutionId: string; distanceKm: number | null; institution: Institution }[];
  roomTypes: RoomType[];
}

export interface BedWithOccupant {
  id: string;
  label: string;
  room: { label: string; roomType: { id: string; name: string } };
  occupant: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    student: { studentNumber: string; user: { firstName: string | null; lastName: string | null } };
  } | null;
}

export interface ApplicationListItem {
  id: string;
  status: ApplicationStatus;
  academicYear: number;
  fundingType: FundingType;
  submittedAt: string | null;
  residence: { id: string; name: string };
  roomType: { id: string; name: string };
  student: {
    studentNumber: string;
    fundingType: FundingType | null;
    yearOfStudy: number | null;
    institution: { shortName: string };
    user: { firstName: string | null; lastName: string | null; email: string; phone: string | null };
  };
  _count: { documents: number };
}

export interface ApplicationDetail {
  id: string;
  status: ApplicationStatus;
  academicYear: number;
  fundingType: FundingType;
  motivation: string | null;
  reviewNote: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  residence: { id: string; name: string };
  roomType: { id: string; name: string; monthlyRentCents: number };
  documents: { id: string; kind: DocumentKind; fileName: string; createdAt: string }[];
  lease: { startDate: string; endDate: string; status: string; bed: { label: string; room: { label: string } } } | null;
  student: {
    studentNumber: string;
    yearOfStudy: number | null;
    gender: string | null;
    institution: { name: string; shortName: string };
    user: { firstName: string | null; lastName: string | null; email: string; phone: string | null };
  };
}
