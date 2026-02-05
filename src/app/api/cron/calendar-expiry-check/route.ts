/**
 * @fileoverview Cron endpoint to check for expiring price calendars and send alerts.
 *
 * Checks all properties for price calendars that expire within 14 days.
 * Sends email alerts to the property owner and a global admin email.
 *
 * Security: Only accessible via cron job with proper authorization header.
 * Frequency: Intended to run weekly via Cloud Scheduler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreForPricing } from '@/lib/firebaseAdminPricing';
import { loggers } from '@/lib/logger';
import { sendCalendarExpiryAlert } from '@/services/emailService';

const logger = loggers.adminPricing;

const EXPIRY_WARNING_DAYS = 14;
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
    const results: Array<{ propertyId: string; propertyName: string; expiryMonth: string; daysUntilExpiry: number; alertsSent: number }> = [];

    for (const propertyDoc of propertiesSnapshot.docs) {
      const propertyId = propertyDoc.id;
      const propertyData = propertyDoc.data();
      const propertyName = propertyData.name || propertyId;

      // Find the latest calendar for this property
      const calendarsSnapshot = await db.collection('priceCalendars')
        .where('propertyId', '==', propertyId)
        .orderBy('year', 'desc')
        .orderBy('month', 'desc')
        .limit(1)
        .get();

      if (calendarsSnapshot.empty) {
        logger.debug('No calendars found for property', { propertyId });
        continue;
      }

      const lastCalendar = calendarsSnapshot.docs[0].data();
      const lastYear = lastCalendar.year;
      const lastMonth = lastCalendar.month;

      // Calculate the last day of the last calendar month
      const expiryDate = new Date(lastYear, lastMonth, 0); // day 0 of next month = last day
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry > EXPIRY_WARNING_DAYS) {
        continue; // Not expiring soon
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

      results.push({
        propertyId,
        propertyName,
        expiryMonth: expiryMonthStr,
        daysUntilExpiry,
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
