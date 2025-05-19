// Manual testing script for booking forms
// Run this in the browser console on the booking check page

(function() {
  console.log('🧪 Starting Booking Forms Test Suite');
  console.log('===================================\n');
  
  const testResults = {
    dateSelection: false,
    guestCount: false,
    contactForm: false,
    holdForm: false,
    bookingForm: false,
    keyboardNav: false,
    touchTargets: false,
    animations: false,
    scrollBehavior: false
  };
  
  // Test 1: Date Selection
  console.log('📅 Testing Date Selection...');
  const dateButton = document.querySelector('#date');
  if (dateButton) {
    console.log('  ✓ Date picker found');
    dateButton.click();
    setTimeout(() => {
      const calendar = document.querySelector('[role="grid"]');
      if (calendar) {
        console.log('  ✓ Calendar opens on click');
        testResults.dateSelection = true;
      } else {
        console.log('  ✗ Calendar failed to open');
      }
    }, 500);
  } else {
    console.log('  ✗ Date picker not found');
  }
  
  // Test 2: Guest Count
  console.log('\n👥 Testing Guest Count Selector...');
  const guestCountButtons = document.querySelectorAll('[aria-label*="guest"]');
  if (guestCountButtons.length >= 2) {
    console.log('  ✓ Guest count buttons found');
    const guestDisplay = document.querySelector('#guests');
    if (guestDisplay) {
      const initialCount = guestDisplay.textContent;
      console.log(`  Initial count: ${initialCount}`);
      testResults.guestCount = true;
    }
  } else {
    console.log('  ✗ Guest count buttons not found');
  }
  
  // Test 3: Booking Options Cards
  console.log('\n🃏 Testing Booking Option Cards...');
  const bookingCards = document.querySelectorAll('[role="button"][aria-pressed]');
  if (bookingCards.length > 0) {
    console.log(`  ✓ Found ${bookingCards.length} booking option cards`);
    
    // Test keyboard navigation
    const firstCard = bookingCards[0];
    firstCard.focus();
    console.log('  Testing keyboard navigation...');
    
    // Simulate arrow key press
    const arrowEvent = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true
    });
    firstCard.dispatchEvent(arrowEvent);
    
    setTimeout(() => {
      if (document.activeElement !== firstCard) {
        console.log('  ✓ Arrow key navigation working');
        testResults.keyboardNav = true;
      } else {
        console.log('  ⚠️ Arrow key navigation may not be working');
      }
    }, 100);
  } else {
    console.log('  ✗ Booking option cards not found');
  }
  
  // Test 4: Touch Targets
  console.log('\n👆 Testing Touch Targets...');
  const buttons = document.querySelectorAll('button');
  let touchTargetsPassed = true;
  
  buttons.forEach((button, index) => {
    const rect = button.getBoundingClientRect();
    if (rect.width < 44 || rect.height < 44) {
      console.log(`  ✗ Button ${index} too small: ${rect.width}x${rect.height}px`);
      touchTargetsPassed = false;
    }
  });
  
  if (touchTargetsPassed) {
    console.log('  ✓ All buttons meet minimum touch target size (44x44px)');
    testResults.touchTargets = true;
  }
  
  // Test 5: Form Validation
  console.log('\n📝 Testing Form Validation...');
  const forms = document.querySelectorAll('form');
  if (forms.length > 0) {
    console.log(`  ✓ Found ${forms.length} forms`);
    
    forms.forEach((form, index) => {
      const requiredInputs = form.querySelectorAll('[required]');
      console.log(`  Form ${index}: ${requiredInputs.length} required fields`);
    });
  } else {
    console.log('  ⚠️ No forms visible yet (select a booking option first)');
  }
  
  // Test 6: Animations
  console.log('\n🎭 Testing Animations...');
  const animatedElements = document.querySelectorAll('[class*="transition"], [class*="animate"]');
  if (animatedElements.length > 0) {
    console.log(`  ✓ Found ${animatedElements.length} elements with animation classes`);
    testResults.animations = true;
  } else {
    console.log('  ✗ No animated elements found');
  }
  
  // Test 7: Theme Variables
  console.log('\n🎨 Testing Theme Variables...');
  const computedStyle = getComputedStyle(document.documentElement);
  const primaryColor = computedStyle.getPropertyValue('--primary');
  const backgroundColor = computedStyle.getPropertyValue('--background');
  
  if (primaryColor && backgroundColor) {
    console.log('  ✓ Theme CSS variables are applied');
    console.log(`  Primary: ${primaryColor}`);
    console.log(`  Background: ${backgroundColor}`);
  } else {
    console.log('  ✗ Theme CSS variables not found');
  }
  
  // Test 8: Mobile Accordion (if on mobile)
  console.log('\n📱 Testing Mobile Accordion...');
  const accordionButton = document.querySelector('[aria-expanded]');
  if (accordionButton && window.innerWidth < 768) {
    console.log('  ✓ Mobile accordion found');
    const isExpanded = accordionButton.getAttribute('aria-expanded') === 'true';
    console.log(`  Current state: ${isExpanded ? 'expanded' : 'collapsed'}`);
  } else if (window.innerWidth >= 768) {
    console.log('  ℹ️ Not in mobile view');
  } else {
    console.log('  ✗ Mobile accordion not found');
  }
  
  // Test 9: Scroll Behavior
  console.log('\n📜 Testing Scroll Behavior...');
  const scrollableElements = document.querySelectorAll('[id]');
  if (scrollableElements.length > 5) {
    console.log(`  ✓ Found ${scrollableElements.length} scrollable targets`);
    testResults.scrollBehavior = true;
  }
  
  // Summary
  console.log('\n\n📊 TEST SUMMARY');
  console.log('===============');
  
  let passedTests = 0;
  for (const [test, passed] of Object.entries(testResults)) {
    console.log(`${test}: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    if (passed) passedTests++;
  }
  
  const totalTests = Object.keys(testResults).length;
  const percentage = Math.round((passedTests / totalTests) * 100);
  
  console.log(`\nOverall: ${passedTests}/${totalTests} tests passed (${percentage}%)`);
  console.log('\n🔍 Manual Steps to Complete:');
  console.log('1. Select dates and verify availability check');
  console.log('2. Select a booking option (Contact/Hold/Book Now)');
  console.log('3. Fill out the form and verify validation');
  console.log('4. Test on mobile device for touch and accordion');
  console.log('5. Switch themes and verify styling');
  console.log('6. Test with Romanian language');
  
  return testResults;
})();