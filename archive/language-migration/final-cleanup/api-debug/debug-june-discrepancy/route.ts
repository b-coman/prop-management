import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreForPricing } from '@/lib/firebaseAdminPricing';

export async function GET(request: NextRequest) {
  try {
    const db = await getFirestoreForPricing();
    if (!db) {
      return NextResponse.json({ error: 'Database connection unavailable' });
    }

    const propertySlug = 'prahova-mountain-chalet';
    const results: any = {
      availability: {},
      priceCalendar: {}
    };

    // Check availability collection for June 2025
    const availDocId = `${propertySlug}_2025-06`;
    const availDoc = await db.collection('availability').doc(availDocId).get();
    
    if (availDoc.exists) {
      const data = availDoc.data()!;
      results.availability = {
        exists: true,
        documentId: availDocId,
        month: data.month,
        // Check days 4-7
        days: {
          '4': { available: data.available?.[4], hold: data.holds?.[4] },
          '5': { available: data.available?.[5], hold: data.holds?.[5] },
          '6': { available: data.available?.[6], hold: data.holds?.[6] },
          '7': { available: data.available?.[7], hold: data.holds?.[7] }
        }
      };
    } else {
      results.availability = { exists: false, documentId: availDocId };
    }

    // Check priceCalendars collection for June 2025
    const priceDocId = `${propertySlug}_2025-06`;
    const priceDoc = await db.collection('priceCalendars').doc(priceDocId).get();
    
    if (priceDoc.exists) {
      const data = priceDoc.data()!;
      results.priceCalendar = {
        exists: true,
        documentId: priceDocId,
        year: data.year,
        month: data.month,
        // Check days 4-7
        days: {}
      };
      
      // Check each day
      for (const day of ['4', '5', '6', '7']) {
        if (data.days && data.days[day]) {
          results.priceCalendar.days[day] = {
            available: data.days[day].available,
            baseOccupancyPrice: data.days[day].baseOccupancyPrice,
            priceSource: data.days[day].priceSource
          };
        } else {
          results.priceCalendar.days[day] = null;
        }
      }
    } else {
      results.priceCalendar = { exists: false, documentId: priceDocId };
    }

    // Summary
    results.summary = {
      availabilityCollection: {
        june5: results.availability.days?.['5'],
        june6: results.availability.days?.['6']
      },
      priceCalendarCollection: {
        june5: results.priceCalendar.days?.['5'],
        june6: results.priceCalendar.days?.['6']
      }
    };

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Error checking June discrepancy:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    });
  }
}