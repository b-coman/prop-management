import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, documentId, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Client Firebase
import { format, isValid, startOfDay, parseISO, differenceInDays } from 'date-fns';
import { calculateBookingPrice, LengthOfStayDiscount } from '@/lib/pricing/price-calculation';

/**
 * API endpoint to check availability and pricing combined from priceCalendar
 * This uses the new priceCalendar collection as the source of truth for both
 * availability and pricing data.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { propertyId, checkIn, checkOut, guests } = body;
    
    console.log(`[check-pricing-availability] Processing request:`, {
      propertyId,
      checkIn,
      checkOut,
      guests
    });
    
    // Validate required parameters
    if (!propertyId || !checkIn || !checkOut || !guests) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Parse dates
    const checkInDate = parseISO(checkIn);
    const checkOutDate = parseISO(checkOut);
    
    // Validate date range
    if (checkInDate >= checkOutDate) {
      return NextResponse.json(
        { error: 'Check-out date must be after check-in date' },
        { status: 400 }
      );
    }

    // Make sure Firebase client is initialized
    if (!db) {
      console.error('[check-pricing-availability] Firebase client not initialized');
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      );
    }
    
    // Get property details using client Firestore
    let property;
    try {
      const propertyRef = doc(db, 'properties', propertyId);
      const propertySnapshot = await getDoc(propertyRef);
      
      if (!propertySnapshot.exists()) {
        return NextResponse.json(
          { error: 'Property not found' },
          { status: 404 }
        );
      }
      property = propertySnapshot.data();
    } catch (error) {
      console.error(`[check-pricing-availability] Error fetching property ${propertyId}:`, error);
      return NextResponse.json(
        { error: 'Error fetching property details' },
        { status: 500 }
      );
    }
    
    const nights = differenceInDays(checkOutDate, checkInDate);
    
    // Approach: Instead of trying to read the priceCalendar collection directly,
    // which fails due to security permissions, we'll use the /api/check-availability 
    // endpoint to get availability status
    
    const baseUrl = request.nextUrl.origin;
    const availabilityUrl = `${baseUrl}/api/check-availability?propertySlug=${encodeURIComponent(propertyId)}&months=12`;
    
    // Fetch availability using the standard API
    console.log(`[check-pricing-availability] Fetching availability from ${availabilityUrl}`);
    const response = await fetch(availabilityUrl);
    
    if (!response.ok) {
      console.error(`[check-pricing-availability] Error fetching availability: ${response.status}`);
      return NextResponse.json(
        { error: 'Failed to check availability' },
        { status: 500 }
      );
    }
    
    const availabilityData = await response.json();
    
    // Extract unavailable dates
    const unavailableDates = (availabilityData.unavailableDates || []).map((dateStr: string) => new Date(dateStr));
    
    console.log(`[check-pricing-availability] Received ${unavailableDates.length} unavailable dates`);
    
    // Check if dates are available
    let allAvailable = true;
    let unavailableDatesList: string[] = [];
    let minimumStay = 1;
    const dailyPrices: Record<string, number> = {};
    
    // Define loadedCalendars outside the try block so it's accessible to the entire function
    const loadedCalendars: Record<string, any> = {};
    
    // Try to get price calendar data for the property
    try {
      // Process price calendars by month - using only the standard monthly format
      
      // Collect all months we need to fetch
      const requiredMonths: string[] = [];
      
      let currentDate = new Date(checkInDate);
      while (currentDate < checkOutDate) {
        // Format to YYYY-MM for month-based calendars
        const yearMonth = format(currentDate, 'yyyy-MM');
        if (!requiredMonths.includes(yearMonth)) {
          requiredMonths.push(yearMonth);
        }
        
        // Go to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      console.log(`[check-pricing-availability] Need to check ${requiredMonths.length} calendar months: ${requiredMonths.join(', ')}`);
      
      // Fetch each required month's calendar using the standardized format
      for (const yearMonth of requiredMonths) {
        // Format the calendar ID: propertyId_YYYY-MM
        const calendarId = `${propertyId}_${yearMonth}`;
        console.log(`[check-pricing-availability] Fetching calendar: ${calendarId}`);
        
        const calendarRef = doc(db, 'priceCalendars', calendarId);
        const calendarSnap = await getDoc(calendarRef);
        
        if (calendarSnap.exists()) {
          loadedCalendars[yearMonth] = calendarSnap.data();
          console.log(`[check-pricing-availability] Found calendar for ${calendarId}`);
        } else {
          console.log(`[check-pricing-availability] Calendar not found for ${calendarId}`);
        }
      }
      
      // If we didn't find any calendars, log a warning
      if (Object.keys(loadedCalendars).length === 0) {
        console.log(`[check-pricing-availability] No price calendars found for ${propertyId}, will use base prices for all dates`);
      } else {
        console.log(`[check-pricing-availability] Loaded ${Object.keys(loadedCalendars).length} calendars`);
      }
      
      // Define a function to get price from calendars or fallback to property base price
      const getPriceFromCalendar = (date: Date, guestCount: number) => {
        // Format to get the year-month and day
        const yearMonth = format(date, 'yyyy-MM');
        const fullDateStr = format(date, 'yyyy-MM-dd');
        const dayOfMonth = date.getDate().toString();
        
        // Look for the day in the monthly calendar structure
        if (loadedCalendars[yearMonth] && loadedCalendars[yearMonth].days && loadedCalendars[yearMonth].days[dayOfMonth]) {
          const dayData = loadedCalendars[yearMonth].days[dayOfMonth];
          
          // First check if date is available
          if (!dayData.available) {
            console.log(`[check-pricing-availability] Date ${fullDateStr} marked as unavailable in calendar`);
            return null;
          }
          
          // Find the right price based on guest count
          if (dayData.prices && typeof dayData.prices === 'object') {
            // Look for exact guest count match first
            if (dayData.prices[guestCount]) {
              console.log(`[check-pricing-availability] Found exact price for ${guestCount} guests: ${dayData.prices[guestCount]}`);
              return dayData.prices[guestCount];
            }
            
            // If no exact match, find the closest guest count bracket
            const guestCounts = Object.keys(dayData.prices)
              .map(Number)
              .filter(count => !isNaN(count))
              .sort((a, b) => a - b);
            
            // Find the bracket that contains our guest count
            for (let i = 0; i < guestCounts.length; i++) {
              if (guestCount <= guestCounts[i] || i === guestCounts.length - 1) {
                const price = dayData.prices[guestCounts[i]];
                console.log(`[check-pricing-availability] Using bracketed price for ${guestCounts[i]} guests: ${price}`);
                return price;
              }
            }
          }
          
          // If we have adjustedPrice directly, use that
          if (dayData.adjustedPrice) {
            console.log(`[check-pricing-availability] Using adjustedPrice: ${dayData.adjustedPrice}`);
            return dayData.adjustedPrice;
          }
          
          // If we have basePrice, use that
          if (dayData.basePrice) {
            console.log(`[check-pricing-availability] Using basePrice: ${dayData.basePrice}`);
            return dayData.basePrice;
          }
        }
        
        // Fallback to property base price
        console.log(`[check-pricing-availability] No calendar price for ${fullDateStr}, using base property price`);
        return property.pricePerNight || 100;
      };
      
      // Process each day in the date range 
      // Using loopDate to avoid duplicate variable name
      const loopDate = new Date(checkInDate);
      for (let night = 0; night < nights; night++) {
        const dateStr = format(loopDate, 'yyyy-MM-dd');
        
        // First check if date is in unavailableDates from API
        if (unavailableDates.some(d => format(d, 'yyyy-MM-dd') === dateStr)) {
          allAvailable = false;
          unavailableDatesList.push(dateStr);
          console.log(`[check-pricing-availability] Date ${dateStr} is unavailable (from availability check)`);
        } else {
          console.log(`[check-pricing-availability] Date ${dateStr} is available from availability API`);
          
          // Try to get price from calendar or fallback to property base price
          // Also handles unavailability from the calendar itself
          const dayPrice = getPriceFromCalendar(loopDate, guests);
          
          // If price returned null, date is marked unavailable in calendar
          if (dayPrice === null) {
            allAvailable = false;
            unavailableDatesList.push(dateStr);
          } else {
            // Store the price
            dailyPrices[dateStr] = dayPrice;
            console.log(`[check-pricing-availability] Using price for ${dateStr}: ${dayPrice}`);
          }
        }
        
        // Move to next day
        loopDate.setDate(loopDate.getDate() + 1);
      }
    } catch (error) {
      console.error(`[check-pricing-availability] Error accessing price calendar:`, error);
      console.log(`[check-pricing-availability] Falling back to property base price`);
      
      // Fallback: Process each day using just the property base price
      const basePrice = property.pricePerNight || 100;
      const extraGuestFee = property.extraGuestFee || 0;
      const baseOccupancy = property.baseOccupancy || 2;
      
      // Calculate extra guest fees if applicable
      let adjustedBasePrice = basePrice;
      if (guests > baseOccupancy && extraGuestFee > 0) {
        const extraGuests = guests - baseOccupancy;
        adjustedBasePrice = basePrice + (extraGuests * extraGuestFee);
        console.log(`[check-pricing-availability] Applying extra guest fee: ${extraGuests} extra guests at ${extraGuestFee} each`);
      }
      
      const fallbackDate = new Date(checkInDate);
      
      for (let night = 0; night < nights; night++) {
        const dateStr = format(fallbackDate, 'yyyy-MM-dd');
        
        // Check availability
        if (unavailableDates.some(d => format(d, 'yyyy-MM-dd') === dateStr)) {
          allAvailable = false;
          unavailableDatesList.push(dateStr);
        } else {
          // Use adjusted base price as fallback
          dailyPrices[dateStr] = adjustedBasePrice;
        }
        
        // Move to next day
        fallbackDate.setDate(fallbackDate.getDate() + 1);
      }
    }
    
    // Check for minimum stay requirements from price calendars - checking ALL days in the booking window
    try {
      // Initialize with property's minimum stay or default to 1
      minimumStay = property.minimumStay || 1;
      console.log(`[check-pricing-availability] Starting with property minimum stay: ${minimumStay} nights`);
      
      // Check each day in the booking window for minimum stay requirements
      const checkMinStayDate = new Date(checkInDate);
      
      // Loop through all dates in the booking window
      while (checkMinStayDate < checkOutDate) {
        const yearMonth = format(checkMinStayDate, 'yyyy-MM');
        const dayOfMonth = checkMinStayDate.getDate().toString();
        
        // Check if we have minimum stay info for this day
        if (loadedCalendars[yearMonth] && 
            loadedCalendars[yearMonth].days && 
            loadedCalendars[yearMonth].days[dayOfMonth] &&
            loadedCalendars[yearMonth].days[dayOfMonth].minimumStay) {
          
          const dayMinStay = loadedCalendars[yearMonth].days[dayOfMonth].minimumStay;
          
          // If this day has a higher minimum stay, update our requirement
          if (dayMinStay > minimumStay) {
            minimumStay = dayMinStay;
            console.log(`[check-pricing-availability] Found higher minimum stay requirement: ${minimumStay} nights for date ${format(checkMinStayDate, 'yyyy-MM-dd')}`);
          }
        }
        
        // Move to next day
        checkMinStayDate.setDate(checkMinStayDate.getDate() + 1);
      }
      
      console.log(`[check-pricing-availability] Final minimum stay requirement: ${minimumStay} nights`);
    } catch (error) {
      console.error(`[check-pricing-availability] Error getting minimum stay:`, error);
    }
    
    // Check if minimum stay requirement is met
    const meetsMinimumStay = nights >= minimumStay;
    
    // Calculate pricing if available and meets minimum stay
    if (allAvailable && meetsMinimumStay) {
      // Set up required pricing values
      const cleaningFee = property.cleaningFee || 0;
      const lengthOfStayDiscounts = property.pricingConfig?.lengthOfStayDiscounts || [];
      
      // Calculate subtotal (sum of daily rates)
      const accommodationTotal = Object.values(dailyPrices).reduce((sum, price) => sum + price, 0);
      const subtotal = accommodationTotal + cleaningFee;
      
      // Calculate any applicable discount based on length of stay
      let discountPercentage = 0;
      let discountAmount = 0;
      
      for (const discount of lengthOfStayDiscounts) {
        if (nights >= discount.minNights && discount.discountPercentage > discountPercentage) {
          discountPercentage = discount.discountPercentage;
        }
      }
      
      if (discountPercentage > 0) {
        discountAmount = (subtotal * discountPercentage) / 100;
      }
      
      // Calculate final total
      const totalPrice = subtotal - discountAmount;
      
      // Create pricing object to return
      return NextResponse.json({
        available: true,
        pricing: {
          dailyRates: dailyPrices,
          totalPrice: totalPrice,
          averageNightlyRate: accommodationTotal / nights,
          subtotal: subtotal,
          cleaningFee: cleaningFee,
          lengthOfStayDiscount: discountPercentage > 0 ? {
            discountPercentage,
            discountAmount
          } : null,
          currency: property.baseCurrency || 'USD',
          // Extra fields for compatibility
          accommodationTotal
        }
      });
    } else if (!meetsMinimumStay) {
      return NextResponse.json({
        available: false,
        reason: 'minimum_stay',
        minimumStay,
        requiredNights: minimumStay
      });
    } else {
      return NextResponse.json({
        available: false,
        reason: 'unavailable_dates',
        unavailableDates: unavailableDatesList
      });
    }
  } catch (error) {
    console.error('[check-pricing-availability] Error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to check pricing and availability' },
      { status: 500 }
    );
  }
}