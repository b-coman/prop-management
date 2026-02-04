import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreForPricing } from '@/lib/firebaseAdminPricing';
import { format, isValid, startOfDay } from 'date-fns';
import { loggers } from '@/lib/logger';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limiter';

const logger = loggers.availability;

// Rate limit: 60 requests per minute per IP
const RATE_LIMIT_CONFIG = { maxRequests: 60, windowSeconds: 60, keyPrefix: 'check-availability' };

/**
 * API route handler for checking property availability
 * Performs the Firestore query server-side using Admin SDK for cloud compatibility
 */
export async function GET(request: NextRequest) {
  // Check rate limit
  const rateLimitResult = checkRateLimit(request, RATE_LIMIT_CONFIG);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', unavailableDates: [] },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    // Get property slug and months from query parameters
    const searchParams = request.nextUrl.searchParams;
    const propertySlug = searchParams.get('propertySlug');
    const monthsToFetch = parseInt(searchParams.get('months') || '12', 10);

    logger.debug('Request received', { propertySlug, monthsToFetch });

    // Validate parameters
    if (!propertySlug) {
      logger.warn('Missing propertySlug parameter');
      return NextResponse.json(
        { error: 'Property slug is required' },
        { status: 400 }
      );
    }


    // Implementation using Admin SDK for cloud compatibility
    const unavailableDates: string[] = []; // Return as ISO strings for consistent serialization
    
    // Get Admin SDK Firestore instance
    const db = await getFirestoreForPricing();
    
    if (!db) {
      logger.error('Firestore Admin SDK not initialized');
      return NextResponse.json(
        {
          error: 'Database connection error - Firestore admin not initialized',
          errorType: 'db_not_initialized',
          unavailableDates: []
        },
        { status: 500 }
      );
    }


    const availabilityCollection = db.collection('availability');
    const today = new Date();
    const currentMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    // Generate the document IDs to query (one for each month)
    const monthDocIds: string[] = [];
    for (let i = 0; i < monthsToFetch; i++) {
      const targetMonth = new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() + i, 1));
      const monthStr = format(targetMonth, 'yyyy-MM');
      const docId = `${propertySlug}_${monthStr}`;
      monthDocIds.push(docId);
    }

    if (monthDocIds.length === 0) {
      return NextResponse.json({ unavailableDates: [] });
    }

    // Batch queries due to Firestore limits (max 30 IDs per in() query)
    const queryBatches: string[][] = [];
    for (let i = 0; i < monthDocIds.length; i += 30) {
      queryBatches.push(monthDocIds.slice(i, i + 30));
    }

    // Execute all query batches in parallel using Admin SDK syntax
    const allQuerySnapshots = await Promise.all(
      queryBatches.map(async (batchIds, index) => {
        if (batchIds.length === 0) return null;
        const query = availabilityCollection.where('__name__', 'in', batchIds.map(id => availabilityCollection.doc(id)));
        return query.get();
      })
    );

    // Process the query results
    let docCount = 0;
    let docsWithDataCount = 0;
    
    allQuerySnapshots.forEach((querySnapshot, batchIndex) => {
      if (!querySnapshot) {
        return;
      }
      
      docCount += querySnapshot.docs.length;
      
      querySnapshot.docs.forEach((doc) => {
        const data = doc.data() as any;
        const docId = doc.id;
        
        // Check if the document is for the requested property
        if (!docId.startsWith(`${propertySlug}_`)) {
          logger.warn('Document ID mismatch', { docId, propertySlug });
          return;
        }

        const monthStr = data.month || docId.split('_').slice(1).join('_');
        if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
          logger.warn('Invalid month string', { monthStr, docId });
          return;
        }

        const [year, monthIndex] = monthStr.split('-').map((num: string) => parseInt(num, 10));
        const month = monthIndex - 1; // JS month is 0-indexed
        
        docsWithDataCount++;
        
        // Process 'available' map
        if (data.available && typeof data.available === 'object') {
          for (const dayStr in data.available) {
            const day = parseInt(dayStr, 10);
            if (!isNaN(day) && data.available[day] === false) {
              try {
                const date = new Date(Date.UTC(year, month, day));
                if (isValid(date) && date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
                  const todayUtcStart = startOfDay(new Date());
                  if (date >= todayUtcStart) {
                    // Convert to ISO string for consistent serialization
                    const dateIso = date.toISOString();
                    if (!unavailableDates.includes(dateIso)) {
                      unavailableDates.push(dateIso);
                    }
                  }
                }
              } catch (dateError) {
                logger.warn('Error creating date', { monthStr, dayStr, error: dateError });
              }
            }
          }
        }

        // Process 'holds' map
        if (data.holds && typeof data.holds === 'object') {
          for (const dayStr in data.holds) {
            if (data.holds[dayStr]) { // If there's a hold ID for this day
              const day = parseInt(dayStr, 10);
              if (!isNaN(day)) {
                try {
                  const date = new Date(Date.UTC(year, month, day));
                  if (isValid(date) && date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
                    const todayUtcStart = startOfDay(new Date());
                    if (date >= todayUtcStart) {
                      const dateIso = date.toISOString();
                      if (!unavailableDates.includes(dateIso)) {
                        unavailableDates.push(dateIso);
                      }
                    }
                  }
                } catch (dateError) {
                  logger.warn('Error creating date', { monthStr, dayStr, error: dateError });
                }
              }
            }
          }
        }
      });
    });

    logger.debug('Availability check complete', {
      propertySlug,
      docsProcessed: docCount,
      docsWithData: docsWithDataCount,
      unavailableDatesCount: unavailableDates.length
    });

    // Sort dates for convenience
    unavailableDates.sort();


    // Return the unavailable dates as ISO strings (will be converted back to Date objects on the client)
    return NextResponse.json({
      unavailableDates,
      meta: {
        propertySlug,
        months: monthsToFetch,
        docsProcessed: docCount,
        dateCount: unavailableDates.length,
        version: "admin-sdk-migrated"
      }
    });
    
  } catch (error) {
    logger.error('Error in check-availability endpoint', error as Error);

    // Always return a valid response with empty array to prevent client issues
    return NextResponse.json(
      {
        error: 'Internal server error checking availability',
        errorDetails: error instanceof Error ? error.message : String(error),
        unavailableDates: [],
        errorOccurred: true
      },
      { status: 500 }
    );
  }
}

// Also support POST requests if needed for larger requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertySlug, months = 12 } = body;
    
    // Create a new request with query parameters and use the GET handler
    const url = new URL(request.url);
    url.searchParams.set('propertySlug', propertySlug);
    url.searchParams.set('months', months.toString());
    const newRequest = new NextRequest(url);
    
    return GET(newRequest);
  } catch (error) {
    logger.error('Error processing POST request', error as Error);
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  }
}