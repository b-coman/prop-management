// Guest guide data fetcher. One page, two tiers:
//
//   'guest'  — a valid HMAC token for a real booking. Adds the personal greeting,
//              the stay dates, wifi, contacts, and every section marked tier:'guest'.
//   'public' — no token (or an invalid/expired one). Only tier:'public' sections,
//              plus a book-direct CTA. Nothing operational is ever rendered.
//
// Auth is the URL token alone — no user session. The token is derived, not stored
// (see src/lib/guide-token.ts), so the only revocation lever is the stay window:
// the link stops working GUIDE_GRACE_DAYS after checkout.

import 'server-only';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getLocalizedString } from '@/lib/multilingual-utils';
import { guideIdentity, validateGuideToken } from '@/lib/guide-token';
import { loggers } from '@/lib/logger';
import type { LanguageCode, MultilingualString } from '@/types';

/** How long after checkout the personalised link keeps working. */
export const GUIDE_GRACE_DAYS = 14;

export type GuideTier = 'guest' | 'public';

/** How a guest can reach this contact. Drives which deep link the button builds. */
export type ContactChannel = 'whatsapp' | 'sms' | 'call';

export interface GuideContact {
  displayName: MultilingualString | string;
  role: MultilingualString | string;
  phone: string;
  channel?: ContactChannel;
  /** Languages this person actually speaks. Empty/missing = assume the guest's. */
  speaks?: string[];
  /** Ready-made message, keyed by the language the *contact* reads. */
  prefill?: MultilingualString;
}

export interface GuideRoute {
  name: MultilingualString | string;
  kind: 'walk' | 'hike' | 'bike' | 'car';
  km: number;
  mapUrl?: string;
}

/**
 * Which band a section sits in. Bands are collapsed accordions except 'intro',
 * which renders open — it is the opening paragraph of the public page, and is
 * skipped for guests, whose header already greets them by name.
 */
export type GuideGroup = 'intro' | 'house' | 'around' | 'place';

export interface GuideSection {
  id: string;
  title: MultilingualString | string;
  body: MultilingualString | string;
  tier?: GuideTier;
  group?: GuideGroup;
  /** Optional photo. Earns its place where it helps a decision (the host, an
   *  attraction), not where the guest is already standing. */
  image?: { url: string; alt?: MultilingualString | string };
}

/**
 * Everything a guest needs on the road and at the gate. Rendered first until the
 * day after check-in, then demoted below the WiFi - by then they are inside and
 * arrival is history.
 */
export interface GuideArrival {
  wazeUrl?: string;
  mapsUrl?: string;
  /** The number on the gate, so a driver knows they have the right one. */
  gateNumber?: string;
  call?: MultilingualString | string;
  access?: MultilingualString | string;
  /** Guest tier only, and never stored in the repo. */
  lockboxCode?: string;
}

export interface GuestGuideConfig {
  enabled?: boolean;
  wifi?: { network?: string; password?: string };
  contacts?: GuideContact[];
  arrival?: GuideArrival;
  mapUrl?: string;
  routes?: GuideRoute[];
  sections?: GuideSection[];
  pdf?: { url?: string; sizeBytes?: number };
}

/** A contact resolved for one specific guest, ready to render. */
export interface ResolvedContact {
  name: string;
  role: string;
  phone: string;
  /** Tel/WhatsApp/SMS href, already built with any prefilled body. */
  href: string;
  channel: ContactChannel;
  /** True when this person does not speak the guest's language. */
  needsTranslation: boolean;
  /** The language the prefilled message is written in, so the note can name it. */
  prefillLanguage?: string;
  /** The message the button sends, shown to the guest so they know what they said. */
  prefillText?: string;
}

