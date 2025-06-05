#!/usr/bin/env node

/**
 * Test script for verifying the booking page flash fix
 * Tests for proper handling of stale content and loading states
 */

const puppeteer = require('puppeteer');

async function testBookingFlashFix() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--window-size=1400,900']
  });

  try {
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'info') {
        console.log('PAGE LOG:', msg.text());
      }
    });

    console.log('\n🧪 Testing Booking Page Flash Fix...\n');

    // Navigate to the booking page
    console.log('1. Navigating to booking page...');
    await page.goto('http://localhost:9002/booking/check/prahova-mountain-chalet', {
      waitUntil: 'networkidle0'
    });
    await page.waitForTimeout(2000);

    // Test 1: Select available dates and check for immediate summary
    console.log('\n2. Testing available dates selection...');
    
    // Click on calendar to open it
    const calendarTrigger = await page.waitForSelector('[data-testid="date-picker-trigger"], button:has-text("Select dates"), .react-daterange-picker__wrapper', { timeout: 10000 });
    await calendarTrigger.click();
    await page.waitForTimeout(1000);

    // Get current date and select dates in the future
    const today = new Date();
    const checkIn = new Date(today);
    checkIn.setDate(today.getDate() + 30); // 30 days from now
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkIn.getDate() + 3); // 3 nights

    // Select check-in date
    console.log(`   - Selecting check-in: ${checkIn.toLocaleDateString()}`);
    const checkInSelector = `[aria-label*="${checkIn.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}"]`;
    await page.waitForSelector(checkInSelector, { timeout: 5000 });
    await page.click(checkInSelector);
    await page.waitForTimeout(500);

    // Select check-out date
    console.log(`   - Selecting check-out: ${checkOut.toLocaleDateString()}`);
    const checkOutSelector = `[aria-label*="${checkOut.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}"]`;
    await page.waitForSelector(checkOutSelector, { timeout: 5000 });
    await page.click(checkOutSelector);
    await page.waitForTimeout(1000);

    // Check if conversational summary appears
    console.log('   - Checking for conversational summary...');
    let summaryFound = false;
    let flashDetected = false;
    
    // Monitor for any flash of content
    const checkForSummary = async () => {
      const summaryElements = await page.$$eval('.text-lg.font-medium, .text-base', elements => 
        elements.map(el => el.textContent).filter(text => 
          text && (text.includes('nights') || text.includes('Total:') || text.includes('per night'))
        )
      );
      
      if (summaryElements.length > 0) {
        summaryFound = true;
        console.log('   ✓ Summary found:', summaryElements[0]);
        
        // Check if it appeared before pricing confirmation
        const pricingConfirmed = await page.evaluate(() => {
          const confirmText = Array.from(document.querySelectorAll('*')).find(el => 
            el.textContent && el.textContent.includes('Checking availability')
          );
          return !confirmText;
        });
        
        if (!pricingConfirmed) {
          flashDetected = true;
          console.log('   ⚠️  WARNING: Summary appeared before pricing confirmation!');
        }
      }
    };

    // Monitor for 3 seconds
    for (let i = 0; i < 6; i++) {
      await checkForSummary();
      await page.waitForTimeout(500);
    }

    if (!summaryFound) {
      console.log('   ✓ No premature summary display detected');
    }

    // Test 2: Clear dates and select unavailable dates
    console.log('\n3. Testing unavailable dates selection...');
    
    // Clear current selection
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Open calendar again
    const calendarTrigger2 = await page.waitForSelector('[data-testid="date-picker-trigger"], button:has-text("Select dates"), .react-daterange-picker__wrapper');
    await calendarTrigger2.click();
    await page.waitForTimeout(1000);

    // Try to select dates that might be unavailable (in the past)
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    
    console.log(`   - Attempting to select past date: ${pastDate.toLocaleDateString()}`);
    
    // Check for strikethrough dates
    const strikethroughDates = await page.$$eval('.react-calendar__tile--disabled, [aria-disabled="true"]', elements => elements.length);
    console.log(`   - Found ${strikethroughDates} disabled/unavailable dates`);

    // Check for error message with strikethrough help text
    const errorMessages = await page.$$eval('.text-red-500, .text-destructive, [role="alert"]', elements => 
      elements.map(el => el.textContent).filter(text => text && text.length > 0)
    );
    
    if (errorMessages.length > 0) {
      console.log('   - Error messages found:');
      errorMessages.forEach(msg => console.log(`     "${msg}"`));
      
      const hasStrikethroughHelp = errorMessages.some(msg => 
        msg.includes('strikethrough') || msg.includes('unavailable') || msg.includes('blocked')
      );
      
      if (hasStrikethroughHelp) {
        console.log('   ✓ Strikethrough help text found in error message');
      } else {
        console.log('   ⚠️  No strikethrough help text found in error messages');
      }
    }

    // Test 3: Check loading states
    console.log('\n4. Testing loading states...');
    
    // Select new dates to trigger availability check
    const futureCheckIn = new Date();
    futureCheckIn.setDate(futureCheckIn.getDate() + 60);
    const futureCheckOut = new Date(futureCheckIn);
    futureCheckOut.setDate(futureCheckIn.getDate() + 2);
    
    await page.reload();
    await page.waitForTimeout(2000);
    
    const calendarTrigger3 = await page.waitForSelector('[data-testid="date-picker-trigger"], button:has-text("Select dates"), .react-daterange-picker__wrapper');
    await calendarTrigger3.click();
    await page.waitForTimeout(1000);
    
    // Monitor for loading states
    let loadingStateDetected = false;
    page.on('response', response => {
      if (response.url().includes('check-availability') || response.url().includes('pricing')) {
        loadingStateDetected = true;
      }
    });
    
    // Select dates
    const futureCheckInSelector = `[aria-label*="${futureCheckIn.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}"]`;
    await page.click(futureCheckInSelector);
    await page.waitForTimeout(500);
    
    const futureCheckOutSelector = `[aria-label*="${futureCheckOut.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}"]`;
    await page.click(futureCheckOutSelector);
    
    // Check for loading indicators
    const loadingIndicators = await page.waitForSelector('.animate-pulse, .skeleton, [aria-busy="true"], :has-text("Checking availability")', {
      timeout: 3000
    }).catch(() => null);
    
    if (loadingIndicators) {
      console.log('   ✓ Loading state properly displayed');
    } else {
      console.log('   ⚠️  No loading indicators detected');
    }
    
    await page.waitForTimeout(3000);

    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log(`   - Flash of stale content: ${flashDetected ? '❌ DETECTED' : '✅ NOT DETECTED'}`);
    console.log(`   - Loading states: ${loadingStateDetected ? '✅ Working' : '⚠️  Not detected'}`);
    console.log(`   - Disabled dates shown: ${strikethroughDates > 0 ? '✅ Yes' : '⚠️  No'}`);
    console.log(`   - Error messages present: ${errorMessages.length > 0 ? '✅ Yes' : '⚠️  No'}`);

    console.log('\n✅ Test completed. Please check the browser window for visual confirmation.');
    console.log('Press Ctrl+C to close the browser and exit.\n');

    // Keep browser open for manual inspection
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await browser.close();
  }
}

testBookingFlashFix().catch(console.error);