import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreForPricing } from '@/lib/firebaseAdminPricing';
import { getMonthsBetweenDates } from '@/lib/pricing/price-calendar-generator';
import { parseISO, format } from 'date-fns';

export async function POST(request: NextRequest) {
  const debug = {
    request: {},
    property: null,
    priceCalendars: [],
    errors: [],
    logs: []
  };

  try {
    // Parse request
    const body = await request.json();
    debug.request = body;
    const { propertyId, checkIn, checkOut, guests } = body;
    
    debug.logs.push(`Request received: ${JSON.stringify(body)}`);
    
    // Initialize Firebase
    const db = await getFirestoreForPricing();
    if (!db) {
      debug.errors.push('Failed to initialize Firebase Admin');
      return NextResponse.json(debug);
    }
    debug.logs.push('Firebase Admin initialized successfully');
    
    // Check property exists
    const propertyDoc = await db.collection('properties').doc(propertyId).get();
    if (!propertyDoc.exists) {
      debug.errors.push(`Property ${propertyId} not found`);
      return NextResponse.json(debug);
    }
    debug.property = propertyDoc.data();
    debug.logs.push(`Property found: ${propertyDoc.id}`);
    
    // Parse dates
    const checkInDate = parseISO(checkIn);
    const checkOutDate = parseISO(checkOut);
    
    // Get months needed
    const months = getMonthsBetweenDates(checkInDate, checkOutDate);
    debug.logs.push(`Months needed: ${JSON.stringify(months)}`);
    
    // Check each price calendar
    for (const { year, month } of months) {
      const monthStr = month.toString().padStart(2, '0');
      const calendarId = `${propertyId}_${year}-${monthStr}`;
      
      debug.logs.push(`Checking calendar: ${calendarId}`);
      
      const calendarDoc = await db.collection('priceCalendar').doc(calendarId).get();
      
      if (!calendarDoc.exists) {
        debug.errors.push(`Price calendar ${calendarId} not found`);
        debug.priceCalendars.push({
          id: calendarId,
          exists: false,
          data: null
        });
      } else {
        const calendarData = calendarDoc.data();
        debug.priceCalendars.push({
          id: calendarId,
          exists: true,
          data: {
            month: calendarData.month,
            propertyId: calendarData.propertyId,
            dayCount: Object.keys(calendarData.days || {}).length,
            sampleDays: Object.entries(calendarData.days || {}).slice(0, 3).map(([day, data]) => ({
              day,
              available: (data as any).available,
              basePrice: (data as any).baseOccupancyPrice
            }))
          }
        });
        debug.logs.push(`Calendar found with ${Object.keys(calendarData.days || {}).length} days`);
      }
    }
    
    // Check date overrides
    debug.logs.push('Checking date overrides...');
    const overridesSnapshot = await db.collection('dateOverrides')
      .where('propertyId', '==', propertyId)
      .where('startDate', '<=', checkOutDate)
      .where('endDate', '>=', checkInDate)
      .get();
    
    debug.logs.push(`Found ${overridesSnapshot.size} date overrides`);
    
    // Check seasonal pricing
    debug.logs.push('Checking seasonal pricing...');
    const seasonalSnapshot = await db.collection('seasonalPricing')
      .where('propertyId', '==', propertyId)
      .get();
    
    debug.logs.push(`Found ${seasonalSnapshot.size} seasonal pricing rules`);
    
    return NextResponse.json(debug);
    
  } catch (error: any) {
    debug.errors.push(error.message);
    debug.logs.push(`Error: ${error.message}`);
    return NextResponse.json(debug);
  }
}

export async function GET() {
  return NextResponse.json({
    usage: 'POST /api/debug-pricing',
    body: {
      propertyId: 'string',
      checkIn: 'YYYY-MM-DD',
      checkOut: 'YYYY-MM-DD',
      guests: 'number'
    }
  });
}