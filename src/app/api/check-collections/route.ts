import { NextResponse } from 'next/server';
import { getFirestoreForPricing } from '@/lib/firebaseAdminPricing';
import { loggers } from '@/lib/logger';

const logger = loggers.admin;

export async function GET() {
  try {
    const db = await getFirestoreForPricing();
    if (!db) {
      return NextResponse.json({ error: 'Database connection unavailable' });
    }

    logger.debug('Listing collections');
    
    // Get all collections
    const collections = await db.listCollections();
    
    const collectionInfo = [];
    
    for (const collection of collections) {
      const snapshot = await collection.limit(5).get();
      collectionInfo.push({
        name: collection.id,
        documentCount: snapshot.size,
        sampleDocs: snapshot.docs.map(doc => ({
          id: doc.id,
          hasData: !!doc.data()
        }))
      });
    }
    
    // Also check specific collections that might have calendars
    const possibleCalendarCollections = [
      'priceCalendar',
      'priceCalendars', 
      'price-calendar',
      'price-calendars',
      'pricing',
      'pricingCalendar',
      'pricingCalendars'
    ];
    
    const calendarChecks = [];
    for (const collName of possibleCalendarCollections) {
      try {
        const snapshot = await db.collection(collName).limit(1).get();
        calendarChecks.push({
          collection: collName,
          exists: !snapshot.empty,
          count: snapshot.size
        });
      } catch (error) {
        calendarChecks.push({
          collection: collName,
          exists: false,
          error: (error as Error).message
        });
      }
    }
    
    return NextResponse.json({
      collections: collectionInfo,
      calendarChecks
    });
    
  } catch (error: any) {
    logger.error('Error checking collections', error as Error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    });
  }
}