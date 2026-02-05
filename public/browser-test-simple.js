/**
 * Simple Test Script for Pricing and Availability
 *
 * This is a simplified version that runs automated tests without a UI panel.
 * It performs basic availability and pricing checks and logs results to the console.
 *
 * Usage:
 * 1. Navigate to a booking page in your browser
 * 2. Open the browser console (F12 or right-click > Inspect > Console)
 * 3. Paste this entire script and press Enter
 * 4. Results will be logged to the console
 */

(async function() {
  console.log('Running simple pricing and availability tests...');

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
  // Or on the admin pricing page
  else if (document.location.pathname.includes('/admin/pricing')) {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('propertyId')) {
      propertySlug = urlParams.get('propertyId');
    }
  }

  if (!propertySlug) {
    console.error('This script must be run on a booking check page, property page, or admin pricing page with a propertyId');
    return;
  }

  console.log(`Detected property slug: ${propertySlug}`);

  // Utility functions
  const utils = {
    formatDate(date) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    },

    formatDateISO(date) {
      return date.toISOString().split('T')[0];
    },

    addDays(date, days) {
      const result = new Date(date);
      result.setDate(date.getDate() + days);
      return result;
    }
  };

  // Show a message that tests are running
  const testIndicator = document.createElement('div');
  testIndicator.id = 'simple-test-indicator';
  testIndicator.style.position = 'fixed';
  testIndicator.style.bottom = '20px';
  testIndicator.style.right = '20px';
  testIndicator.style.background = '#007bff';
  testIndicator.style.color = 'white';
  testIndicator.style.padding = '10px 15px';
  testIndicator.style.borderRadius = '4px';
  testIndicator.style.zIndex = '10000';
  testIndicator.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  testIndicator.style.fontFamily = 'Arial, sans-serif';
  testIndicator.innerHTML = 'Running simple tests... (see console for results)';
  document.body.appendChild(testIndicator);

  // Run a series of tests and log the results
  async function runTests() {
    console.group('Simple Pricing and Availability Tests');

    try {
      // 1. Get availability information
      console.log('🔍 Checking availability...');
      const availabilityResponse = await fetch(`/api/check-availability?propertySlug=${propertySlug}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!availabilityResponse.ok) {
        throw new Error(`API returned ${availabilityResponse.status}: ${availabilityResponse.statusText}`);
      }

      const availabilityData = await availabilityResponse.json();

      // Log blocked dates if any
      if (availabilityData.unavailableDates && availabilityData.unavailableDates.length > 0) {
        console.log(`✅ Found ${availabilityData.unavailableDates.length} unavailable dates`);
        console.log('📅 First 5 unavailable dates:');
        availabilityData.unavailableDates.slice(0, 5).forEach(dateStr => {
          console.log(`   - ${new Date(dateStr).toLocaleDateString()}`);
        });
      } else {
        console.log('ℹ️ No unavailable dates found for this property');
      }

      // 2. Run a series of test bookings
      console.log('\n🔍 Running booking tests...');

      // Generate test dates
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() + 30); // 30 days from now

      const testScenarios = [
        {
          name: "Weekend Stay (2 nights)",
          checkIn: utils.formatDateISO(startDate),
          checkOut: utils.formatDateISO(utils.addDays(startDate, 2)),
          guests: 2
        },
        {
          name: "Week-long Stay (7 nights)",
          checkIn: utils.formatDateISO(startDate),
          checkOut: utils.formatDateISO(utils.addDays(startDate, 7)),
          guests: 2
        },
        {
          name: "Single Guest Stay",
          checkIn: utils.formatDateISO(startDate),
          checkOut: utils.formatDateISO(utils.addDays(startDate, 3)),
          guests: 1
        },
        {
          name: "Large Group Stay",
          checkIn: utils.formatDateISO(startDate),
          checkOut: utils.formatDateISO(utils.addDays(startDate, 3)),
          guests: 6
        }
      ];

      // Run tests for each scenario
      for (const scenario of testScenarios) {
        console.log(`\n📋 Testing: ${scenario.name}`);
        console.log(`   Check-in: ${scenario.checkIn}, Check-out: ${scenario.checkOut}, Guests: ${scenario.guests}`);

        try {
          const response = await fetch('/api/check-pricing-availability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              propertyId: propertySlug,
              checkIn: scenario.checkIn,
              checkOut: scenario.checkOut,
              guests: scenario.guests
            })
          });

          const data = await response.json();

          if (data.available) {
            console.log(`✅ Booking is available`);
            console.log(`💰 Total price: ${data.pricing.totalPrice} ${data.pricing.currency}`);

            // Check for discounts
            if (data.pricing.lengthOfStayDiscount && data.pricing.lengthOfStayDiscount.discountAmount > 0) {
              console.log(`🏷️  Discount applied: ${data.pricing.lengthOfStayDiscount.discountPercentage}% (${data.pricing.lengthOfStayDiscount.discountAmount} ${data.pricing.currency})`);
            }

            // Calculate price per night
            const nights = (new Date(scenario.checkOut) - new Date(scenario.checkIn)) / (1000 * 60 * 60 * 24);
            const pricePerNight = data.pricing.totalPrice / nights;
            console.log(`🌙 Price per night: ${pricePerNight.toFixed(2)} ${data.pricing.currency}`);

          } else {
            console.log(`❌ Booking is NOT available`);
            console.log(`⚠️ Reason: ${data.reason}`);

            if (data.reason === 'minimum_stay') {
              console.log(`ℹ️ Minimum stay required: ${data.minimumStay} nights`);
            } else if (data.reason === 'unavailable_dates') {
              console.log(`ℹ️ Unavailable dates: ${data.unavailableDates?.join(', ')}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error testing ${scenario.name}:`, error);
        }
      }

      // 3. Check for consecutive blocked dates
      if (availabilityData.unavailableDates && availabilityData.unavailableDates.length > 0) {
        console.log('\n🔍 Checking for consecutive blocked dates...');

        // Convert dates to Date objects and sort
        const unavailableDates = availabilityData.unavailableDates
          .map(dateStr => new Date(dateStr))
          .sort((a, b) => a.getTime() - b.getTime());

        // Find consecutive blocks
        let consecutiveBlocks = [];
        let currentBlock = [];

        for (let i = 0; i < unavailableDates.length; i++) {
          const current = unavailableDates[i];

          if (currentBlock.length === 0) {
            currentBlock.push(current);
          } else {
            const previous = currentBlock[currentBlock.length - 1];
            const oneDayAfter = new Date(previous);
            oneDayAfter.setDate(previous.getDate() + 1);

            if (utils.formatDateISO(oneDayAfter) === utils.formatDateISO(current)) {
              currentBlock.push(current);
            } else {
              if (currentBlock.length > 1) {
                consecutiveBlocks.push([...currentBlock]);
              }
              currentBlock = [current];
            }
          }
        }

        if (currentBlock.length > 1) {
          consecutiveBlocks.push([...currentBlock]);
        }

        // Log results
        if (consecutiveBlocks.length > 0) {
          console.log(`✅ Found ${consecutiveBlocks.length} consecutive blocks of unavailable dates`);
          console.log('📅 Consecutive blocked date ranges:');

          consecutiveBlocks.forEach((block, index) => {
            const start = utils.formatDate(block[0]);
            const end = utils.formatDate(block[block.length - 1]);
            console.log(`   - Block ${index + 1}: ${start} to ${end} (${block.length} days)`);
          });

          // Test checkout on a blocked date
          if (consecutiveBlocks.length > 0 && consecutiveBlocks[0].length >= 2) {
            console.log('\n🔍 Testing checkout on consecutive blocked dates...');

            const block = consecutiveBlocks[0];
            const blockStart = block[0];
            const blockEnd = block[block.length - 1];

            // Test checkout on first day of block (should be allowed if night before is available)
            const dayBeforeStart = new Date(blockStart);
            dayBeforeStart.setDate(blockStart.getDate() - 1);

            console.log(`📋 Testing checkout on first day of block: ${utils.formatDate(blockStart)}`);
            console.log(`   Check-in: ${utils.formatDate(dayBeforeStart)}, Check-out: ${utils.formatDate(blockStart)}`);

            try {
              const response = await fetch('/api/check-pricing-availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  propertyId: propertySlug,
                  checkIn: dayBeforeStart.toISOString(),
                  checkOut: blockStart.toISOString(),
                  guests: 2
                })
              });

              const data = await response.json();

              if (data.available) {
                console.log(`✅ Checkout on first day of block is correctly ALLOWED`);
              } else {
                console.log(`❌ ISSUE: Checkout on first day of block is unexpectedly REJECTED`);
                console.log(`⚠️ Reason: ${data.reason}`);
              }
            } catch (error) {
              console.error(`❌ Error testing checkout on first day of block:`, error);
            }

            // Test checkout on second day of block (should be rejected because night before is blocked)
            if (block.length > 1) {
              const secondDayOfBlock = block[1];

              console.log(`\n📋 Testing checkout on second day of block: ${utils.formatDate(secondDayOfBlock)}`);
              console.log(`   Check-in: ${utils.formatDate(dayBeforeStart)}, Check-out: ${utils.formatDate(secondDayOfBlock)}`);

              try {
                const response = await fetch('/api/check-pricing-availability', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    propertyId: propertySlug,
                    checkIn: dayBeforeStart.toISOString(),
                    checkOut: secondDayOfBlock.toISOString(),
                    guests: 2
                  })
                });

                const data = await response.json();

                if (data.available) {
                  console.log(`❌ ISSUE: Checkout on second day of consecutive block is unexpectedly ALLOWED`);
                } else {
                  console.log(`✅ Checkout on second day of consecutive block is correctly REJECTED`);
                  console.log(`✅ Reason: ${data.reason}`);
                }
              } catch (error) {
                console.error(`❌ Error testing checkout on second day of block:`, error);
              }
            }
          }
        } else {
          console.log('ℹ️ No consecutive blocked date ranges found');
        }
      }

      console.log('\n✅ Simple tests completed. See results above.');

    } catch (error) {
      console.error('❌ Error running tests:', error);
    } finally {
      console.groupEnd();

      // Remove the indicator after tests are done
      setTimeout(() => {
        const indicator = document.getElementById('simple-test-indicator');
        if (indicator) {
          indicator.innerHTML = 'Tests completed! See console for results';
          setTimeout(() => {
            document.body.removeChild(indicator);
          }, 3000);
        }
      }, 1000);
    }
  }

  // Run the tests
  await runTests();
})();
