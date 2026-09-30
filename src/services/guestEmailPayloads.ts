/**
 * Pure payload assembly for the guest emails.
 *
 * WHY IT IS A SEPARATE FILE. `emailService.ts` carries `'use server'`, and a Next server-actions
 * module may only export ASYNC functions — a synchronous export there builds cleanly and then
 * fails at runtime with a silent 500. These builders are deliberately synchronous and pure, so
 * they live outside that constraint.
 *
 * WHY THEY EXIST AT ALL. Each send function used to assemble its own ~20-field payload, and
 * `scripts/preview-guest-emails.ts` assembled a third copy so the owner could review copy before
 * sending. Three hand-written copies of the same derivation with nothing keeping them in step.
 * It drifted three times in one evening — the guide token secret, the clock format, the phone
 * display — and every time the PREVIEW silently showed something no guest would ever receive.
 * That is the worst direction for the drift to go: the preview exists to be trusted. It was also
 * already missing `extraGuestFee` and `specialRequests`, which no booking had yet triggered.
 *
 * Pure means no I/O, so the assembly is finally unit-testable without Firestore or Resend.
 */
import { format } from 'date-fns';
import { formatBucharestDateTime, formatClockTime } from '@/lib/dates/property-times';
import type { Booking, Property, LanguageCode } from '@/types';
import type { EmailBrand } from '@/services/emailTemplates';
import type { GuideFacts } from '@/lib/guide-facts';
import type { BookingEmailData, PreArrivalEmailData, ReviewRequestEmailData } from '@/services/emailTemplates';

export function formatDate(date: any, language: LanguageCode = 'en'): string {
  if (!date) return 'N/A';
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    // A Romanian email was rendering "September 3rd, 2026". date-fns defaults to
    // en-US unless handed a locale, so pass one for any non-English email.
    const locale = language === 'ro' ? require('date-fns/locale/ro').ro : undefined;
    return formatBucharestDateTime(dateObj, 'PPP', locale);
  } catch (e) {
    return 'Invalid date';
  }
}

// Format currency for display
/**
 * Same as formatDate but with the weekday, and capitalised — it opens a sentence.
 * Romanian lowercases weekdays mid-sentence, so the capital is applied here rather than stored.
 */
export function formatDateWithWeekday(date: any, language: LanguageCode = 'en'): string {
  if (!date) return 'N/A';
  try {
    const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
    const locale = language === 'ro' ? require('date-fns/locale/ro').ro : undefined;
    const out = formatBucharestDateTime(d, 'EEEE, d MMMM yyyy', locale);
    return out.charAt(0).toUpperCase() + out.slice(1);
  } catch {
    return formatDate(date, language);
  }
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);
}

// Helper to get booking by ID (avoids circular dependencies)
async function getBookingById(bookingId: string): Promise<Booking | null> {
  try {
    const { getBookingById: fetchBooking } = await import('./bookingService');
    return await fetchBooking(bookingId);
  } catch (error) {
    console.error(`[EmailService] Error importing getBookingById: ${error}`);
    return null;
  }
}

// Helper to get property name
export function getPropertyName(property: Property | null, fallback: string): string {
  if (!property?.name) return fallback;
  return typeof property.name === 'string'
    ? property.name
    : (property.name as any)?.en || fallback;
}

/** Everything the guest emails need about one booking, loaded ONCE by loadGuestEmailContext. */
export interface GuestEmailContext {
  booking: any;
  property: any;
  propertyName: string;
  language: LanguageCode;
  brand: EmailBrand;
  guide: GuideFacts;
  guideUrl?: string;
  recipientEmail?: string;
}

/**
 * One-line postal address from a property's `location`.
 *
 * Shared on purpose: the confirmation prints the address in its body AND every footer prints it,
 * and they were two separate derivations that already disagreed - the body dropped the postcode.
 * Two spellings of the same address in one email.
 */
