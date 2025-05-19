import { getPropertyWithDb, getPriceCalendarWithDb } from '../src/lib/pricing/pricing-with-db';
import { getMonthsBetweenDates } from '../src/lib/pricing/price-calendar-generator';
import { calculateBookingPrice, LengthOfStayDiscount } from '../src/lib/pricing/price-calculation';
import { differenceInDays, format, parseISO } from 'date-fns';

/**
 * Diagnose the pricing API by replicating its logic directly
 */
async function diagnosePricingApp() {
  const propertyId = 'prahova-mountain-chalet';
  const checkIn = '2025-06-15';
  const checkOut = '2025-06-18';
  const guests = 5;

  console.log('Diagnosing pricing API with direct access...');
  console.log(`Property: ${propertyId}`);
  console.log(`Check-in: ${checkIn}`);
  console.log(`Check-out: ${checkOut}`);
  console.log(`Guests: ${guests}`);
  console.log('---');

  try {
    // Parse dates
    const checkInDate = parseISO(checkIn);
    const checkOutDate = parseISO(checkOut);
    
    // Get property details
    const property = await getPropertyWithDb(propertyId);
    console.log('Property data:', {
      id: property.id,
      pricePerNight: property.pricePerNight,
      baseCurrency: property.baseCurrency,
      baseOccupancy: property.baseOccupancy,
      extraGuestFee: property.extraGuestFee,
    });
    
    // Get number of nights
    const nights = differenceInDays(checkOutDate, checkInDate);
    console.log(`Number of nights: ${nights}`);
    
    // Get all required price calendars
    const months = getMonthsBetweenDates(checkInDate, checkOutDate);
    console.log('Months needed:', months);
    
    const calendars = await Promise.all(
      months.map(async ({ year, month }) => {
        console.log(`Fetching calendar for ${year}-${month.toString().padStart(2, '0')}`);
        const calendar = await getPriceCalendarWithDb(propertyId, year, month);
        
        if (calendar) {
          console.log(`✓ Found calendar: ${calendar.id}, Year: ${calendar.year}, Month: ${calendar.month}`);
          console.log(`  Days in calendar: ${Object.keys(calendar.days || {}).length}`);
        } else {
          console.log(`✗ Calendar not found for ${year}-${month.toString().padStart(2, '0')}`);
        }
        
        return calendar;
      })
    );
    
    // Check if any calendars are missing
    if (calendars.some(calendar => calendar === null)) {
      console.log('Error: Some calendars are missing');
      return;
    }
    
    // Check each date in the range
    const dailyPrices: Record<string, number> = {};
    let allAvailable = true;
    let minimumStay = 1;
    let unavailableDates: string[] = [];
    
    // Check each day
    const currentDate = new Date(checkInDate);
    console.log('\nChecking each day:');
    
    for (let night = 0; night < nights; night++) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const day = currentDate.getDate().toString();
      
      console.log(`\nDay ${night + 1}: ${dateStr} (Year ${year}, Month ${month}, Day ${day})`);
      
      // Find the relevant calendar
      const calendar = calendars.find(c => c?.year === year && c?.month === month);
      console.log(`Found matching calendar: ${calendar?.id || 'None'}`);
      
      if (!calendar || !calendar.days[day]) {
        console.log(`✗ No price information available for ${dateStr}`);
        console.log(`Calendar days keys: ${Object.keys(calendar?.days || {}).join(', ')}`);
        allAvailable = false;
        unavailableDates.push(dateStr);
      } else {
        const dayPrice = calendar.days[day];
        console.log(`Day data: ${JSON.stringify({
          available: dayPrice.available,
          baseOccupancyPrice: dayPrice.baseOccupancyPrice,
          minimumStay: dayPrice.minimumStay,
          prices: dayPrice.prices
        })}`);
        
        // Check availability
        if (!dayPrice.available) {
          console.log(`✗ Day is not available`);
          allAvailable = false;
          unavailableDates.push(dateStr);
        } else {
          // Record price for this date
          if (guests <= property.baseOccupancy) {
            dailyPrices[dateStr] = dayPrice.baseOccupancyPrice;
            console.log(`Price for ${dateStr}: ${dayPrice.baseOccupancyPrice} (base occupancy)`);
          } else {
            const occupancyPrice = dayPrice.prices?.[guests.toString()];
            if (occupancyPrice) {
              dailyPrices[dateStr] = occupancyPrice;
              console.log(`Price for ${dateStr}: ${occupancyPrice} (occupancy ${guests})`);
            } else {
              // Fallback to base price + extra guest fee
              const extraGuests = guests - property.baseOccupancy;
              const calculatedPrice = dayPrice.baseOccupancyPrice + (extraGuests * (property.extraGuestFee || 0));
              dailyPrices[dateStr] = calculatedPrice;
              console.log(`Price for ${dateStr}: ${calculatedPrice} (calculated with extra guest fee)`);
            }
          }
        }
        
        // Check minimum stay (only for the first night)
        if (night === 0 && dayPrice.minimumStay > minimumStay) {
          minimumStay = dayPrice.minimumStay;
          console.log(`Updated minimum stay to ${minimumStay}`);
        }
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Check if minimum stay requirement is met
    const meetsMinimumStay = nights >= minimumStay;
    console.log(`\nMinimum stay: ${minimumStay}, Requested: ${nights}, Meets requirement: ${meetsMinimumStay}`);
    
    console.log(`All dates available: ${allAvailable}`);
    if (!allAvailable) {
      console.log(`Unavailable dates: ${unavailableDates.join(', ')}`);
    }
    
    // Calculate pricing if available
    if (allAvailable && meetsMinimumStay) {
      // Calculate booking price with any applicable discounts
      const pricingDetails = calculateBookingPrice(
        dailyPrices,
        property.cleaningFee || 0,
        property.pricingConfig?.lengthOfStayDiscounts as LengthOfStayDiscount[]
      );
      
      console.log('\nPricing calculation successful:');
      console.log({
        available: true,
        pricing: {
          ...pricingDetails,
          dailyRates: dailyPrices,
          currency: property.baseCurrency
        }
      });
    } else if (!meetsMinimumStay) {
      console.log('\nBooking not available due to minimum stay requirement');
    } else {
      console.log('\nBooking not available due to unavailable dates');
    }
  } catch (error) {
    console.error('Error diagnosing pricing:', error);
  }
}

// Run the diagnostics
diagnosePricingApp().catch(console.error);