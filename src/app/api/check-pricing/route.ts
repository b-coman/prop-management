import { NextRequest, NextResponse } from 'next/server';
import { getPropertyWithDb, getPriceCalendarWithDb } from '@/lib/pricing/pricing-with-db';
import { getMonthsBetweenDates } from '@/lib/pricing/price-calendar-generator';
import { calculateBookingPrice, LengthOfStayDiscount } from '@/lib/pricing/price-calculation';
import { differenceInDays, format, addDays, parseISO } from 'date-fns';

/**
 * API endpoint to check availability and pricing for a specific date range
 * 
 * Example request:
 * 
 * ```
 * POST /api/check-pricing
 * {
 *   "propertyId": "prahova-mountain-chalet",
 *   "checkIn": "2023-12-24",
 *   "checkOut": "2023-12-31",
 *   "guests": 4
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { propertyId, checkIn, checkOut, guests } = body;
    
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
    
    // Get property details
    const property = await getPropertyWithDb(propertyId);
    
    // Log property for debugging
    console.log(`[check-pricing] 🏠 Property details for ${propertyId}:`, {
      baseOccupancy: property.baseOccupancy,
      extraGuestFee: property.extraGuestFee,
      pricing: property.pricing
    });
    
    // Get number of nights
    const nights = differenceInDays(checkOutDate, checkInDate);
    
    // Get all required price calendars
    const months = getMonthsBetweenDates(checkInDate, checkOutDate);
    const calendars = await Promise.all(
      months.map(async ({ year, month }) => {
        const calendar = await getPriceCalendarWithDb(propertyId, year, month);
        return calendar;
      })
    );
    
    // Check if any calendars are missing
    if (calendars.some(calendar => calendar === null)) {
      return NextResponse.json(
        { error: 'Price information not available for the selected dates' },
        { status: 404 }
      );
    }
    
    // Check each date in the range
    const dailyPrices: Record<string, number> = {};
    let allAvailable = true;
    let minimumStay = 1;
    let unavailableDates: string[] = [];
    
    // Check each day
    const currentDate = new Date(checkInDate);
    for (let night = 0; night < nights; night++) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const day = currentDate.getDate().toString();
      
      // Find the relevant calendar
      const calendar = calendars.find(c => c?.year === year && c?.month === month);
      
      if (!calendar || !calendar.days[day]) {
        // No price information available
        allAvailable = false;
        unavailableDates.push(dateStr);
      } else {
        const dayPrice = calendar.days[day];
        
        // Check availability
        if (!dayPrice.available) {
          allAvailable = false;
          unavailableDates.push(dateStr);
        } else {
          // Record price for this date
          console.log(`[check-pricing] 🧮 Calculating price for ${dateStr} with ${guests} guests (baseOccupancy: ${property.baseOccupancy})`);
          
          if (guests <= property.baseOccupancy) {
            console.log(`[check-pricing] ✅ Using baseOccupancyPrice: ${dayPrice.baseOccupancyPrice}`);
            dailyPrices[dateStr] = dayPrice.baseOccupancyPrice;
          } else {
            const occupancyPrice = dayPrice.prices?.[guests.toString()];
            console.log(`[check-pricing] 🔍 Checking for specific price for ${guests} guests:`, 
              occupancyPrice ? `Found: ${occupancyPrice}` : 'Not found, using fallback');
            
            if (occupancyPrice) {
              dailyPrices[dateStr] = occupancyPrice;
            } else {
              // Fallback to base price + extra guest fee
              const extraGuests = guests - property.baseOccupancy;
              const extraGuestFee = property.extraGuestFee || 0;
              const calculatedPrice = dayPrice.baseOccupancyPrice + (extraGuests * extraGuestFee);
              
              console.log(`[check-pricing] 📊 Fallback calculation: ${dayPrice.baseOccupancyPrice} + (${extraGuests} × ${extraGuestFee}) = ${calculatedPrice}`);
              dailyPrices[dateStr] = calculatedPrice;
            }
          }
        }
        
        // Check minimum stay (only for the first night)
        if (night === 0 && dayPrice.minimumStay > minimumStay) {
          minimumStay = dayPrice.minimumStay;
        }
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Check if minimum stay requirement is met
    const meetsMinimumStay = nights >= minimumStay;
    
    // Calculate pricing if available
    if (allAvailable && meetsMinimumStay) {
      // Calculate booking price with any applicable discounts
      const pricingDetails = calculateBookingPrice(
        dailyPrices,
        property.cleaningFee || 0,
        property.pricingConfig?.lengthOfStayDiscounts as LengthOfStayDiscount[]
      );
      
      // Log the complete pricing response for debugging
      const finalResponse = {
        available: true,
        pricing: {
          ...pricingDetails,
          dailyRates: dailyPrices,
          currency: property.baseCurrency
        }
      };
      
      // Log both naming conventions for debugging
      console.log(`[check-pricing] 📊 Final pricing response for ${guests} guests:`, {
        subtotal: finalResponse.pricing.subtotal,
        totalPrice: finalResponse.pricing.totalPrice,
        total: finalResponse.pricing.total,
        averageNightlyRate: finalResponse.pricing.averageNightlyRate,
        numberOfGuests: guests,
        baseOccupancy: property.baseOccupancy,
        extraGuestFee: property.extraGuestFee,
        dailyRatesSample: Object.entries(dailyPrices).slice(0, 2)
      });
      
      // Log field names for debugging naming inconsistencies
      console.log(`[check-pricing] 🏷️ API FIELD NAMES: pricingDetails fields = [${Object.keys(pricingDetails).join(', ')}]`);
      
      return NextResponse.json(finalResponse);
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
        unavailableDates
      });
    }
  } catch (error) {
    console.error('Error checking pricing:', error);
    return NextResponse.json(
      { error: 'Failed to check pricing' },
      { status: 500 }
    );
  }
}