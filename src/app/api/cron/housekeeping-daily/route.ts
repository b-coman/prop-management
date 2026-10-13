import { NextRequest, NextResponse } from 'next/server';
import { rejectIfNotCron } from '@/lib/cron-auth';
import { loggers } from '@/lib/logger';

const logger = loggers.housekeeping;

export async function GET(request: NextRequest) {
  logger.info('Housekeeping daily cron endpoint called');

  const unauthorized = rejectIfNotCron(request, 'housekeeping-daily');
  if (unauthorized) return unauthorized;

  try {
    const { getPropertiesWithContacts, sendDailyNotificationToProperty } =
      await import('@/services/housekeepingService');

    const propertyIds = await getPropertiesWithContacts();
    logger.info('Properties with housekeeping contacts', { count: propertyIds.length });

    const today = new Date();
    const stats = { processed: 0, sent: 0, skipped: 0, failed: 0 };

    for (const propertyId of propertyIds) {
      try {
        const result = await sendDailyNotificationToProperty(propertyId, today);
        stats.processed++;
        stats.sent += result.sent;
        stats.failed += result.failed;
        if (result.skipped) stats.skipped++;
      } catch (error) {
        logger.error('Error processing daily notification for property', error as Error, { propertyId });
        stats.failed++;
      }
    }

    logger.info('Housekeeping daily cron completed', stats);
    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    logger.error('Error in housekeeping-daily cron', error as Error);
    return NextResponse.json(
      { error: 'Failed to process daily notifications', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
