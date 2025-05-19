import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function checkCalendarsLocal() {
  console.log('🔍 Checking Firestore calendars locally...\n');
  
  try {
    // Initialize Firebase Admin with service account from env
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    let serviceAccount;
    if (serviceAccountEnv) {
      console.log('Using service account from environment variable');
      serviceAccount = JSON.parse(serviceAccountEnv);
    } else {
      // Try to load from file as fallback
      const serviceAccountPath = path.join(process.cwd(), 'firebase-admin', 'serviceAccountKey.json');
      if (fs.existsSync(serviceAccountPath)) {
        console.log('Using service account from file');
        serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      } else {
        console.error('❌ No service account found in env or file');
        return;
      }
    }
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    }
    
    const db = admin.firestore();
    console.log('✅ Firebase Admin initialized\n');
    
    // Get all documents from priceCalendar collection
    console.log('📅 Fetching price calendars...');
    const snapshot = await db.collection('priceCalendar').get();
    
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
        dayCount: Object.keys(data.days || {}).length,
        generatedBy: data.generatedBy,
        updatedAt: data.updatedAt
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
      'coltei-apartment-bucharest_2025-07'
    ];
    
    for (const testId of testIds) {
      const doc = await db.collection('priceCalendar').doc(testId).get();
      console.log(`  ${testId}: ${doc.exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
checkCalendarsLocal().catch(console.error);