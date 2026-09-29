import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getLocalizedString } from '@/lib/multilingual-utils';
import { loggers } from '@/lib/logger';

/**
 * Facts the guest EMAILS need, read from the guest guide's own config.
 *
 * The guide at `propertyOverrides/{slug}.guestGuide` is the single source of truth for who to
 * call, where the gate is and how to drive there. Emails read it here rather than keeping their
 * own copies, so an edit to the guide can never leave an email quoting a stale phone number or
 * the wrong gate. Server-side only (Admin SDK); no `server-only` import because emailService,
 * its one consumer, does not use one either and it keeps this testable.
 */

/**
 * Who a guest should call, resolved from ONE source of truth.
 *
 * WHY THIS EXISTS. The booking confirmation template has always read
 * `property.hostInfo.{name,phone}`. No property in this system has ever carried a
 * `hostInfo` object, so both fields resolved to undefined and — because the template
 * renders them conditionally — the host name and phone simply vanished from the email.
 * Every confirmation ever sent went out with a street address and no way to reach a
 * human. Found 2026-09-29 on a real arrival, three days before check-in.
 *
 * The contact data was never missing, only unreachable: it is in
 * `propertyOverrides/{slug}.guestGuide.contacts`, already structured (name, role, phone,
 * channel) and already bilingual. That is what the guest guide renders, so reading the
 * same array here means the email and the guide can never disagree about who to call —
 * the alternative was a second copy of the phone number that drifts the first time one
 * of them is edited.
 *
 * Fallbacks exist for other properties, in decreasing order of richness:
 *   1. guestGuide.contacts[0]  — bilingual, the source of truth
 *   2. property.hostInfo       — the original contract; honoured if a property has one
 *   3. property.contactPhone   — a bare number is still infinitely better than nothing
 *
 * Never throws: a confirmation email must go out even if the lookup fails, because a
 * booking with no email is worse than a booking with an incomplete one.
 */
export interface HostContact {
  name?: string;
  role?: string;
  /** E.164, for `tel:` links. Always international so it dials from anywhere. */
  phone?: string;
  /** The same number written the way the guest's own country writes it. Display only. */
  phoneDisplay?: string;
}

/**
 * How to PRINT a phone number for someone reading in `language`.
 *
 * A Romanian reading "+40723200868" has to mentally strip the country code; they write and dial
 * it as 0723200868. Anyone abroad needs the +40. So the DISPLAY is localised and the `tel:` href
 * keeps E.164 - the link still works from a foreign SIM, the text still looks native.
 *
 * Only the reader's own country is nationalised. A German guest reading a Romanian number keeps
 * the +40, which is correct: for them it IS a foreign number.
 */
const NATIONAL_PREFIX: Record<string, { cc: string; trunk: string }> = {
  ro: { cc: '+40', trunk: '0' },
};

export function formatPhoneForDisplay(
  phone: string | undefined | null,
  language: string = 'en'
): string | undefined {
  if (!phone) return undefined;
  const trimmed = String(phone).trim();
  if (!trimmed) return undefined;
  const rule = NATIONAL_PREFIX[language];
  if (!rule || !trimmed.startsWith(rule.cc)) return trimmed;
  return rule.trunk + trimmed.slice(rule.cc.length);
}

/**
 * Derive the host contact from an already-loaded guide block. PURE, so the fallback ladder is
 * exhaustively testable without Firestore.
 */
export function deriveHostContact(
  guide: any,
  property: any,
  language: string = 'en'
): HostContact {
  const fallbackPhone = property?.hostInfo?.phone || property?.contactPhone || undefined;
  const fallback: HostContact = {
    name: property?.hostInfo?.name,
    phone: fallbackPhone,
    phoneDisplay: formatPhoneForDisplay(fallbackPhone, language),
  };

  const contacts = guide?.contacts;
  const primary = Array.isArray(contacts) ? contacts[0] : undefined;
  if (!primary?.phone) return fallback;

  return {
    name: getLocalizedString(primary.displayName, language) || fallback.name,
    role: getLocalizedString(primary.role, language) || undefined,
    phone: primary.phone,
    phoneDisplay: formatPhoneForDisplay(primary.phone, language),
  };
}

export interface ArrivalFacts {
  wazeUrl?: string;
  mapsUrl?: string;
  gateNumber?: string;
  /** The host's own words about the handover, already written bilingually in the guide. */
  callNote?: string;
}

/** Derive the arrival card from an already-loaded guide block. PURE. */
export function deriveArrivalFacts(guide: any, language: string = 'en'): ArrivalFacts {
  const arrival = guide?.arrival;
  if (!arrival) return {};
  return {
    wazeUrl: arrival.wazeUrl || undefined,
    mapsUrl: arrival.mapsUrl || undefined,
    gateNumber: arrival.gateNumber ? String(arrival.gateNumber) : undefined,
    callNote: getLocalizedString(arrival.call, language) || undefined,
  };
}

/** Everything the guest emails need from the guide, from ONE read. */
export interface GuideFacts {
  host: HostContact;
  arrival: ArrivalFacts;
}

/**
 * Read the guide block once and derive everything from it.
 *
 * The two derivations used to be separate async functions that each fetched the SAME
 * `propertyOverrides/{slug}` document, so the pre-arrival path read it twice for no reason. They
 * are pure now and this is the only reader.
 *
 * Never throws: a guest email must go out even if the lookup fails, because a booking with no
 * email is worse than a booking with an incomplete one.
 */
export async function resolveGuideFacts(
  slug: string,
  property: any,
  language: string = 'en'
): Promise<GuideFacts> {
  let guide: any;
  try {
    const db = await getAdminDb();
    const snap = db ? await db.collection('propertyOverrides').doc(slug).get() : null;
    guide = (snap?.data() as any)?.guestGuide;
  } catch (error) {
    loggers.email?.warn?.('resolveGuideFacts failed, falling back to property fields', {
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return {
    host: deriveHostContact(guide, property, language),
    arrival: deriveArrivalFacts(guide, language),
  };
}
