/**
 * Test script to verify hero image fetching with Admin SDK
 */

import { getCompletePropertyData, getPropertyHeroImageWithAdmin } from '../src/lib/server/property-data';

async function testHeroImageFetch() {
  console.log('🧪 Testing Hero Image Fetch with Admin SDK\n');
  
  const testSlug = 'prahova-mountain-chalet';
  
  try {
    // Test 1: Direct hero image fetch
    console.log('Test 1: Direct hero image fetch');
    const heroImage = await getPropertyHeroImageWithAdmin(testSlug);
    console.log(`✅ Hero image: ${heroImage || 'Not found'}\n`);
    
    // Test 2: Complete property data fetch
    console.log('Test 2: Complete property data fetch');
    const completeData = await getCompletePropertyData(testSlug);
    console.log(`✅ Property: ${completeData.property?.name || 'Not found'}`);
    console.log(`✅ Hero image: ${completeData.heroImage || 'Not found'}`);
    console.log(`✅ Theme: ${completeData.theme || 'Not found'}`);
    console.log(`✅ Has overrides: ${!!completeData.overrides}`);
    console.log(`✅ Has template: ${!!completeData.template}\n`);
    
    // Test 3: Check overrides structure
    if (completeData.overrides) {
      console.log('Test 3: Overrides structure');
      console.log(`✅ Homepage hero exists: ${!!completeData.overrides.homepage?.hero}`);
      console.log(`✅ Background image path: ${completeData.overrides.homepage?.hero?.backgroundImage || 'Not found'}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
  
  console.log('\n✅ All tests passed!');
  process.exit(0);
}

// Run the test
testHeroImageFetch();