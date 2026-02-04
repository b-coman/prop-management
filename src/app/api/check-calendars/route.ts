import { NextResponse } from 'next/server';
import { getFirestoreForPricing } from '@/lib/firebaseAdminPricing';
import { loggers } from '@/lib/logger';

const logger = loggers.adminPricing;

export async function GET() {
  try {
    const db = await getFirestoreForPricing();
    if (!db) {
      return NextResponse.json({ error: 'Database connection unavailable' });
    }

    logger.debug('Fetching price calendars');
    
    // Get all price calendars
    const snapshot = await db.collection('priceCalendars').get();
    
    const calendars: any[] = [];
    snapshot.forEach(doc => {
      calendars.push({
        id: doc.id,
        data: doc.data()
      });
    });
    
    // Get first calendar to show sample data
    const sampleCalendar = calendars[0];
    let sampleDays: any = {};
    if (sampleCalendar && sampleCalendar.data.days) {
      // Get first 5 days as sample
      const days = Object.entries(sampleCalendar.data.days).slice(0, 5);
      for (const [day, data] of days) {
        sampleDays[day] = {
          available: (data as any).available,
          baseOccupancyPrice: (data as any).baseOccupancyPrice,
          prices: (data as any).prices
        };
      }
    }
    
    return NextResponse.json({
      count: snapshot.size,
      calendars: calendars.map(cal => ({
        id: cal.id,
        propertyId: cal.data.propertyId,
        month: cal.data.month,
        dayCount: Object.keys(cal.data.days || {}).length
      })),
      sampleData: sampleCalendar ? {
        id: sampleCalendar.id,
        days: sampleDays
      } : null
    });
    
  } catch (error: any) {
    logger.error('Error checking calendars', error as Error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    });
  }
}