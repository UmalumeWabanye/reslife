import type { ApplicationStatus, FundingType, ResidenceType } from '@students/shared';

export const colors = {
  primary: '#1D4ED8',
  primarySoft: '#DBEAFE',
  bg: '#F6F7F9',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
  success: '#047857',
  successSoft: '#D1FAE5',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

export const residenceTypeLabel: Record<ResidenceType, string> = {
  PRIVATE: 'Private',
  UNIVERSITY: 'University',
  COMMUNAL: 'Communal',
};

export const fundingLabel: Record<FundingType, string> = {
  NSFAS: 'NSFAS',
  BURSARY: 'Bursary',
  SELF: 'Self-funded',
  PRIVATE_SPONSOR: 'Private sponsor',
};

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const applicationStatus: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SUBMITTED: { label: 'Submitted', tone: 'info' },
  UNDER_REVIEW: { label: 'Under review', tone: 'info' },
  ACCEPTED: { label: 'Offer received', tone: 'success' },
  REJECTED: { label: 'Unsuccessful', tone: 'danger' },
  WAITLISTED: { label: 'Waitlisted', tone: 'warning' },
  ACCEPTED_BY_STUDENT: { label: 'Offer accepted', tone: 'success' },
  DECLINED_BY_STUDENT: { label: 'Offer declined', tone: 'neutral' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' },
};

export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: colors.muted, bg: '#F1F5F9' },
  info: { fg: colors.primary, bg: colors.primarySoft },
  success: { fg: colors.success, bg: colors.successSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
};

export type { Tone };

export const maintenanceStatus: Record<import('@students/shared').MaintenanceStatus, { label: string; tone: Tone }> = {
  OPEN: { label: 'Reported', tone: 'info' },
  ASSIGNED: { label: 'Assigned', tone: 'info' },
  IN_PROGRESS: { label: 'In progress', tone: 'warning' },
  RESOLVED: { label: 'Resolved', tone: 'success' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
};

export const maintenanceCategory: Record<import('@students/shared').MaintenanceCategory, string> = {
  PLUMBING: 'Plumbing',
  ELECTRICAL: 'Electrical',
  FURNITURE: 'Furniture',
  WIFI: 'Wi-Fi',
  APPLIANCE: 'Appliance',
  SECURITY: 'Security',
  CLEANING: 'Cleaning',
  OTHER: 'Other',
};

export const priorityLabel: Record<import('@students/shared').MaintenancePriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
};
