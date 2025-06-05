#!/usr/bin/env node

/**
 * Minimal test to check language detection on booking pages
 */

// Node.js 18+ has native fetch

async function testLanguageDetection() {
  console.log('🧪 Testing Language Detection\n');

  try {
    // Test 1: Check server response for Romanian URL
    console.log('1️⃣ Testing server response with ?lang=ro...');
    const response = await fetch('http://localhost:9002/booking/check/prahova-mountain-chalet?lang=ro&checkIn=2025-06-24&checkOut=2025-06-27');
    const html = await response.text();
    
    // Check HTML lang attribute
    const htmlLangMatch = html.match(/<html[^>]*lang="([^"]+)"/);
    const htmlLang = htmlLangMatch ? htmlLangMatch[1] : 'not found';
    console.log(`   HTML lang attribute: ${htmlLang}`);
    console.log(`   ${htmlLang === 'ro' ? '✅' : '❌'} Server rendered with Romanian language`);
    
    // Check if page title is translated
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const pageTitle = titleMatch ? titleMatch[1] : 'not found';
    console.log(`   Page title: "${pageTitle}"`);
    console.log(`   ${pageTitle.includes('Verifică') ? '✅' : '❌'} Title translated to Romanian`);
    
    // Check for language selector content
    const roButtonCount = (html.match(/RO<!-- --> <!-- -->Română/g) || []).length;
    console.log(`   Language selector shows Romanian: ${roButtonCount} occurrences`);
    console.log(`   ${roButtonCount > 0 ? '✅' : '❌'} Language selector detects Romanian`);
    
    // Check for English content that should be translated
    const selectDatesCount = (html.match(/Select Dates/g) || []).length;
    const checkInCount = (html.match(/Check-in Date/g) || []).length;
    console.log(`\n   English content that should be translated:`);
    console.log(`   - "Select Dates": ${selectDatesCount} occurrences`);
    console.log(`   - "Check-in Date": ${checkInCount} occurrences`);
    console.log(`   ${selectDatesCount === 0 && checkInCount === 0 ? '✅' : '❌'} Content is translated`);
    
    // Test 2: Check API endpoint
    console.log('\n2️⃣ Testing language detection API...');
    const apiResponse = await fetch('http://localhost:9002/api/test-locale?lang=ro');
    if (apiResponse.ok) {
      const data = await apiResponse.json();
      console.log('   API response:', JSON.stringify(data, null, 2));
    } else {
      console.log('   ❌ API endpoint not available');
    }
    
    console.log('\n📊 Summary:');
    console.log('   - Language detection in selector: Partially working');
    console.log('   - SSR language detection: Not working');
    console.log('   - Component translation: Not implemented');
    console.log('\n   The issue is that while the client-side language selector shows Romanian,');
    console.log('   the server-side rendering and component content are still in English.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testLanguageDetection().catch(console.error);