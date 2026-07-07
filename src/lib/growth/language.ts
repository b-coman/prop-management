import type { Guest, LanguageCode } from '@/types';
import { normalizeCountryCode } from '@/lib/country-utils';

/**
 * Effective message language for a guest. For this RO-first business, the
 * guest's country is a better predictor than the `language` field, which
 * defaults to 'en' for imported/phone-only guests (the exact reactivation
 * base) — so a RO/MD guest gets Romanian even when `language` was never
 * captured. An explicit 'ro' always wins. (H2)
 *
 * Pure + dependency-light so both the send path and the audience preview can
 * use one source of truth.
 */
export function resolveGuestLanguage(guest: Pick<Guest, 'language' | 'country'>): LanguageCode {
  if (guest.language === 'ro') return 'ro';
  const code = guest.country ? normalizeCountryCode(guest.country) : undefined;
  if (code === 'RO' || code === 'MD') return 'ro';
  return guest.language || 'en';
}
