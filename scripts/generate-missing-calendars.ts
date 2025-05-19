import { initializeFirebaseAdmin } from '../src/lib/firebaseAdmin';
import { getFirestoreForPricing } from '../src/lib/firebaseAdminPricing';
import { updatePriceCalendarsForProperty } from '../src/lib/pricing/price-calendar-generator';
import { format, startOfMonth, getDaysInMonth } from 'date-fns';

async function generateMissingCalendars() {
  console.log('🔧 Generating Missing Price Calendars...\n');
  
  try {
    // Initialize Firebase Admin
    await initializeFirebaseAdmin();
    const db = await getFirestoreForPricing();
    
    if (!db) {
      console.error('❌ Failed to initialize Firebase Admin');
      return;
    }
    
    console.log('✅ Firebase Admin initialized\n');
    
    // Properties to generate calendars for
    const properties = [
      { id: 'prahova-mountain-chalet', name: 'Prahova Mountain Chalet' },
      { id: 'coltei-apartment-bucharest', name: 'Coltei Apartment Bucharest' }
    ];
    
    // Generate calendars for the next 12 months
    const monthsToGenerate = 12;
    
    for (const property of properties) {
      console.log(`\n📍 Processing ${property.name} (${property.id})...`);
      
      // Get property data
      const propertyDoc = await db.collection('properties').doc(property.id).get();
      if (!propertyDoc.exists) {
        console.error(`❌ Property ${property.id} not found`);
        continue;
      }
      
      const propertyData = propertyDoc.data()!;
      const currentDate = new Date();
      
      for (let i = 0; i < monthsToGenerate; i++) {
        const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth() + 1;
        const monthStr = month.toString().padStart(2, '0');
        const calendarId = `${property.id}_${year}_${monthStr}`;
        
        // Check if calendar already exists
        const existingCalendar = await db.collection('priceCalendar').doc(calendarId).get();
        
        if (!existingCalendar.exists) {
          console.log(`   Creating calendar for ${format(monthDate, 'MMMM yyyy')}...`);
          
          // Create the calendar
          const daysInMonth = getDaysInMonth(monthDate);
          const days: Record<string, any> = {};
          
          for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = new Date(year, month - 1, day);
            const dayOfWeek = dayDate.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
            
            // Base price calculation
            let basePrice = propertyData.pricePerNight || 100;
            
            // Apply weekend pricing if enabled
            if (isWeekend && propertyData.pricing?.weekendPricing?.enabled) {
              basePrice *= propertyData.pricing.weekendPricing.priceMultiplier || 1.2;
            }
            
            days[day.toString()] = {
              available: true,
              baseOccupancyPrice: basePrice,
              prices: {
                '1': basePrice - (propertyData.extraGuestFee || 0),
                '2': basePrice,
                '3': basePrice + (propertyData.extraGuestFee || 0),
                '4': basePrice + (2 * (propertyData.extraGuestFee || 0)),
                '5': basePrice + (3 * (propertyData.extraGuestFee || 0)),
                '6': basePrice + (4 * (propertyData.extraGuestFee || 0)),
                '7': basePrice + (5 * (propertyData.extraGuestFee || 0)),
                '8': basePrice + (6 * (propertyData.extraGuestFee || 0))
              },
              minimumStay: 1,
              createdAt: new Date(),
              updatedAt: new Date()
            };
          }
          
          const calendar = {
            id: calendarId,
            propertyId: property.id,
            month: `${year}-${monthStr}`,
            days,
            createdAt: new Date(),
            updatedAt: new Date(),
            generatedBy: 'missing-calendar-generator'
          };
          
          await db.collection('priceCalendar').doc(calendarId).set(calendar);
          console.log(`   ✅ Created calendar ${calendarId}`);
        } else {
          console.log(`   ⏩ Calendar for ${format(monthDate, 'MMMM yyyy')} already exists`);
        }
      }
    }
    
    console.log('\n✅ Calendar generation complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
generateMissingCalendars().catch(console.error);