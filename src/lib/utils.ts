import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
// Export theme utilities 
export * from './theme-utils';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Recursively converts Firestore Timestamp objects to ISO strings
 * to avoid serialization issues when passing to client components
 */
export function convertTimestampsToISOStrings(obj: any): any {
  if (!obj) return obj;

  if (typeof obj !== 'object') return obj;

  if (obj instanceof Date) return obj.toISOString();

  if (obj.toDate && typeof obj.toDate === 'function') {
    return obj.toDate().toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertTimestampsToISOStrings(item));
  }

  const result: any = {};

  for (const [key, value] of Object.entries(obj)) {
    result[key] = convertTimestampsToISOStrings(value);
  }

  return result;
}

/**
 * Formats a price with currency symbol
 */
export function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
}

/**
 * Maps an app language code (e.g. 'ro') to an Intl locale for date/number
 * formatting. Property-agnostic; extend the map as new languages are added.
 */
export function languageToLocale(language?: string): string {
  switch (language) {
    case 'ro':
      return 'ro-RO';
    default:
      return 'en-US';
  }
}

/**
 * Formats a date as a localized string
 */
export function formatDate(date: Date | string, options: Intl.DateTimeFormatOptions = {}): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };

  return dateObj.toLocaleDateString('en-US', { ...defaultOptions, ...options });
}
