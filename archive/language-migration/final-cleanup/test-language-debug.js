// Test script to check language detection
// Run this in browser console on: http://localhost:9002/booking/check/prahova-mountain-chalet?lang=ro&checkIn=2025-06-24&checkOut=2025-06-27

console.log('🔍 Language Debug Test');
console.log('=====================');

// Check URL parameters
const urlParams = new URLSearchParams(window.location.search);
console.log('📍 Current URL:', window.location.href);
console.log('📍 Search params:', urlParams.toString());
console.log('📍 Lang param:', urlParams.get('lang'));
console.log('📍 Language param:', urlParams.get('language'));

// Check if language system is loaded
console.log('🌐 Language system check:');
console.log('- SUPPORTED_LANGUAGES available:', window.SUPPORTED_LANGUAGES ? 'Yes' : 'No');

// Test manual translation function call
setTimeout(() => {
  console.log('🧪 Testing translation functions:');
  
  // Try to access React context if available
  const reactRoot = document.querySelector('#__next, [data-reactroot]');
  if (reactRoot) {
    console.log('⚛️ React root found');
    
    // Check for text that should be translated
    const selectDatesButton = document.querySelector('button:has-text("Select your dates"), button[aria-label*="Select"]');
    if (selectDatesButton) {
      console.log('🎯 Found select dates button:', selectDatesButton.textContent);
    }
    
    // Check for Romanian text
    const romanianText = document.body.textContent.includes('Selectează');
    console.log('🇷🇴 Romanian text present:', romanianText);
    
    // Look for language selector
    const langSelector = document.querySelector('[data-testid="language-selector"], button:contains("EN"), button:contains("RO")');
    if (langSelector) {
      console.log('🌐 Language selector found:', langSelector.textContent);
    }
  }
}, 1000);