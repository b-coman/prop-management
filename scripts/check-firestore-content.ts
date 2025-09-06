// Script to fetch and display current Firestore content
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

async function checkFirestoreContent() {
  console.log('🔍 Fetching Firestore data for prahova-mountain-chalet...\n');
  
  try {
    // Fetch propertyOverrides document
    console.log('📄 PROPERTY OVERRIDES COLLECTION:');
    console.log('================================');
    const overridesRef = doc(db, 'propertyOverrides', 'prahova-mountain-chalet');
    const overridesSnap = await getDoc(overridesRef);
    
    if (overridesSnap.exists()) {
      const overridesData = overridesSnap.data();
      
      // Check homepage content
      console.log('\n🏠 HOMEPAGE CONTENT:');
      console.log('-------------------');
      
      // Hero Section
      console.log('\n📍 Hero Section:');
      console.log('  Title EN:', overridesData.homepage?.hero?.title?.en);
      console.log('  Title RO:', overridesData.homepage?.hero?.title?.ro);
      console.log('  Subtitle EN:', overridesData.homepage?.hero?.subtitle?.en);
      console.log('  Subtitle RO:', overridesData.homepage?.hero?.subtitle?.ro);
      
      // Experience Section
      console.log('\n📍 Experience Section:');
      console.log('  Title EN:', overridesData.homepage?.experience?.title?.en);
      console.log('  Title RO:', overridesData.homepage?.experience?.title?.ro);
      console.log('  Description EN:', overridesData.homepage?.experience?.description?.en?.substring(0, 50) + '...');
      console.log('  Description RO:', overridesData.homepage?.experience?.description?.ro?.substring(0, 50) + '...');
      
      // Check if highlights have translations
      const highlights = overridesData.homepage?.experience?.highlights || [];
      console.log('\n  Highlights:');
      highlights.forEach((h: any, i: number) => {
        console.log(`    ${i+1}. ${h.title?.en} / ${h.title?.ro}`);
        console.log(`       EN: ${h.description?.en}`);
        console.log(`       RO: ${h.description?.ro}`);
      });
      
      // Host Section
      console.log('\n📍 Host Section:');
      console.log('  Description EN:', overridesData.homepage?.host?.description?.en);
      console.log('  Description RO:', overridesData.homepage?.host?.description?.ro);
      console.log('  Backstory type:', typeof overridesData.homepage?.host?.backstory);
      if (typeof overridesData.homepage?.host?.backstory === 'object') {
        console.log('  Backstory EN:', overridesData.homepage?.host?.backstory?.en?.substring(0, 50) + '...');
        console.log('  Backstory RO:', overridesData.homepage?.host?.backstory?.ro?.substring(0, 50) + '...');
      } else {
        console.log('  Backstory (string only):', overridesData.homepage?.host?.backstory?.substring(0, 50) + '...');
      }
      
      // Features
      console.log('\n📍 Features:');
      const features = overridesData.homepage?.features || [];
      features.forEach((f: any, i: number) => {
        console.log(`  ${i+1}. ${f.title?.en} / ${f.title?.ro}`);
      });
      
      // CTA Section
      console.log('\n📍 CTA Section:');
      console.log('  Title EN:', overridesData.homepage?.cta?.title?.en);
      console.log('  Title RO:', overridesData.homepage?.cta?.title?.ro);
      console.log('  Button EN:', overridesData.homepage?.cta?.buttonText?.en);
      console.log('  Button RO:', overridesData.homepage?.cta?.buttonText?.ro);
      
    } else {
      console.log('❌ propertyOverrides document not found!');
    }
    
    // Fetch properties document
    console.log('\n\n📄 PROPERTIES COLLECTION:');
    console.log('=========================');
    const propertyRef = doc(db, 'properties', 'prahova-mountain-chalet');
    const propertySnap = await getDoc(propertyRef);
    
    if (propertySnap.exists()) {
      const propertyData = propertySnap.data();
      
      console.log('\n📍 Basic Property Info:');
      console.log('  Name type:', typeof propertyData.name);
      if (typeof propertyData.name === 'object') {
        console.log('  Name EN:', propertyData.name.en);
        console.log('  Name RO:', propertyData.name.ro);
      } else {
        console.log('  Name (string):', propertyData.name);
      }
      
      console.log('\n  Description type:', typeof propertyData.description);
      if (typeof propertyData.description === 'object') {
        console.log('  Description EN:', propertyData.description.en?.substring(0, 50) + '...');
        console.log('  Description RO:', propertyData.description.ro?.substring(0, 50) + '...');
      } else {
        console.log('  Description (string):', propertyData.description?.substring(0, 50) + '...');
      }
      
      console.log('\n  Short Description type:', typeof propertyData.shortDescription);
      if (typeof propertyData.shortDescription === 'object') {
        console.log('  Short Description EN:', propertyData.shortDescription.en);
        console.log('  Short Description RO:', propertyData.shortDescription.ro);
      } else {
        console.log('  Short Description (string):', propertyData.shortDescription);
      }
      
    } else {
      console.log('❌ properties document not found!');
    }
    
    console.log('\n\n✅ Firestore check complete!');
    
  } catch (error) {
    console.error('❌ Error fetching Firestore data:', error);
  }
  
  process.exit(0);
}

// Run the check
checkFirestoreContent();