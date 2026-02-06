// src/lib/admin/status-utils.ts
// Centralized status configuration for admin panel

import {
  Clock,
  CheckCircle,
  PauseCircle,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Inbox,
  Reply,
  ArrowRight,
  Archive,
  FileEdit,
  type LucideIcon,
} from 'lucide-react';

export type StatusType =
  // Booking statuses
  | 'pending'
  | 'confirmed'
  | 'on-hold'
  | 'cancelled'
  | 'completed'
  | 'payment_failed'
  // Inquiry statuses
  | 'new'
  | 'responded'
  | 'converted'
  | 'closed'
  // Property statuses
  | 'active'
  | 'inactive'
  | 'draft'
  // Coupon statuses
  | 'expired'
  // Review statuses
  | 'published'
  | 'unpublished';

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: LucideIcon;
}

export const STATUS_CONFIGS: Record<string, StatusConfig> = {
  // Booking statuses
  pending: {
    label: 'Pending',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    borderColor: 'border-gray-300',
    icon: Clock,
  },
  confirmed: {
    label: 'Confirmed',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-300',
    icon: CheckCircle,
  },
  'on-hold': {
    label: 'On Hold',
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-300',
    icon: PauseCircle,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    borderColor: 'border-red-300',
    icon: XCircle,
  },
  completed: {
    label: 'Completed',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-300',
    icon: CheckCircle2,
  },
  payment_failed: {
    label: 'Payment Failed',
    color: 'red',
    bgColor: 'bg-red-200',
    textColor: 'text-red-900',
    borderColor: 'border-red-400',
    icon: AlertCircle,
  },

  // Inquiry statuses
  new: {
    label: 'New',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-300',
    icon: Inbox,
  },
  responded: {
    label: 'Responded',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-300',
    icon: Reply,
  },
  converted: {
    label: 'Converted',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-300',
    icon: ArrowRight,
  },
  closed: {
    label: 'Closed',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    borderColor: 'border-gray-300',
    icon: Archive,
  },

  // Property statuses
  active: {
    label: 'Active',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-300',
    icon: CheckCircle,
  },
  inactive: {
    label: 'Inactive',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-300',
    icon: PauseCircle,
  },
  draft: {
    label: 'Draft',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    borderColor: 'border-gray-300',
    icon: FileEdit,
  },

  // Coupon statuses
  expired: {
    label: 'Expired',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    borderColor: 'border-red-300',
    icon: XCircle,
  },

  // Review statuses
  published: {
    label: 'Published',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-300',
    icon: CheckCircle,
  },
  unpublished: {
    label: 'Unpublished',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-300',
    icon: PauseCircle,
  },
};

// Default config for unknown statuses
const DEFAULT_CONFIG: StatusConfig = {
  label: 'Unknown',
  color: 'gray',
  bgColor: 'bg-gray-100',
  textColor: 'text-gray-800',
  borderColor: 'border-gray-300',
  icon: Clock,
};

/**
 * Get status configuration for a given status string
 */
export function getStatusConfig(status: string | undefined | null): StatusConfig {
  if (!status) return DEFAULT_CONFIG;
  return STATUS_CONFIGS[status.toLowerCase()] ?? {
    ...DEFAULT_CONFIG,
    label: status.charAt(0).toUpperCase() + status.slice(1),
  };
}

/**
 * Get combined CSS classes for a status badge
 */
export function getStatusClasses(status: string | undefined | null): string {
  const config = getStatusConfig(status);
  return `${config.bgColor} ${config.textColor} ${config.borderColor}`;
}
