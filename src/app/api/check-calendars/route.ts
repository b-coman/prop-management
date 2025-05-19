import { NextResponse } from 'next/server';
import { getFirestoreForPricing } from '@/lib/firebaseAdminPricing';

export async function GET() {
  try {
    const db = await getFirestoreForPricing();
    if (!db) {
      return NextResponse.json({ error: 'Database connection unavailable' });
    }
    
    console.log('Fetching price calendars...');
    
    // Get all price calendars
    const snapshot = await db.collection('priceCalendars').get();
    
    const calendars = [];
    snapshot.forEach(doc => {
      calendars.push({
        id: doc.id,
        data: doc.data()
      });
    });
    
    return NextResponse.json({
      count: snapshot.size,
      calendars: calendars.map(cal => ({
        id: cal.id,
        propertyId: cal.data.propertyId,
        month: cal.data.month,
        dayCount: Object.keys(cal.data.days || {}).length
      }))
    });
    
  } catch (error: any) {
    console.error('Error checking calendars:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    });
  }
}