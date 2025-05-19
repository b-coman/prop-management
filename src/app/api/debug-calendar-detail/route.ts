import { NextResponse } from 'next/server';
import { getFirestoreForPricing } from '@/lib/firebaseAdminPricing';

export async function GET() {
  try {
    const db = await getFirestoreForPricing();
    if (!db) {
      return NextResponse.json({ error: 'Database connection unavailable' });
    }
    
    // Get a specific calendar document
    const docId = 'prahova-mountain-chalet_2025-05';
    const doc = await db.collection('priceCalendars').doc(docId).get();
    
    if (!doc.exists) {
      return NextResponse.json({ error: `Document ${docId} not found` });
    }
    
    const data = doc.data()!;
    
    // Get sample of days data
    const days = data.days || data.prices || {};
    const dayKeys = Object.keys(days).slice(0, 5);
    const sampleDays: any = {};
    
    for (const key of dayKeys) {
      sampleDays[key] = days[key];
    }
    
    return NextResponse.json({
      id: doc.id,
      propertyId: data.propertyId,
      year: data.year,
      month: data.month,
      hasCalendarField: !!data.calendar,
      hasDaysField: !!data.days,
      hasPricesField: !!data.prices,
      fieldNames: Object.keys(data),
      sampleDays
    });
    
  } catch (error: any) {
    console.error('Error checking calendar detail:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    });
  }
}