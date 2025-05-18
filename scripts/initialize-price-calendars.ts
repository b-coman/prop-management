import { db } from '../src/lib/firebaseAdmin';
import { updatePriceCalendarsForProperty } from '../src/lib/pricing/price-calendar-generator';

/**
 * This script initializes price calendars for all active properties
 * It should be run after setting up the new pricing schema
 */
async function initializePriceCalendars() {
  try {
    console.log('Starting price calendar initialization...');
    
    // Get all active properties
    const propertiesSnapshot = await db.collection('properties')
      .where('status', '==', 'active')
      .get();
    
    console.log(`Found ${propertiesSnapshot.size} active properties to process`);
    
    // We'll process properties sequentially to avoid overloading Firestore
    // In a production environment with many properties, you might want to use batching
    // or a queue system to manage this process
    let successCount = 0;
    let failureCount = 0;
    
    for (const doc of propertiesSnapshot.docs) {
      const property = doc.data();
      console.log(`Processing property: ${property.id} (${property.name})`);
      
      try {
        // Generate price calendars for the next 12 months
        await updatePriceCalendarsForProperty(doc.id, 12);
        console.log(`Successfully generated price calendars for ${property.id}`);
        successCount++;
      } catch (error) {
        console.error(`Failed to generate price calendars for ${property.id}:`, error);
        failureCount++;
      }
      
      // Small delay to avoid potential rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('Price calendar initialization completed:');
    console.log(`- Success: ${successCount} properties`);
    console.log(`- Failure: ${failureCount} properties`);
    
  } catch (error) {
    console.error('Error in price calendar initialization:', error);
    throw error;
  }
}

/**
 * Checks if price calendars already exist for a property
 * This can be used to avoid regenerating calendars that already exist
 */
async function checkExistingCalendars(propertyId: string): Promise<boolean> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStr = month.toString().padStart(2, '0');
  
  const calendarId = `${propertyId}_${year}-${monthStr}`;
  const calendarDoc = await db.collection('priceCalendar').doc(calendarId).get();
  
  return calendarDoc.exists;
}

/**
 * Initialize price calendars for a single property
 * Useful for testing or updating a specific property
 */
async function initializePropertyCalendars(propertyId: string) {
  try {
    console.log(`Initializing price calendars for property ${propertyId}`);
    
    // Check if this property already has price calendars
    const hasExistingCalendars = await checkExistingCalendars(propertyId);
    
    if (hasExistingCalendars) {
      console.log(`Property ${propertyId} already has price calendars. Use --force to regenerate.`);
      return;
    }
    
    // Generate calendars for the next 12 months
    await updatePriceCalendarsForProperty(propertyId, 12);
    console.log(`Successfully generated price calendars for ${propertyId}`);
    
  } catch (error) {
    console.error(`Failed to initialize price calendars for ${propertyId}:`, error);
    throw error;
  }
}

// Handle command line arguments
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage:');
    console.log('  npm run initialize-price-calendars                     # Process all active properties');
    console.log('  npm run initialize-price-calendars -- --property=id    # Process a specific property');
    console.log('  npm run initialize-price-calendars -- --force          # Force regeneration even if calendars exist');
    return;
  }
  
  const propertyArg = args.find(arg => arg.startsWith('--property='));
  const forceArg = args.includes('--force');
  
  if (propertyArg) {
    const propertyId = propertyArg.split('=')[1];
    await initializePropertyCalendars(propertyId);
  } else {
    await initializePriceCalendars();
  }
}

// Check if being run directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('Price calendar initialization completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Price calendar initialization failed:', error);
      process.exit(1);
    });
}

export { initializePriceCalendars, initializePropertyCalendars };