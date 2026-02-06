/**
 * @fileoverview Public iCal export endpoint for property availability.
 * Generates a .ics file with blocked/booked dates for a property.
 * Protected by a per-property secret token.
 *
 * URL format: /api/ical/{propertyId}/calendar.ics?token={secret}
 * Booking.com and Airbnb can import this URL to sync availability.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreForPricing } from '@/lib/firebaseAdminPricing';
import { format } from 'date-fns';
import { loggers } from '@/lib/logger';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limiter';
import { generateICalExport } from '@/lib/ical/ical-export';
import type { Availability } from '@/types';

const logger = loggers.icalSync;

const RATE_LIMIT_CONFIG = { maxRequests: 30, windowSeconds: 60, keyPrefix: 'ical-export' };
const MONTHS_TO_EXPORT = 18;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const { propertyId } = await params;

  // Rate limit
  const rateLimitResult = checkRateLimit(request, RATE_LIMIT_CONFIG);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  // Validate token
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    logger.warn('Missing token for iCal export', { propertyId });
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }

  try {
    const db = await getFirestoreForPricing();
    if (!db) {
      logger.error('Firestore Admin SDK not initialized');
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Fetch property and validate token
    const propertyDoc = await db.collection('properties').doc(propertyId).get();
    if (!propertyDoc.exists) {
      logger.warn('Property not found for iCal export', { propertyId });
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const property = propertyDoc.data()!;
    if (!property.icalExportEnabled) {
      logger.info('iCal export disabled for property', { propertyId });
      return NextResponse.json({ error: 'Export disabled' }, { status: 403 });
    }

    if (property.icalExportToken !== token) {
      logger.warn('Invalid token for iCal export', { propertyId });
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Fetch availability docs for the next N months
    const today = new Date();
    const monthDocIds: string[] = [];
    for (let i = 0; i < MONTHS_TO_EXPORT; i++) {
      const targetMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1));
      const monthStr = format(targetMonth, 'yyyy-MM');
      monthDocIds.push(`${propertyId}_${monthStr}`);
    }

    // Batch fetch (max 30 per Firestore query)
    const availabilityDocs: Availability[] = [];
    for (let i = 0; i < monthDocIds.length; i += 30) {
      const batch = monthDocIds.slice(i, i + 30);
      const refs = batch.map(id => db.collection('availability').doc(id));
      const snapshots = await db.getAll(...refs);
      for (const snap of snapshots) {
        if (snap.exists) {
          availabilityDocs.push({ id: snap.id, ...snap.data() } as Availability);
        }
      }
    }

    // Get property name for the calendar
    const propertyName = typeof property.name === 'object' ? property.name.en : property.name;

    // Generate iCal content
    const icalContent = generateICalExport(propertyId, propertyName || propertyId, availabilityDocs);

    logger.info('iCal export generated', {
      propertyId,
      availabilityDocsCount: availabilityDocs.length,
      contentLength: icalContent.length,
    });

    // Return as .ics file
    return new NextResponse(icalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${propertyId}-calendar.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    logger.error('Error generating iCal export', error as Error, { propertyId });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
