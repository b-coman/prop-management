/**
 * guestLifecycleService — channel-aware reactivation for guests the email
 * lifecycle CANNOT reach (phone-only / imported). Routes the Day-90 seasonal
 * touch through the Execution Gateway (dry-run by default).
 *
 * Called by the guest-lifecycle cron ONLY when the Growth Engine is enabled, so
 * the existing email lifecycle is completely unaffected when the flag is off.
 * See plans/growth-engine.md §6.1/§8.
 *
 * NOTE: time-based triggers only reach guests whose checkout falls in the
 * window, i.e. recent phone-only bookings going forward — NOT the historical
 * imported base, which is reactivated via campaigns (campaignService).
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { executeSend } from '@/services/executionGateway';
import { findGuestByPhone } from '@/services/guestService';
import { parseFirestoreDate } from '@/lib/growth/date-utils';

const logger = loggers.campaign;
const DAY_MS = 1000 * 60 * 60 * 24;

export interface ReactivationStats {
  attempted: number;
  dryRun: number;
  sent: number;
  suppressed: number;
  skipped: number;
  failed: number;
}

export async function runChannelAwareReactivation(now: Date = new Date()): Promise<ReactivationStats> {
  const db = await getAdminDb();
  const stats: ReactivationStats = { attempted: 0, dryRun: 0, sent: 0, suppressed: 0, skipped: 0, failed: 0 };

  const snapshot = await db.collection('bookings').where('status', '==', 'completed').get();

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      // Only guests the email loop can't reach: imported OR without an email.
      const hasEmail = !!data.guestInfo?.email;
      if (hasEmail && !data.imported) continue;

      const phone = data.guestInfo?.phone;
      if (!phone) continue; // not reachable by WhatsApp either

      const checkOut = parseFirestoreDate(data.checkOutDate);
      if (!checkOut) continue;
      const days = (now.getTime() - checkOut.getTime()) / DAY_MS;

      // Day-90 seasonal reactivation window, once per booking.
      if (days < 89.5 || days > 91.5 || data.seasonalReactivationSentAt) continue;

      const guest = await findGuestByPhone(phone);
      if (!guest) {
        stats.skipped++;
        continue;
      }

      // Skip guests who already re-booked since this stay (mirror the email
      // path's re-booking check) — don't nudge someone who's already coming back.
      const lastBooking = parseFirestoreDate(guest.lastBookingDate);
      if (lastBooking && lastBooking > checkOut) {
        stats.skipped++;
        continue;
      }

      stats.attempted++;

      const result = await executeSend({
        guestId: guest.id,
        channel: 'whatsapp',
        templateName: 'seasonal_availability',
        variables: { '1': guest.firstName || '' },
      });

      switch (result.status) {
        case 'sent':
        case 'delivered':
          stats.sent++;
          break;
        case 'dry-run':
          stats.dryRun++;
          break;
        case 'suppressed':
          stats.suppressed++;
          break;
        case 'skipped':
          stats.skipped++;
          break;
        case 'failed':
          stats.failed++;
          break;
      }

      // Mark handled ONLY on a real send — dry-runs must never record a false
      // touch, or going live would skip guests that were never actually messaged.
      if (result.status === 'sent' || result.status === 'delivered') {
        await doc.ref.update({ seasonalReactivationSentAt: FieldValue.serverTimestamp() });
      }
    } catch (error) {
      // Per-iteration guard: one bad booking must not abort the whole batch.
      logger.error('Reactivation iteration failed', error as Error, { bookingId: doc.id });
      stats.failed++;
    }
  }

  logger.info('Channel-aware reactivation done', stats);
  return stats;
}
