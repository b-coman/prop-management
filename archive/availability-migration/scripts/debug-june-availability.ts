import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Set emulator before initializing
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

async function debugJuneAvailability() {
  try {
    // Initialize admin app
    const app = initializeApp({
      projectId: 'rentalspot-dev'
    });
    
    const db = getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true });

    console.log('=== Debugging June 2025 Availability ===\n');

    // Check availability collection
    console.log('1. Checking availability collection:');
    const availDoc = await db.collection('availability').doc('prahova-mountain-chalet_2025-06').get();
    if (availDoc.exists) {
      const data = availDoc.data()!;
      console.log('   - Document exists');
      console.log('   - Available map:', data.available || 'Not found');
      console.log('   - Holds map:', data.holds || 'Not found');
      
      // Check specific dates
      if (data.available) {
        console.log('\n   Checking specific dates:');
        for (let day = 4; day <= 7; day++) {
          console.log(`   - June ${day}: available = ${data.available[day]}`);
        }
      }
    } else {
      console.log('   - Document NOT found');
    }

    // Check priceCalendars collection
    console.log('\n2. Checking priceCalendars collection:');
    const priceDoc = await db.collection('priceCalendars').doc('prahova-mountain-chalet_2025-06').get();
    if (priceDoc.exists) {
      const data = priceDoc.data()!;
      console.log('   - Document exists');
      console.log('   - Has days field:', !!data.days);
      
      // Check specific dates
      if (data.days) {
        console.log('\n   Checking specific dates:');
        for (let day = 4; day <= 7; day++) {
          const dayData = data.days[day.toString()];
          if (dayData) {
            console.log(`   - June ${day}: available = ${dayData.available}, price = ${dayData.baseOccupancyPrice}`);
          } else {
            console.log(`   - June ${day}: No data`);
          }
        }
      }
    } else {
      console.log('   - Document NOT found');
    }

    console.log('\n=== End Debug ===');
  } catch (error) {
    console.error('Error:', error);
  }
}

debugJuneAvailability();