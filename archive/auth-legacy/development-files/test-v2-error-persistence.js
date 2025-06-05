/**
 * Browser Test Script for V2 Booking System Error Persistence Fix
 * 
 * This script tests whether the V2 booking system properly clears pricing errors
 * when user changes dates from invalid to valid selections.
 * 
 * Usage: Run this script in the browser console on the booking page
 */

(async function testV2ErrorPersistence() {
  console.log('🚀 Starting V2 Error Persistence Test');
  console.log('====================================');
  
  // Helper function to wait for elements
  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }
  
  // Helper function to wait for a specific time
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Check if V2 is running by looking for [V2] logs
  console.log('1. Checking for V2 system indicators...');
  
  // Look for V2 logs in console (this would have been logged during page load)
  const hasV2Logs = performance.getEntriesByType('navigation').length > 0;
  
  // Check for V2-specific elements
  const v2Indicators = [
    '[class*="booking-v2"]',
    '[data-v2]',
    '.booking-page-v2'
  ];
  
  let isV2Running = false;
  for (const selector of v2Indicators) {
    if (document.querySelector(selector)) {
      isV2Running = true;
      break;
    }
  }
  
  // Check for BookingProvider in React DevTools (if available)
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__ && window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers) {
    console.log('✅ React DevTools detected - V2 BookingProvider should be visible in Components tab');
    isV2Running = true;
  }
  
  console.log(`V2 Status: ${isV2Running ? '✅ V2 DETECTED' : '❌ V1 or Unknown'}`);
  
  // Test steps
  console.log('\\n2. Testing error persistence fix...');
  
  try {
    // Step 1: Navigate to error scenario (June 5th is unavailable)
    console.log('Step 1: Simulating navigation to dates with unavailable date (June 5th)...');
    
    // Update URL to trigger error scenario
    const errorUrl = new URL(window.location);
    errorUrl.searchParams.set('checkIn', '2025-06-05');
    errorUrl.searchParams.set('checkOut', '2025-06-08');
    
    // Apply URL changes without navigation
    history.pushState({}, '', errorUrl.toString());
    
    // Trigger a popstate event to simulate URL-based date change
    window.dispatchEvent(new PopStateEvent('popstate'));
    
    console.log('   URL updated to:', errorUrl.toString());
    
    // Wait for error to appear
    await wait(2000);
    
    // Step 2: Check for error message
    console.log('Step 2: Looking for error message...');
    
    const errorSelectors = [
      '[class*="error"]',
      '[class*="alert"]',
      'p:contains("not available")',
      'div:contains("not available")',
      '[role="alert"]'
    ];
    
    let errorElement = null;
    for (const selector of errorSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (el.textContent.includes('available') || el.textContent.includes('error')) {
          errorElement = el;
          break;
        }
      }
      if (errorElement) break;
    }
    
    if (errorElement) {
      console.log('✅ Error message found:', errorElement.textContent);
    } else {
      console.log('⚠️ No error message found - may have loaded too quickly or error handling different');
    }
    
    // Step 3: Change to available dates
    console.log('\\nStep 3: Changing to available dates (June 8-10)...');
    
    const goodUrl = new URL(window.location);
    goodUrl.searchParams.set('checkIn', '2025-06-08');
    goodUrl.searchParams.set('checkOut', '2025-06-10');
    
    history.pushState({}, '', goodUrl.toString());
    window.dispatchEvent(new PopStateEvent('popstate'));
    
    console.log('   URL updated to:', goodUrl.toString());
    
    // Wait for new pricing calculation
    await wait(3000);
    
    // Step 4: Check if error persists or is cleared
    console.log('Step 4: Checking if error persists...');
    
    // Look for "Calculating your price..." or similar loading state
    const loadingSelectors = [
      'text*="Calculating"',
      '[class*="loading"]',
      '[class*="spinner"]'
    ];
    
    let hasLoadingState = false;
    for (const selector of loadingSelectors) {
      const elements = document.querySelectorAll('*');
      for (const el of elements) {
        if (el.textContent.includes('Calculating') || el.textContent.includes('Loading')) {
          hasLoadingState = true;
          console.log('✅ Loading state detected:', el.textContent);
          break;
        }
      }
      if (hasLoadingState) break;
    }
    
    // Check if error still exists
    let errorStillExists = false;
    for (const selector of errorSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (el.textContent.includes('available') || el.textContent.includes('error')) {
          errorStillExists = true;
          console.log('❌ Error still persists:', el.textContent);
          break;
        }
      }
      if (errorStillExists) break;
    }
    
    // Look for pricing display instead
    let hasPricing = false;
    const pricingSelectors = ['*[class*="price"]', '*[class*="total"]', '*[class*="summary"]'];
    for (const selector of pricingSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (el.textContent.includes('€') || el.textContent.includes('$') || el.textContent.includes('Total')) {
          hasPricing = true;
          console.log('✅ Pricing display found:', el.textContent.trim());
          break;
        }
      }
      if (hasPricing) break;
    }
    
    // Summary
    console.log('\\n=== TEST RESULTS ===');
    console.log(`V2 System Running: ${isV2Running ? '✅ YES' : '❌ NO/UNKNOWN'}`);
    console.log(`Error Clearing: ${!errorStillExists ? '✅ WORKING' : '❌ NOT WORKING'}`);
    console.log(`Loading State Shown: ${hasLoadingState ? '✅ YES' : '❌ NO'}`);
    console.log(`Pricing Display: ${hasPricing ? '✅ YES' : '❌ NO'}`);
    
    // Check console for V2 logs
    console.log('\\n=== CHECKING FOR V2 CONSOLE LOGS ===');
    console.log('Look for logs starting with "[V2]" in the console above');
    console.log('V2 logs should include:');
    console.log('- "[V2] fetchPricing called"');
    console.log('- "[V2] Pricing fetched successfully"');
    console.log('- Messages about clearing pricing data and errors');
    
    const verdict = isV2Running && !errorStillExists && (hasLoadingState || hasPricing);
    console.log(`\\n🎯 OVERALL VERDICT: ${verdict ? '✅ TEST PASSED' : '❌ TEST FAILED'}`);
    
    if (verdict) {
      console.log('✅ V2 error persistence fix appears to be working correctly');
    } else {
      console.log('❌ Issues detected - please check individual test results above');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
  
  console.log('\\n🏁 Test completed');
})();