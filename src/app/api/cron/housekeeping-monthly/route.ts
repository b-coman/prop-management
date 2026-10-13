import { NextRequest, NextResponse } from 'next/server';
import { rejectIfNotCron } from '@/lib/cron-auth';
import { loggers } from '@/lib/logger';

const logger = loggers.housekeeping;

export async function GET(request: NextRequest) {
  logger.info('Housekeeping monthly cron endpoint called');

  const unauthorized = rejectIfNotCron(request, 'housekeeping-monthly');
  if (unauthorized) return unauthorized;

  try {
    const { getPropertiesWithContacts, sendMonthlyScheduleToProperty } =
      await import('@/services/housekeepingService');

    const propertyIds = await getPropertiesWithContacts();
    logger.info('Properties with housekeeping contacts', { count: propertyIds.length });

    const currentMonth = new Date();
    const stats = { processed: 0, sent: 0, failed: 0 };

    for (const propertyId of propertyIds) {
      try {
        const result = await sendMonthlyScheduleToProperty(propertyId, currentMonth);
        stats.processed++;
        stats.sent += result.sent;
        stats.failed += result.failed;
      } catch (error) {
        logger.error('Error processing monthly schedule for property', error as Error, { propertyId });
        stats.failed++;
      }
    }

    logger.info('Housekeeping monthly cron completed', stats);
    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    logger.error('Error in housekeeping-monthly cron', error as Error);
    return NextResponse.json(
      { error: 'Failed to process monthly schedules', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
