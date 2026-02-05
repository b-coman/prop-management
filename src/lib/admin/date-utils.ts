// src/lib/admin/date-utils.ts
// Centralized date utilities for admin panel

import { parseISO, format, formatDistanceToNow, isValid, isPast, startOfDay } from 'date-fns';
import type { SerializableTimestamp } from '@/types';

/**
 * Parse any timestamp format to a Date object
 * Handles: Date, Firestore Timestamp, ISO string, Unix timestamp, Admin SDK timestamp
 */
export function parseTimestamp(value: SerializableTimestamp | null | undefined): Date | null {
  if (!value) return null;

  // Already a Date
  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }

  // Firestore Timestamp with toDate() method
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    try {
      const date = value.toDate();
      return isValid(date) ? date : null;
    } catch {
      return null;
    }
  }

  // Admin SDK Timestamp-like object with _seconds
  if (typeof value === 'object' && '_seconds' in value) {
    try {
      const date = new Date((value as { _seconds: number })._seconds * 1000);
      return isValid(date) ? date : null;
    } catch {
      return null;
    }
  }

  // Firestore Timestamp-like object with seconds/nanoseconds
  if (typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
    try {
      const date = new Date(
        (value as { seconds: number; nanoseconds: number }).seconds * 1000 +
        (value as { seconds: number; nanoseconds: number }).nanoseconds / 1000000
      );
      return isValid(date) ? date : null;
    } catch {
      return null;
    }
  }

  // ISO string
  if (typeof value === 'string') {
    try {
      const date = parseISO(value);
      return isValid(date) ? date : null;
    } catch {
      return null;
    }
  }

  // Unix timestamp (milliseconds)
  if (typeof value === 'number') {
    try {
      const date = new Date(value);
      return isValid(date) ? date : null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Format a date with a specific format string
 * Default: "MMM d, yyyy" (e.g., "Jan 1, 2024")
 */
export function formatDate(
  value: SerializableTimestamp | null | undefined,
  formatStr: string = 'MMM d, yyyy'
): string {
  const date = parseTimestamp(value);
  if (!date) return '-';
  return format(date, formatStr);
}

/**
 * Format a date with time
 * Default: "MMM d, yyyy h:mm a" (e.g., "Jan 1, 2024 3:30 PM")
 */
export function formatDateTime(
  value: SerializableTimestamp | null | undefined,
  formatStr: string = 'MMM d, yyyy h:mm a'
): string {
  const date = parseTimestamp(value);
  if (!date) return '-';
  return format(date, formatStr);
}

/**
 * Format a date as relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(
  value: SerializableTimestamp | null | undefined,
  options: { addSuffix?: boolean } = { addSuffix: true }
): string {
  const date = parseTimestamp(value);
  if (!date) return '-';
  return formatDistanceToNow(date, options);
}

/**
 * Check if a date is expired (in the past)
 */
export function isExpired(value: SerializableTimestamp | null | undefined): boolean {
  const date = parseTimestamp(value);
  if (!date) return false;
  // Compare against start of today for date-only comparisons
  return date < startOfDay(new Date());
}

/**
 * Check if a date is in the past (more precise, includes time)
 */
export function isInPast(value: SerializableTimestamp | null | undefined): boolean {
  const date = parseTimestamp(value);
  if (!date) return false;
  return isPast(date);
}

/**
 * Format a date range
 */
export function formatDateRange(
  start: SerializableTimestamp | null | undefined,
  end: SerializableTimestamp | null | undefined,
  formatStr: string = 'MMM d, yyyy'
): string {
  const startDate = parseTimestamp(start);
  const endDate = parseTimestamp(end);

  if (!startDate && !endDate) return '-';
  if (!startDate) return `Until ${format(endDate!, formatStr)}`;
  if (!endDate) return `From ${format(startDate, formatStr)}`;

  return `${format(startDate, formatStr)} - ${format(endDate, formatStr)}`;
}

/**
 * Convert a timestamp to ISO string for serialization
 */
export function toISOString(value: SerializableTimestamp | null | undefined): string | null {
  const date = parseTimestamp(value);
  if (!date) return null;
  return date.toISOString();
}
