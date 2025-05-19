import { initializeFirebaseAdmin } from '../src/lib/firebaseAdmin';
import { getFirestoreForPricing } from '../src/lib/firebaseAdminPricing';
import { format, addMonths, startOfMonth } from 'date-fns';

async function debugPricingCalendars() {
  console.log('🔍 Debugging Pricing Calendars...\n');
  
  try {
    // Initialize Firebase Admin
    await initializeFirebaseAdmin();
    const db = await getFirestoreForPricing();
    
    if (!db) {
      console.error('❌ Failed to initialize Firebase Admin');
      return;
    }
    
    console.log('✅ Firebase Admin initialized\n');
    
    // Get all properties
    const propertiesSnapshot = await db.collection('properties').get();
    console.log(`Found ${propertiesSnapshot.size} properties:\n`);
    
    for (const propertyDoc of propertiesSnapshot.docs) {
      const propertyId = propertyDoc.id;
      const propertyData = propertyDoc.data();
      
      console.log(`\n📍 Property: ${propertyId}`);
      console.log(`   Name: ${propertyData.name}`);
      console.log(`   Base Price: ${propertyData.pricePerNight} ${propertyData.baseCurrency}`);
      
      // Check price calendars for the next 12 months
      const currentDate = new Date();
      const missingCalendars = [];
      const existingCalendars = [];
      
      for (let i = 0; i < 12; i++) {
        const monthDate = addMonths(startOfMonth(currentDate), i);
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth() + 1;
        const monthStr = month.toString().padStart(2, '0');
        const calendarId = `${propertyId}_${year}_${monthStr}`;
        
        const calendarDoc = await db.collection('priceCalendar').doc(calendarId).get();
        
        if (!calendarDoc.exists) {
          missingCalendars.push({
            id: calendarId,
            year,
            month: monthStr,
            monthName: format(monthDate, 'MMMM yyyy')
          });
        } else {
          const calendarData = calendarDoc.data();
          existingCalendars.push({
            id: calendarId,
            year,
            month: monthStr,
            monthName: format(monthDate, 'MMMM yyyy'),
            dayCount: Object.keys(calendarData.days || {}).length
          });
        }
      }
      
      console.log(`\n   ✅ Existing calendars (${existingCalendars.length}):`);
      for (const cal of existingCalendars) {
        console.log(`      - ${cal.monthName} (${cal.dayCount} days)`);
      }
      
      if (missingCalendars.length > 0) {
        console.log(`\n   ❌ Missing calendars (${missingCalendars.length}):`);
        for (const cal of missingCalendars) {
          console.log(`      - ${cal.monthName} (${cal.id})`);
        }
      }
      
      // Check seasonal pricing
      const seasonalPricingSnapshot = await db.collection('seasonalPricing')
        .where('propertyId', '==', propertyId)
        .get();
      
      console.log(`\n   📅 Seasonal pricing rules: ${seasonalPricingSnapshot.size}`);
      
      for (const seasonDoc of seasonalPricingSnapshot.docs) {
        const seasonData = seasonDoc.data();
        console.log(`      - ${seasonData.name}: ${seasonData.startDate} to ${seasonData.endDate}`);
      }
      
      // Check date overrides
      const dateOverridesSnapshot = await db.collection('dateOverrides')
        .where('propertyId', '==', propertyId)
        .get();
      
      console.log(`\n   🔄 Date overrides: ${dateOverridesSnapshot.size}`);
      
      for (const overrideDoc of dateOverridesSnapshot.docs) {
        const overrideData = overrideDoc.data();
        console.log(`      - ${overrideData.name}: ${overrideData.startDate} to ${overrideData.endDate}`);
      }
    }
    
    // Summary
    console.log('\n\n📊 Summary:');
    console.log('===============');
    
    // Check priceCalendar collection size
    const allCalendarsSnapshot = await db.collection('priceCalendar').get();
    console.log(`Total price calendars in database: ${allCalendarsSnapshot.size}`);
    
    // Group by property
    const calendarsByProperty = new Map();
    for (const doc of allCalendarsSnapshot.docs) {
      const data = doc.data();
      const propertyId = data.propertyId;
      if (!calendarsByProperty.has(propertyId)) {
        calendarsByProperty.set(propertyId, []);
      }
      calendarsByProperty.get(propertyId).push(doc.id);
    }
    
    console.log('\nCalendars per property:');
    for (const [propertyId, calendars] of calendarsByProperty) {
      console.log(`  ${propertyId}: ${calendars.length} calendars`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
debugPricingCalendars().catch(console.error);