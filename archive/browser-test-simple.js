/**
 * Simple Browser Test Script for Pricing and Availability
 * 
 * This is a simplified version of the test script that focuses on directly
 * testing specific scenarios without a UI. Just paste this into the browser
 * console and it will run all tests automatically.
 * 
 * Usage:
 * 1. Navigate to a booking page in your browser (e.g., http://localhost:9002/booking/check/prahova-mountain-chalet)
 * 2. Open the browser console (F12 or right-click > Inspect > Console)
 * 3. Paste this entire script and press Enter
 */

(async function() {
  console.log('Starting simple pricing and availability tests...');
  
  // Extract the property slug from the URL
  let propertySlug;
  
  // Check if we're on a booking check page
  if (document.location.pathname.includes('/booking/check/')) {
    propertySlug = document.location.pathname.split('/').filter(Boolean)[2];
  } 
  // Or on a property page
  else if (document.location.pathname.includes('/properties/')) {
    propertySlug = document.location.pathname.split('/').filter(Boolean)[1];
  }
  
  if (!propertySlug) {
    console.error('This script must be run on a booking check page or property page');
    return;
  }
  
  console.log(`Detected property slug: ${propertySlug}`);
  
  // Helper to format dates
  function formatDate(date) {
    return date.toISOString().split('T')[0];
  }
  
  // Create test dates for various scenarios
  const today = new Date();
  
  // API Helper to directly check pricing
  async function checkPricing(checkIn, checkOut, guests) {
    try {
      console.log(`Checking pricing: ${formatDate(checkIn)} to ${formatDate(checkOut)} with ${guests} guests`);
      
      const response = await fetch('/api/check-pricing-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: propertySlug,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          guests: guests
        })
      });
      
      const data = await response.json();
      console.log('API Response:', data);
      return data;
    } catch (error) {
      console.error('API Error:', error);
      return null;
    }
  }
  
  // Test 1: Weekend stay (likely higher prices)
  async function testWeekendPricing() {
    console.log('\n\n🔍 Test 1: Weekend Pricing Test');
    
    // Find next Friday and Sunday
    let nextFriday = new Date(today);
    while (nextFriday.getDay() !== 5) {
      nextFriday.setDate(nextFriday.getDate() + 1);
    }
    
    const nextSunday = new Date(nextFriday);
    nextSunday.setDate(nextSunday.getDate() + 2);
    
    const result = await checkPricing(nextFriday, nextSunday, 2);
    
    if (result && result.available && result.pricing) {
      console.log(`Weekend stay (${formatDate(nextFriday)} to ${formatDate(nextSunday)}):`);
      console.log(`- Total price: ${result.pricing.totalPrice} ${result.pricing.currency}`);
      console.log(`- Daily rates:`, result.pricing.dailyRates);
      
      // Open this test case in a new tab if desired
      const url = `${document.location.origin}/booking/check/${propertySlug}?checkIn=${formatDate(nextFriday)}&checkOut=${formatDate(nextSunday)}&guests=2`;
      console.log(`Test URL: ${url}`);
    }
  }
  
  // Test 2: Weekday stay (likely standard prices)
  async function testWeekdayPricing() {
    console.log('\n\n🔍 Test 2: Weekday Pricing Test');
    
    // Find next Monday and Thursday
    let nextMonday = new Date(today);
    while (nextMonday.getDay() !== 1) {
      nextMonday.setDate(nextMonday.getDate() + 1);
    }
    
    const nextThursday = new Date(nextMonday);
    nextThursday.setDate(nextThursday.getDate() + 3);
    
    const result = await checkPricing(nextMonday, nextThursday, 2);
    
    if (result && result.available && result.pricing) {
      console.log(`Weekday stay (${formatDate(nextMonday)} to ${formatDate(nextThursday)}):`);
      console.log(`- Total price: ${result.pricing.totalPrice} ${result.pricing.currency}`);
      console.log(`- Daily rates:`, result.pricing.dailyRates);
      
      // Open this test case in a new tab if desired
      const url = `${document.location.origin}/booking/check/${propertySlug}?checkIn=${formatDate(nextMonday)}&checkOut=${formatDate(nextThursday)}&guests=2`;
      console.log(`Test URL: ${url}`);
    }
  }
  
  // Test 3: Different guest counts
  async function testGuestCounts() {
    console.log('\n\n🔍 Test 3: Guest Count Pricing Test');
    
    // Use dates 2 weeks from now
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + 14);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 3);
    
    console.log(`Testing different guest counts for stay: ${formatDate(startDate)} to ${formatDate(endDate)}`);
    
    // Test with different guest counts
    const guestCounts = [1, 2, 4, 6, 8];
    const results = {};
    
    for (const guestCount of guestCounts) {
      const result = await checkPricing(startDate, endDate, guestCount);
      
      if (result && result.available && result.pricing) {
        console.log(`${guestCount} guests: ${result.pricing.totalPrice} ${result.pricing.currency}`);
        results[guestCount] = result.pricing.totalPrice;
      } else {
        console.log(`${guestCount} guests: Not available or pricing error`);
      }
    }
    
    // Compare prices to detect guest-based pricing
    const basePrice = results[2] || Object.values(results)[0];
    
    for (const guestCount in results) {
      const price = results[guestCount];
      const difference = price - basePrice;
      
      if (difference > 0) {
        console.log(`✅ Price increase detected for ${guestCount} guests: +${difference} (${Math.round(difference/basePrice*100)}% higher)`);
      } else if (difference < 0) {
        console.log(`⚠️ Unexpected price decrease for ${guestCount} guests: ${difference}`);
      } else {
        console.log(`ℹ️ No price difference for ${guestCount} guests`);
      }
    }
    
    // Open a sample with higher guest count in a new tab
    if (guestCounts.length > 1) {
      const highestGuests = guestCounts[guestCounts.length - 1];
      const url = `${document.location.origin}/booking/check/${propertySlug}?checkIn=${formatDate(startDate)}&checkOut=${formatDate(endDate)}&guests=${highestGuests}`;
      console.log(`Test URL for ${highestGuests} guests: ${url}`);
    }
  }
  
  // Test 4: Length of stay discounts
  async function testLengthOfStay() {
    console.log('\n\n🔍 Test 4: Length of Stay Discount Test');
    
    // Use dates 1 month from now
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() + 1);
    
    // Test various stay lengths
    const stayLengths = [3, 7, 14, 30];
    const results = {};
    
    console.log(`Testing different stay lengths starting from ${formatDate(startDate)}`);
    
    for (const nights of stayLengths) {
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + nights);
      
      const result = await checkPricing(startDate, endDate, 2);
      
      if (result && result.available && result.pricing) {
        console.log(`${nights} nights: ${result.pricing.totalPrice} ${result.pricing.currency}`);
        
        // Check for explicit discount
        if (result.pricing.lengthOfStayDiscount && result.pricing.lengthOfStayDiscount.discountAmount > 0) {
          console.log(`✅ Explicit discount applied: ${result.pricing.lengthOfStayDiscount.discountPercentage}% (${result.pricing.lengthOfStayDiscount.discountAmount} ${result.pricing.currency})`);
        }
        
        // Store for price per night calculation
        results[nights] = {
          total: result.pricing.totalPrice,
          avgNight: result.pricing.averageNightlyRate,
          perNight: result.pricing.totalPrice / nights
        };
      } else {
        console.log(`${nights} nights: Not available or pricing error`);
      }
    }
    
    // Compare average nightly rates to detect implicit discounts
    if (Object.keys(results).length > 1) {
      const shortestStay = Math.min(...Object.keys(results).map(Number));
      const baseRate = results[shortestStay].perNight;
      
      for (const nights in results) {
        if (parseInt(nights) === shortestStay) continue;
        
        const currentRate = results[nights].perNight;
        const difference = currentRate - baseRate;
        const percentDiff = Math.round((difference / baseRate) * 100);
        
        if (difference < 0) {
          console.log(`✅ Lower per-night rate for ${nights} nights: ${currentRate.toFixed(2)} vs ${baseRate.toFixed(2)} (${percentDiff}% difference)`);
        } else if (difference > 0) {
          console.log(`⚠️ Higher per-night rate for ${nights} nights: ${currentRate.toFixed(2)} vs ${baseRate.toFixed(2)} (${percentDiff}% difference)`);
        } else {
          console.log(`ℹ️ No per-night rate difference for ${nights} nights`);
        }
      }
      
      // Open a sample with longer stay in a new tab
      const longestStay = Math.max(...Object.keys(results).map(Number));
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + longestStay);
      
      const url = `${document.location.origin}/booking/check/${propertySlug}?checkIn=${formatDate(startDate)}&checkOut=${formatDate(endDate)}&guests=2`;
      console.log(`Test URL for ${longestStay} nights: ${url}`);
    }
  }
  
  // Run all tests
  await testWeekendPricing();
  await testWeekdayPricing();
  await testGuestCounts();
  await testLengthOfStay();
  
  console.log('\n\n✅ All tests complete! Check the logs above for results and test URLs.');
  console.log('You can click on any of the test URLs to open them in a new tab and verify the UI display.');
})();