export function formatPostalAddress(location: any): string | undefined {
  if (!location) return undefined;
  const clean = (x: any) => String(x ?? '').trim();
  const parts = [
    clean(location.address),
    [clean(location.city), clean(location.zipCode)].filter(Boolean).join(' '),
    clean(location.state),
    clean(location.country),
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

/**
 * The confirmation payload. PURE - no I/O, so the preview and the send path cannot disagree, and
 * the assembly is unit-testable without Firestore or Resend.
 */
export function buildConfirmationPayload(ctx: GuestEmailContext): BookingEmailData {
  const { booking, property, language, guide } = ctx;
  return {
    guestName: `${booking.guestInfo.firstName} ${booking.guestInfo.lastName || ''}`.trim(),
    bookingId: booking.id,
    propertyName: ctx.propertyName,
    brand: ctx.brand,
    checkInDate: formatDate(booking.checkInDate, language),
    checkOutDate: formatDate(booking.checkOutDate, language),
    checkInTime: formatClockTime(property?.checkInTime, language),
    checkOutTime: formatClockTime(property?.checkOutTime, language),
    numberOfGuests: booking.numberOfGuests,
    numberOfAdults: booking.numberOfAdults,
    numberOfChildren: booking.numberOfChildren,
    numberOfNights: booking.pricing.numberOfNights,
    baseAmount: formatCurrency(booking.pricing.baseRate * booking.pricing.numberOfNights, booking.pricing.currency),
    cleaningFee: formatCurrency(booking.pricing.cleaningFee, booking.pricing.currency),
    extraGuestFee: booking.pricing.extraGuestFee
      ? formatCurrency(booking.pricing.extraGuestFee, booking.pricing.currency)
      : undefined,
    totalAmount: formatCurrency(booking.pricing.total, booking.pricing.currency),
    currency: booking.pricing.currency,
    // Stored bilingually ({en, ro}); taking .en unconditionally used to put an English policy in
    // a Romanian confirmation.
    cancellationPolicy: typeof property?.cancellationPolicy === 'string'
      ? property.cancellationPolicy
      : (property?.cancellationPolicy?.[language] ?? property?.cancellationPolicy?.en),
    propertyAddress: formatPostalAddress(property?.location),
    hostName: guide.host.name,
    hostPhone: guide.host.phoneDisplay || guide.host.phone,
    specialRequests: booking.specialRequests,
    guideUrl: ctx.guideUrl,
    isPaid: booking.paymentInfo?.status === 'succeeded' || booking.paymentInfo?.status === 'paid',
    paidOnDate: booking.paymentInfo?.paidAt ? formatDate(booking.paymentInfo.paidAt, language) : undefined,
  };
}

/** The pre-arrival payload. PURE, same reasoning as above. */
/** Midnight-to-midnight in the property's timezone, so "tomorrow" means the calendar day, not 24h. */
function isCheckInTomorrow(checkIn: any, now = new Date()): boolean {
  const d = checkIn?.toDate ? checkIn.toDate() : new Date(checkIn);
  if (Number.isNaN(d.getTime())) return false;
  const day = (x: Date) => formatBucharestDateTime(x, 'yyyy-MM-dd');
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return day(d) === day(tomorrow);
}

export function buildPreArrivalPayload(ctx: GuestEmailContext): PreArrivalEmailData {
  const { booking, property, language, guide } = ctx;
  return {
    guestName: `${booking.guestInfo.firstName} ${booking.guestInfo.lastName || ''}`.trim(),
    propertyName: ctx.propertyName,
    brand: ctx.brand,
    // Leads the sentence now ("Vineri, 2 octombrie 2026 este data check-in-ului..."), so it
    // carries the weekday and takes a capital.
    checkInDate: formatDateWithWeekday(booking.checkInDate, language),
    checkInTime: formatClockTime(property?.checkInTime, language),
    isTomorrow: isCheckInTomorrow(booking.checkInDate),
    guideUrl: ctx.guideUrl,
    wazeUrl: guide.arrival.wazeUrl,
    mapsUrl: guide.arrival.mapsUrl,
    gateNumber: guide.arrival.gateNumber,
    accessNote: guide.arrival.access,
    hostName: guide.host.name,
    hostPhone: guide.host.phoneDisplay || guide.host.phone,
    hostPhoneHref: guide.host.phone,
  };
}


/**
 * The review request. First name only - this email opens "Salut Liviu" - and the property's own
 * town, so a Bucharest guest is never asked how they liked Comarnic.
 *
 * `reviewUrl` and `unsubscribeUrl` are passed in rather than derived: both need secrets, and this
 * file is pure.
 */
export function buildReviewRequestPayload(
  ctx: GuestEmailContext,
  reviewUrl: string,
  unsubscribeUrl?: string
): ReviewRequestEmailData {
  return {
    guestName: (ctx.booking.guestInfo?.firstName || '').trim(),
    propertyName: ctx.propertyName,
    city: (ctx.property as any)?.location?.city?.trim() || ctx.propertyName,
    brand: ctx.brand,
    reviewUrl,
    unsubscribeUrl,
  };
}
