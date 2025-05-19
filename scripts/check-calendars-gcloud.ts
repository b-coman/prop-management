import { Firestore } from '@google-cloud/firestore';

async function checkCalendarsGCloud() {
  console.log('🔍 Checking Firestore calendars using Google Cloud SDK...\n');
  
  try {
    // Initialize Firestore with project ID
    const firestore = new Firestore({
      projectId: 'rentalspot-fzwom'
    });
    
    console.log('✅ Firestore initialized for project: rentalspot-fzwom\n');
    
    // Get all documents from priceCalendar collection
    console.log('📅 Fetching price calendars...');
    const snapshot = await firestore.collection('priceCalendar').get();
    
    console.log(`Found ${snapshot.size} calendars:\n`);
    
    const calendarsByProperty = new Map<string, any[]>();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const propertyId = data.propertyId || 'unknown';
      
      if (!calendarsByProperty.has(propertyId)) {
        calendarsByProperty.set(propertyId, []);
      }
      
      calendarsByProperty.get(propertyId)!.push({
        id: doc.id,
        month: data.month,
        dayCount: Object.keys(data.days || {}).length
      });
      
      console.log(`  📄 ${doc.id}`);
      console.log(`     Property: ${propertyId}`);
      console.log(`     Month: ${data.month}`);
      console.log(`     Days: ${Object.keys(data.days || {}).length}`);
      console.log('');
    });
    
    // Show summary by property
    console.log('\n📊 Summary by Property:');
    console.log('======================');
    
    for (const [propertyId, calendars] of calendarsByProperty) {
      console.log(`\n${propertyId}: ${calendars.length} calendars`);
      calendars.sort((a, b) => a.month.localeCompare(b.month));
      for (const cal of calendars) {
        console.log(`  - ${cal.month} (${cal.dayCount} days)`);
      }
    }
    
    // Check specific formats
    console.log('\n🔍 Checking specific calendar IDs:');
    const testIds = [
      'prahova-mountain-chalet_2025_06',   // underscore format
      'prahova-mountain-chalet_2025-06',   // hyphen format
      'coltei-apartment-bucharest_2025_07',
      'coltei-apartment-bucharest_2025-07',
      'prahova-mountain-chalet_2025-05',   // May 2025
      'prahova-mountain-chalet_2024-05'    // May 2024
    ];
    
    for (const testId of testIds) {
      const doc = await firestore.collection('priceCalendar').doc(testId).get();
      console.log(`  ${testId}: ${doc.exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
checkCalendarsGCloud().catch(console.error);