export interface GuideData {
  tier: GuideTier;
  language: LanguageCode;
  propertyName: string;
  propertySlug: string;
  /** Guest tier only. */
  guestFirstName?: string;
  checkIn?: string;
  checkOut?: string;
  checkInTime?: string;
  checkOutTime?: string;
  wifi?: { network: string; password: string };
  /** Guest tier only. Absent once the stay is under way. */
  arrival?: {
    wazeUrl?: string;
    mapsUrl?: string;
    gateNumber?: string;
    call?: string;
    access?: string;
    lockboxCode?: string;
  };
  /** True until the day after check-in: arrival still leads the page. */
  arrivalLeads: boolean;
  /** True once they are in the house: the header switches to past tense. */
  stayStarted: boolean;
  /** True from midday before checkout: the departure checklist leads instead. */
  departing: boolean;
  contacts: ResolvedContact[];
  mapUrl?: string;
  routes: Array<{ name: string; kind: GuideRoute['kind']; km: number; mapUrl?: string }>;
  sections: Array<{
    id: string;
    title: string;
    body: string;
    group: GuideGroup;
    image?: { url: string; alt?: string };
  }>;
  pdf?: { url: string; sizeBytes?: number };
}

function parseFirestoreDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'object' && raw !== null && '_seconds' in raw) {
    return new Date((raw as { _seconds: number })._seconds * 1000);
  }
  if (typeof raw === 'object' && raw !== null && 'toDate' in raw) {
    try {
      return (raw as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  if (typeof raw === 'string') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatStayDate(date: Date, language: LanguageCode): string {
  return date.toLocaleDateString(language === 'ro' ? 'ro-RO' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Build the tap target for a contact. WhatsApp and SMS can both carry a prefilled
 * body; a plain call cannot, so the caller shows the text for the guest to read out.
 */
function buildContactHref(phone: string, channel: ContactChannel, message?: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (channel === 'whatsapp') {
    const bare = digits.replace(/^\+/, '');
    return message
      ? `https://wa.me/${bare}?text=${encodeURIComponent(message)}`
      : `https://wa.me/${bare}`;
  }
  if (channel === 'sms') {
    // RFC 5724 says `?body=`; iOS historically wanted `&body=`. `?` is the
    // portable choice on current iOS and Android.
    return message ? `sms:${digits}?body=${encodeURIComponent(message)}` : `sms:${digits}`;
  }
  return `tel:${digits}`;
}

function resolveContacts(contacts: GuideContact[], language: LanguageCode): ResolvedContact[] {
  return contacts
    .filter((c) => c?.phone)
    .map((c) => {
      const speaks = Array.isArray(c.speaks) && c.speaks.length > 0 ? c.speaks : [language];
      const needsTranslation = !speaks.includes(language);
      const channel: ContactChannel = c.channel ?? 'whatsapp';

      // Only prefill when there's a language gap — a guest who shares a language
      // with the contact writes their own message.
      const prefillText = needsTranslation
        ? getLocalizedString(c.prefill, speaks[0], '') || undefined
        : undefined;

      return {
        name: getLocalizedString(c.displayName, language, ''),
        role: getLocalizedString(c.role, language, ''),
        phone: c.phone,
        channel,
        href: buildContactHref(c.phone, channel, prefillText),
        needsTranslation,
        prefillLanguage: needsTranslation ? speaks[0] : undefined,
        prefillText,
      };
    });
}

/**
 * Load the guide for a booking. `token` may be absent — that yields the public
 * tier rather than an error, so the same route serves both audiences.
 */
export async function fetchGuide(bookingId: string, token?: string): Promise<GuideData | null> {
  const db = await getAdminDb();

  const bookingSnap = await db.collection('bookings').doc(bookingId).get();
  if (!bookingSnap.exists) return null;
  const booking = bookingSnap.data()!;

  const propertySlug: string = booking.propertyId;
  if (!propertySlug) return null;

  const language: LanguageCode = booking.language === 'ro' ? 'ro' : 'en';

  // ---- decide the tier -------------------------------------------------
  let tier: GuideTier = 'public';
  const identity = guideIdentity(booking.guestInfo);
  const checkOutDate = parseFirestoreDate(booking.checkOutDate);

  if (token) {
    const statusOk = booking.status === 'confirmed' || booking.status === 'completed';
    const expiresAt = checkOutDate
      ? new Date(checkOutDate.getTime() + GUIDE_GRACE_DAYS * 24 * 60 * 60 * 1000)
      : null;
    const withinWindow = !expiresAt || expiresAt > new Date();

    if (statusOk && withinWindow && validateGuideToken(bookingId, identity, token)) {
      tier = 'guest';
    } else {
      loggers.guest.info('Guide link rejected, falling back to public tier', {
        bookingId,
        statusOk,
        withinWindow,
      });
    }
  }

  // ---- content ---------------------------------------------------------
  const [propertySnap, overridesSnap] = await Promise.all([
    db.collection('properties').doc(propertySlug).get(),
    db.collection('propertyOverrides').doc(propertySlug).get(),
  ]);

  const property = propertySnap.data() ?? {};
  const guide: GuestGuideConfig = overridesSnap.data()?.guestGuide ?? {};
  if (guide.enabled === false) return null;

  const propertyName = getLocalizedString(property.name, language, propertySlug);

  const sections = (guide.sections ?? [])
    .filter((s) => {
      if (!s) return false;
      // A guest sees everything except the public page's opening paragraph —
      // the header has already welcomed them by name.
      if (tier === 'guest') return s.group !== 'intro';
      return (s.tier ?? 'guest') === 'public';
    })
    .map((s) => ({
      id: s.id,
      title: getLocalizedString(s.title, language, ''),
      body: getLocalizedString(s.body, language, ''),
      group: s.group ?? 'place',
      image: s.image?.url
        ? { url: s.image.url, alt: getLocalizedString(s.image.alt, language, '') }
        : undefined,
    }))
    .filter((s) => s.title || s.body);

  const routes = (guide.routes ?? []).map((r) => ({
    name: getLocalizedString(r.name, language, ''),
    kind: r.kind,
    km: r.km,
    mapUrl: r.mapUrl,
  }));

  const data: GuideData = {
    tier,
    language,
    propertyName,
    propertySlug,
    arrivalLeads: false,
    stayStarted: false,
    departing: false,
    contacts: tier === 'guest' ? resolveContacts(guide.contacts ?? [], language) : [],
    mapUrl: guide.mapUrl,
    routes,
    sections,
    pdf: guide.pdf?.url ? { url: guide.pdf.url, sizeBytes: guide.pdf.sizeBytes } : undefined,
  };

  if (tier === 'guest') {
    const checkInDate = parseFirestoreDate(booking.checkInDate);
    data.guestFirstName = (booking.guestInfo?.firstName ?? '').trim() || undefined;
    data.checkIn = checkInDate ? formatStayDate(checkInDate, language) : undefined;
    data.checkOut = checkOutDate ? formatStayDate(checkOutDate, language) : undefined;
    data.checkInTime = property.checkInTime;
    data.checkOutTime = property.checkOutTime;
    if (guide.wifi?.network && guide.wifi?.password) {
      data.wifi = { network: guide.wifi.network, password: guide.wifi.password };
    }

    if (guide.arrival) {
      data.arrival = {
        wazeUrl: guide.arrival.wazeUrl,
        mapsUrl: guide.arrival.mapsUrl,
        gateNumber: guide.arrival.gateNumber,
            call: getLocalizedString(guide.arrival.call, language, '') || undefined,
        access: getLocalizedString(guide.arrival.access, language, '') || undefined,
        lockboxCode: guide.arrival.lockboxCode,
      };

      // Arrival leads the page until the end of the arrival day. A whole day of
      // slack means the exact hour, and the guest's timezone, never matter.
      if (checkInDate) {
        const demoteAfter = new Date(checkInDate.getTime() + 36 * 60 * 60 * 1000);
        data.arrivalLeads = new Date() < demoteAfter;
      }
    }

    // The stay has three acts and the page should know which one it is in.
    const now = new Date();
    if (checkInDate) data.stayStarted = now >= checkInDate;
    if (checkOutDate) {
      // checkOutDate carries the real checkout time (11:00 local here), so the
      // window opens the evening before and closes once they have gone - a
      // checklist is no use to someone who left yesterday.
      const opens = checkOutDate.getTime() - 18 * 60 * 60 * 1000;
      const closes = checkOutDate.getTime() + 12 * 60 * 60 * 1000;
      data.departing = now.getTime() >= opens && now.getTime() < closes;
    }
  }

  return data;
}
