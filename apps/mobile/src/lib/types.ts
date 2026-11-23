import type { ApplicationStatus, DocumentKind, FundingType, GenderPolicy, ResidenceType, Role } from '@students/shared';

// Response shapes of the API endpoints the app uses.

export interface Me {
  id: string;
  role: Role;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  studentProfile: {
    studentNumber: string;
    fundingType: FundingType | null;
    yearOfStudy: number | null;
    institution: { id: string; name: string; shortName: string };
  } | null;
}

export interface Institution {
  id: string;
  name: string;
  shortName: string;
  city: string;
  emailDomains: string[];
}

export type Residency =
  | { mode: 'discover' }
  | {
      mode: 'residence';
      residence: {
        id: string;
        name: string;
        slug: string;
        logoUrl: string | null;
        primaryColour: string;
        addressLine: string;
        city: string;
        organisation: { name: string; contactEmail: string; contactPhone: string | null };
      };
      lease: {
        id: string;
        status: 'PENDING_MOVE_IN' | 'ACTIVE';
        startDate: string;
        endDate: string;
        monthlyRentCents: number;
        fundedBy: FundingType;
        room: string;
        bed: string;
        roomType: string;
      };
    };

export interface ResidenceSummary {
  id: string;
  slug: string;
  name: string;
  type: ResidenceType;
  genderPolicy: GenderPolicy;
  nsfasAccredited: boolean;
  bursaryFunded: boolean;
  city: string;
  addressLine: string;
  photo: string | null;
  primaryColour: string;
  amenities: string[];
  distanceKm: number | null;
  fromRentCents: number | null;
  availableBeds: number;
}

export interface Paged<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface RoomType {
  id: string;
  name: string;
  occupancy: number;
  monthlyRentCents: number;
  depositCents: number;
  description: string | null;
  availableBeds: number;
}

export interface ResidenceDetail extends Omit<ResidenceSummary, 'photo' | 'distanceKm' | 'fromRentCents' | 'availableBeds'> {
  description: string;
  photos: string[];
  organisation: { name: string; contactEmail: string; contactPhone: string | null };
  roomTypes: RoomType[];
  institutions: { distanceKm: number | null; institution: { id: string; shortName: string } }[];
}

export interface ApplicationDocument {
  id: string;
  kind: DocumentKind;
  fileName: string;
}

export interface Application {
  id: string;
  status: ApplicationStatus;
  academicYear: number;
  fundingType: FundingType;
  motivation: string | null;
  reviewNote: string | null;
  submittedAt: string | null;
  updatedAt: string;
  residence: { id: string; name: string; slug: string; photos: string[]; primaryColour: string };
  roomType: { id: string; name: string; monthlyRentCents: number };
  documents: ApplicationDocument[];
  lease?: { startDate: string; endDate: string; bed: { label: string; room: { label: string } } } | null;
}
