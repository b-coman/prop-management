/**
 * @fileoverview Cron endpoint to check for expiring price calendars and send alerts.
 *
 * Checks all properties whose price calendars are running out, and emails the owner and admin.
 *
 * The warning has to arrive with enough lead to be useful, and 14 days was not it. Availability
 * reaches a guest through a rolling window: Booking.com publishes 18 months of calendar and opens
 * roughly 12 months of it, moving one day forward every day. So the end of our pricing is being
 * approached at a fixed rate, and a date arrives on sale carrying whatever price it already had.
 * A fortnight's notice is a warning that lands after it mattered.
 *
 * So the notice threshold is 15 months — about three months of clear air before the OTA window
 * reaches the end of our table, which is ample to run `scripts/generate-season.ts`, review the
 * draft and promote it.
 *
 * Security: Only accessible via cron job with proper authorization header.
 * Frequency: Intended to run weekly via Cloud Scheduler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreForPricing } from '@/lib/firebaseAdminPricing';
import { loggers } from '@/lib/logger';
import { sendCalendarExpiryAlert } from '@/services/emailService';

const logger = loggers.adminPricing;

/** Notice threshold: ~15 months, i.e. ~3 months before a 12-month OTA window reaches our last night. */
const EXPIRY_WARNING_DAYS = 456;
/** Below this, the gap is close enough that every run should shout, throttle or no throttle. */
const URGENT_DAYS = 60;
/**
 * At the notice threshold there can be months of runway, and a weekly cron would send a dozen
 * identical emails about a problem that is not yet urgent. One per month per property is a warning;
 * one per week is noise people learn to filter, which is worse than no warning at all.
 */
const NOTICE_THROTTLE_DAYS = 30;
const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL || process.env.RESEND_FROM_EMAIL || '';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://rentalspot.com';

export async function GET(request: NextRequest) {
  logger.info('Calendar expiry check endpoint called');

  // Verify this is a legitimate cron request
  const authHeader = request.headers.get('Authorization');
  const cronHeader = request.headers.get('X-Appengine-Cron');

  if (!cronHeader && !authHeader?.startsWith('Bearer ')) {
    logger.error('Unauthorized access attempt to calendar expiry check endpoint');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getFirestoreForPricing();
    if (!db) {
      throw new Error('Firebase Admin SDK not available');
    }

    // Get all properties
    const propertiesSnapshot = await db.collection('properties').get();
    const results: Array<{ propertyId: string; propertyName: string; expiryMonth: string; daysUntilExpiry: number; urgent: boolean; alertsSent: number }> = [];

    for (const propertyDoc of propertiesSnapshot.docs) {
      const propertyId = propertyDoc.id;
      const propertyData = propertyDoc.data();
      const propertyName = propertyData.name || propertyId;

      // Find the latest calendar for this property.
      //
      // Ordered in CODE, not in the query. The original ordered by year desc + month desc, which
      // needs a composite index in that direction, and only the ascending one was ever declared —
      // so every run of this cron failed with FAILED_PRECONDITION and the alert it exists to send
      // has never once been sent. A property has a couple of dozen calendars; sorting them here
      // costs nothing and cannot be defeated by a missing index.
      const calendarsSnapshot = await db.collection('priceCalendars')
        .where('propertyId', '==', propertyId)
        .get();

      if (calendarsSnapshot.empty) {
        logger.debug('No calendars found for property', { propertyId });
        continue;
      }

      const lastCalendar = calendarsSnapshot.docs
        .map((d) => d.data())
        .filter((c) => Number.isFinite(c.year) && Number.isFinite(c.month))
        .sort((a, b) => b.year - a.year || b.month - a.month)[0];

      if (!lastCalendar) {
        logger.warn('Calendars found but none carried a usable year/month', { propertyId, count: calendarsSnapshot.size });
        continue;
      }

      const lastYear = lastCalendar.year;
      const lastMonth = lastCalendar.month;

      // Calculate the last day of the last calendar month
      const expiryDate = new Date(lastYear, lastMonth, 0); // day 0 of next month = last day
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry > EXPIRY_WARNING_DAYS) {
        continue; // Not expiring soon
      }

      // Throttle the non-urgent case. `lastCalendarExpiryAlertAt` is keyed by the expiry month, so a
      // newly generated season resets it: the next warning is about the NEW end of the table, not a
      // suppressed repeat of the old one.
      const urgent = daysUntilExpiry <= URGENT_DAYS;
      const lastAlert = propertyData.lastCalendarExpiryAlert as { month?: string; at?: string } | undefined;
      if (!urgent && lastAlert?.month === `${lastYear}-${String(lastMonth).padStart(2, '0')}` && lastAlert.at) {
        const sinceDays = (now.getTime() - Date.parse(lastAlert.at)) / 86_400_000;
        if (Number.isFinite(sinceDays) && sinceDays < NOTICE_THROTTLE_DAYS) {
          logger.debug('Expiry alert throttled', { propertyId, daysUntilExpiry, sinceDays });
          continue;
        }
      }

      const expiryMonthStr = `${lastCalendar.monthStr || `${lastYear}-${String(lastMonth).padStart(2, '0')}`}`;
      const adminUrl = `${BASE_URL}/admin/pricing?propertyId=${propertyId}`;
      let alertsSent = 0;

      // Send to property owner if email exists
      const ownerEmail = propertyData.ownerEmail;
      if (ownerEmail) {
        const result = await sendCalendarExpiryAlert(ownerEmail, propertyName, propertyId, expiryMonthStr, daysUntilExpiry, adminUrl);
        if (result.success) alertsSent++;
        logger.info('Sent expiry alert to property owner', { propertyId, ownerEmail, success: result.success });
      }

      // Send to global admin
      if (ADMIN_EMAIL && ADMIN_EMAIL !== ownerEmail) {
        const result = await sendCalendarExpiryAlert(ADMIN_EMAIL, propertyName, propertyId, expiryMonthStr, daysUntilExpiry, adminUrl);
        if (result.success) alertsSent++;
        logger.info('Sent expiry alert to admin', { propertyId, adminEmail: ADMIN_EMAIL, success: result.success });
      }

      if (alertsSent) {
        await propertyDoc.ref.update({
          lastCalendarExpiryAlert: { month: expiryMonthStr, at: new Date().toISOString() },
        });
      }

      results.push({
        propertyId,
        propertyName,
        expiryMonth: expiryMonthStr,
        daysUntilExpiry,
        urgent,
        alertsSent
      });
    }

    logger.info('Calendar expiry check completed', {
      propertiesChecked: propertiesSnapshot.size,
      expiringProperties: results.length,
      totalAlertsSent: results.reduce((sum, r) => sum + r.alertsSent, 0)
    });

    return NextResponse.json({
      success: true,
      propertiesChecked: propertiesSnapshot.size,
      expiringProperties: results
    });
  } catch (error) {
    logger.error('Error in calendar expiry check', error as Error);
    return NextResponse.json(
      { error: 'Failed to check calendar expiry' },
      { status: 500 }
    );
  }
}
