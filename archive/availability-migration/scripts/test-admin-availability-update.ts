/**
 * Test script to verify admin UI availability updates are working
 * This tests that the updateDay function updates both collections
 */

import { getFirestore } from 'firebase-admin/firestore';
import { getFirestoreForPricing } from '../src/lib/firebaseAdminPricing';
import { format } from 'date-fns';

async function testAdminAvailabilityUpdate() {
  console.log('🧪 Testing Admin Availability Update');
  console.log('=====================================\n');

  const propertyId = 'prahova-mountain-chalet';
  const testDate = '2025-06-05'; // The date with discrepancy
  const [year, month, day] = testDate.split('-');
  
  // Document IDs
  const availabilityDocId = `${propertyId}_${year}-${month}`;
  const priceCalendarDocId = `${propertyId}_${year}-${month}`;

  try {
    const db = await getFirestoreForPricing();
    if (!db) {
      throw new Error('Firebase Admin SDK not available');
    }

    // 1. Check current state in both collections
    console.log('📊 Checking current state...\n');
    
    // Check availability collection
    const availabilityRef = db.collection('availability').doc(availabilityDocId);
    const availabilityDoc = await availabilityRef.get();
    
    if (availabilityDoc.exists) {
      const availData = availabilityDoc.data();
      const dayNum = parseInt(day);
      console.log(`✅ Availability collection (${availabilityDocId}):`);
      console.log(`   Day ${dayNum} available: ${availData?.available?.[dayNum] !== false}`);
      console.log(`   Day ${dayNum} hold: ${availData?.holds?.[dayNum] || 'none'}`);
    } else {
      console.log(`❌ Availability document ${availabilityDocId} not found`);
    }
    
    // Check priceCalendars collection
    const priceCalendarRef = db.collection('priceCalendars').doc(priceCalendarDocId);
    const priceCalendarDoc = await priceCalendarRef.get();
    
    if (priceCalendarDoc.exists) {
      const calData = priceCalendarDoc.data();
      console.log(`\n✅ PriceCalendars collection (${priceCalendarDocId}):`);
      console.log(`   Day ${day} available: ${calData?.days?.[day]?.available}`);
      console.log(`   Day ${day} price: ${calData?.days?.[day]?.baseOccupancyPrice}`);
    } else {
      console.log(`\n❌ PriceCalendar document ${priceCalendarDocId} not found`);
    }
    
    console.log('\n📝 Test Instructions:');
    console.log('1. Go to admin pricing page for this property');
    console.log('2. Navigate to June 2025');
    console.log('3. Click edit on June 5th');
    console.log('4. Toggle availability and save');
    console.log('5. Run this script again to verify both collections updated');
    
    console.log('\n🔗 Admin URL:');
    console.log(`http://localhost:9002/admin/pricing?propertyId=${propertyId}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testAdminAvailabilityUpdate();