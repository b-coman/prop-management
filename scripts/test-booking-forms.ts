#!/usr/bin/env node
import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';

// Load environment variables
config();

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Test booking form submissions by checking recent entries in Firestore
 */
async function testBookingForms() {
  console.log('🧪 Testing Booking Forms Functionality\n');
  
  const testResults = {
    inquiries: { passed: false, count: 0, recent: [] as any[] },
    holdBookings: { passed: false, count: 0, recent: [] as any[] },
    bookings: { passed: false, count: 0, recent: [] as any[] }
  };

  // Test 1: Check inquiries collection
  console.log('📧 Testing Contact Form (Inquiries)...');
  try {
    const inquiriesQuery = query(
      collection(db, 'inquiries'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const inquiriesSnapshot = await getDocs(inquiriesQuery);
    
    testResults.inquiries.count = inquiriesSnapshot.size;
    testResults.inquiries.passed = inquiriesSnapshot.size > 0;
    
    inquiriesSnapshot.forEach(doc => {
      const data = doc.data();
      testResults.inquiries.recent.push({
        id: doc.id,
        property: data.propertyId,
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        status: data.status,
        created: data.createdAt ? format(data.createdAt.toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A'
      });
    });
    
    console.log(`  ✓ Found ${testResults.inquiries.count} recent inquiries`);
    if (testResults.inquiries.recent.length > 0) {
      console.log('  Most recent inquiry:', testResults.inquiries.recent[0]);
    }
  } catch (error) {
    console.error('  ✗ Error checking inquiries:', error);
    testResults.inquiries.passed = false;
  }

  // Test 2: Check bookings collection for hold bookings
  console.log('\n⏰ Testing Hold Form (Hold Bookings)...');
  try {
    const holdQuery = query(
      collection(db, 'bookings'),
      where('isHoldBooking', '==', true),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const holdSnapshot = await getDocs(holdQuery);
    
    testResults.holdBookings.count = holdSnapshot.size;
    testResults.holdBookings.passed = holdSnapshot.size > 0;
    
    holdSnapshot.forEach(doc => {
      const data = doc.data();
      testResults.holdBookings.recent.push({
        id: doc.id,
        property: data.propertyId,
        name: `${data.guestInfo?.firstName} ${data.guestInfo?.lastName}`,
        email: data.guestInfo?.email,
        status: data.status,
        holdExpires: data.holdExpirationDate ? format(data.holdExpirationDate.toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
        created: data.createdAt ? format(data.createdAt.toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A'
      });
    });
    
    console.log(`  ✓ Found ${testResults.holdBookings.count} recent hold bookings`);
    if (testResults.holdBookings.recent.length > 0) {
      console.log('  Most recent hold:', testResults.holdBookings.recent[0]);
    }
  } catch (error) {
    console.error('  ✗ Error checking hold bookings:', error);
    testResults.holdBookings.passed = false;
  }

  // Test 3: Check confirmed bookings
  console.log('\n💳 Testing Booking Form (Full Bookings)...');
  try {
    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('status', '==', 'confirmed'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const bookingsSnapshot = await getDocs(bookingsQuery);
    
    testResults.bookings.count = bookingsSnapshot.size;
    testResults.bookings.passed = bookingsSnapshot.size > 0;
    
    bookingsSnapshot.forEach(doc => {
      const data = doc.data();
      testResults.bookings.recent.push({
        id: doc.id,
        property: data.propertyId,
        name: `${data.guestInfo?.firstName} ${data.guestInfo?.lastName}`,
        email: data.guestInfo?.email,
        checkIn: data.checkInDate ? format(data.checkInDate.toDate(), 'yyyy-MM-dd') : 'N/A',
        checkOut: data.checkOutDate ? format(data.checkOutDate.toDate(), 'yyyy-MM-dd') : 'N/A',
        total: `${data.pricing?.currency || 'N/A'} ${data.pricing?.total || 0}`,
        created: data.createdAt ? format(data.createdAt.toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A'
      });
    });
    
    console.log(`  ✓ Found ${testResults.bookings.count} recent confirmed bookings`);
    if (testResults.bookings.recent.length > 0) {
      console.log('  Most recent booking:', testResults.bookings.recent[0]);
    }
  } catch (error) {
    console.error('  ✗ Error checking bookings:', error);
    testResults.bookings.passed = false;
  }

  // Summary
  console.log('\n📊 Test Summary:');
  console.log('=================');
  console.log(`Contact Form: ${testResults.inquiries.passed ? '✅ PASSED' : '❌ FAILED'} (${testResults.inquiries.count} entries)`);
  console.log(`Hold Form: ${testResults.holdBookings.passed ? '✅ PASSED' : '❌ FAILED'} (${testResults.holdBookings.count} entries)`);
  console.log(`Booking Form: ${testResults.bookings.passed ? '✅ PASSED' : '❌ FAILED'} (${testResults.bookings.count} entries)`);
  
  const allPassed = testResults.inquiries.passed && testResults.holdBookings.passed && testResults.bookings.passed;
  console.log(`\nOverall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  // Detailed results
  console.log('\n📝 Detailed Results:');
  console.log(JSON.stringify(testResults, null, 2));
  
  return allPassed;
}

// Run the tests
testBookingForms()
  .then(passed => {
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });