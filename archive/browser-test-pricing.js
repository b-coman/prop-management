/**
 * Browser Test Script for Pricing and Availability
 * 
 * This script can be run in the browser console when on a booking check page
 * to test various booking scenarios for pricing and availability.
 * 
 * Usage:
 * 1. Navigate to a booking page in your browser (e.g., http://localhost:9002/booking/check/prahova-mountain-chalet)
 * 2. Open the browser console (F12 or right-click > Inspect > Console)
 * 3. Paste this entire script and press Enter
 * 4. The test panel will appear at the bottom of the page
 */

(function() {
  // Extract the property slug from the URL (works for both booking check pages and property pages)
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

  // Debug helper to display in console
  function debug(message) {
    console.log(`[Test Panel] ${message}`);
  }
  
  // Remove existing test panel if it exists
  const existingPanel = document.getElementById('pricing-test-panel');
  if (existingPanel) {
    try {
      document.body.removeChild(existingPanel);
      debug('Removed existing test panel');
    } catch (e) {
      console.error('Error removing existing panel:', e);
    }
  }
  
  // Create test UI
  const createTestUI = () => {
    // Create container
    const container = document.createElement('div');
    container.id = 'pricing-test-panel';
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '0',
      left: '0',
      right: '0',
      backgroundColor: '#f8f9fa',
      borderTop: '2px solid #dee2e6',
      padding: '15px',
      zIndex: '9999',
      boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      maxHeight: '50vh',
      overflowY: 'auto'
    });

    // Create header
    const header = document.createElement('div');
    header.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0; color: #333;">Pricing & Availability Test Panel</h3>
        <button id="close-test-panel" style="border: none; background: #f44336; color: white; padding: 5px 10px; cursor: pointer; border-radius: 4px;">Close</button>
      </div>
      <p>Property: <strong>${propertySlug}</strong></p>
    `;
    container.appendChild(header);

    // Create test tabs
    const tabContainer = document.createElement('div');
    tabContainer.innerHTML = `
      <div style="display: flex; border-bottom: 1px solid #dee2e6; margin-bottom: 15px;">
        <button class="test-tab active" data-tab="blocked-dates" style="padding: 8px 15px; cursor: pointer; background: none; border: none; border-bottom: 2px solid #007bff;">Blocked Dates</button>
        <button class="test-tab" data-tab="min-stay" style="padding: 8px 15px; cursor: pointer; background: none; border: none;">Min Stay</button>
        <button class="test-tab" data-tab="guest-count" style="padding: 8px 15px; cursor: pointer; background: none; border: none;">Guest Count</button>
        <button class="test-tab" data-tab="date-ranges" style="padding: 8px 15px; cursor: pointer; background: none; border: none;">Date Ranges</button>
        <button class="test-tab" data-tab="logs" style="padding: 8px 15px; cursor: pointer; background: none; border: none;">Test Logs</button>
      </div>
    `;
    container.appendChild(tabContainer);

    // Create content area
    const contentArea = document.createElement('div');
    contentArea.id = 'test-content-area';
    container.appendChild(contentArea);

    // Add to page
    document.body.appendChild(container);

    // Setup tab switching - use onclick instead of addEventListener for better compatibility
    const tabs = document.querySelectorAll('.test-tab');
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      tab.onclick = function() {
        // Remove active from all tabs
        for (let j = 0; j < tabs.length; j++) {
          tabs[j].classList.remove('active');
          tabs[j].style.borderBottom = 'none';
        }
        
        // Set active on clicked tab
        this.classList.add('active');
        this.style.borderBottom = '2px solid #007bff';
        
        // Render appropriate content
        renderTabContent(this.getAttribute('data-tab'));
      };
    }

    // Setup close button using onclick for better compatibility
    document.getElementById('close-test-panel').onclick = function() {
      document.body.removeChild(container);
    };

    // Initial render
    renderTabContent('blocked-dates');
  };

  // Helper function to find elements by text content
  const findElementByText = (selector, text) => {
    // Handle wildcard selector differently
    if (selector === '*') {
      const allElements = document.querySelectorAll('div, span, p, h1, h2, h3, h4, h5, h6, button, a');
      for (let i = 0; i < allElements.length; i++) {
        if (allElements[i].textContent.includes(text)) {
          return allElements[i];
        }
      }
      return null;
    }
    
    // Normal selector
    try {
      const elements = document.querySelectorAll(selector);
      for (let i = 0; i < elements.length; i++) {
        if (elements[i].textContent.includes(text)) {
          return elements[i];
        }
      }
    } catch (e) {
      debug(`Error with selector "${selector}": ${e.message}`);
    }
    return null;
  };

  // Get booking component elements
  const getBookingElements = () => {
    // Different sites might have different selectors - adjust as needed
    const elements = {
      // For the booking check page
      datePickerButton: document.querySelector('[data-testid="date-picker-button"], [aria-label="Select dates"], .date-range-picker') || findElementByText('button', 'Change'),
      guestCountInput: document.querySelector('[data-testid="guest-count"], [aria-label="Number of guests"], select[name="guests"], .guest-count-selector'),
      bookButton: document.querySelector('[data-testid="book-now-button"]') || findElementByText('button', 'Book Now') || findElementByText('button', 'Hold') || findElementByText('button', 'Reserve'),
      priceDisplay: document.querySelector('[data-testid="total-price"], .price-display, .booking-price, .price-value, .booking-summary-total'),
      calendarContainer: document.querySelector('.react-datepicker, .date-picker-container, .calendar-container, .rdrCalendarWrapper'),
      bookingSummary: document.querySelector('.booking-summary, .price-breakdown, .booking-details-card'),
      errorMessage: document.querySelector('.error-message, .alert-error, .booking-error')
    };
    
    // Debug which elements were found
    let foundElements = Object.keys(elements).filter(key => elements[key] !== null);
    debug(`Found UI elements: ${foundElements.join(', ') || 'none'}`);
    
    // Try more generic selectors if specific ones fail
    if (!elements.bookButton) {
      debug('Trying more generic button selectors');
      elements.bookButton = document.querySelector('button.primary, button.btn-primary, button.main-action');
    }
    
    if (!elements.priceDisplay) {
      debug('Trying more generic price selectors');
      // Find any element with price-related text
      const allElements = document.querySelectorAll('div, span, p, h1, h2, h3, h4, h5, h6');
      let priceElement = null;
      
      for (let i = 0; i < allElements.length; i++) {
        const text = allElements[i].textContent.toLowerCase();
        if (text.includes('total') || text.includes('price') || 
            text.includes('eur') || text.includes('ron') ||
            text.includes('€') || text.includes('lei')) {
          priceElement = allElements[i];
          debug(`Found price element with text: ${text}`);
          break;
        }
      }
      
      if (priceElement) {
        elements.priceDisplay = priceElement;
      }
    }
    
    return elements;
  };

  // Create test scenarios
  const createTestScenarios = () => {
    // Get current date
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return {
      blockedDates: [
        {
          name: 'Blocked Middle Date',
          description: 'Attempt booking with a blocked date in the middle',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 12),
          guests: 2,
          action: async () => testBlockedMiddleDate()
        },
        {
          name: 'Blocked Checkout Date',
          description: 'Book where checkout date is unavailable (should work)',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10),
          guests: 2,
          action: async () => testBlockedCheckoutDate()
        }
      ],
      minStay: [
        {
          name: 'Below Minimum Stay',
          description: 'Book 2 nights when minimum stay is higher',
          checkIn: new Date(today.getFullYear(), today.getMonth() + 1, 15),
          checkOut: new Date(today.getFullYear(), today.getMonth() + 1, 17),
          guests: 2,
          action: async () => testBelowMinimumStay()
        },
        {
          name: 'Exact Minimum Stay',
          description: 'Book exactly the minimum required nights',
          checkIn: new Date(today.getFullYear(), today.getMonth() + 1, 15),
          checkOut: new Date(today.getFullYear(), today.getMonth() + 1, 19), // 4 nights
          guests: 2,
          action: async () => testExactMinimumStay()
        }
      ],
      guestCount: [
        {
          name: 'Base Occupancy',
          description: 'Book with minimum guest count',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 17),
          guests: 1,
          action: async () => testGuestCount(1)
        },
        {
          name: 'Mid Occupancy',
          description: 'Book with medium guest count',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 17),
          guests: 4,
          action: async () => testGuestCount(4)
        },
        {
          name: 'Maximum Occupancy',
          description: 'Book with maximum guest count',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 17),
          guests: 8,
          action: async () => testGuestCount(8)
        }
      ],
      dateRanges: [
        {
          name: 'Weekend Stay',
          description: 'Book Friday to Sunday (weekend pricing)',
          checkIn: getNextFriday(),
          checkOut: getNextSunday(),
          guests: 2,
          action: async () => testDateRange('weekend')
        },
        {
          name: 'Week Stay',
          description: 'Book 7-night stay (potential discount)',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 37),
          guests: 2,
          action: async () => testDateRange('week')
        },
        {
          name: 'Month Ahead',
          description: 'Book 30 days in advance',
          checkIn: new Date(today.getFullYear(), today.getMonth() + 1, today.getDate()),
          checkOut: new Date(today.getFullYear(), today.getMonth() + 1, today.getDate() + 3),
          guests: 2,
          action: async () => testDateRange('month-ahead')
        }
      ]
    };
  };

  // Helper to get next Friday
  function getNextFriday() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0-6, 0 is Sunday
    const daysToAdd = (5 - dayOfWeek + 7) % 7 || 7; // 5 is Friday, ensure we get next Friday
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysToAdd);
    return nextFriday;
  }

  // Helper to get next Sunday
  function getNextSunday() {
    const nextFriday = getNextFriday();
    const nextSunday = new Date(nextFriday);
    nextSunday.setDate(nextFriday.getDate() + 2); // Sunday is 2 days after Friday
    return nextSunday;
  }

  // Format date for display
  function formatDate(date) {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Test logs
  const testLogs = [];
  function logTest(message, isError = false) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const logEntry = `[${timestamp}] ${isError ? '❌ ' : '✅ '}${message}`;
    testLogs.push(logEntry);
    console.log(isError ? `Error: ${message}` : message);
    updateLogDisplay();
  }

  function updateLogDisplay() {
    const logsTab = document.querySelector('[data-tab="logs"]');
    if (logsTab && logsTab.classList.contains('active')) {
      renderTabContent('logs');
    }
  }

  // Render different tab content
  function renderTabContent(tabName) {
    const contentArea = document.getElementById('test-content-area');
    const scenarios = createTestScenarios();
    
    switch(tabName) {
      case 'blocked-dates':
        renderScenarios(contentArea, scenarios.blockedDates, 'Blocked Date Tests');
        break;
      case 'min-stay':
        renderScenarios(contentArea, scenarios.minStay, 'Minimum Stay Tests');
        break;
      case 'guest-count':
        renderScenarios(contentArea, scenarios.guestCount, 'Guest Count Tests');
        break;
      case 'date-ranges':
        renderScenarios(contentArea, scenarios.dateRanges, 'Date Range Tests');
        break;
      case 'logs':
        contentArea.innerHTML = `
          <h4 style="margin-top: 0;">Test Logs</h4>
          <div style="background: #f5f5f5; padding: 10px; border-radius: 4px; max-height: 300px; overflow-y: auto; font-family: monospace; white-space: pre-wrap;">
            ${testLogs.length ? testLogs.join('<br>') : 'No logs yet. Run some tests to see results.'}
          </div>
        `;
        break;
    }
  }

  // Render scenarios
  function renderScenarios(container, scenarios, title) {
    container.innerHTML = `
      <h4 style="margin-top: 0;">${title}</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">
        ${scenarios.map((scenario, i) => `
          <div style="border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; background: white;">
            <h5 style="margin-top: 0; margin-bottom: 10px;">${scenario.name}</h5>
            <p style="margin-bottom: 10px; color: #666; font-size: 13px;">${scenario.description}</p>
            <div style="font-size: 12px; margin-bottom: 10px;">
              <div>Check-in: <strong>${formatDate(scenario.checkIn)}</strong></div>
              <div>Check-out: <strong>${formatDate(scenario.checkOut)}</strong></div>
              <div>Guests: <strong>${scenario.guests}</strong></div>
            </div>
            <button class="run-test-btn" data-index="${i}" data-category="${title}" style="background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; width: 100%;">Run Test</button>
          </div>
        `).join('')}
      </div>
    `;

    // Add direct event listeners to buttons for better compatibility
    const buttons = container.querySelectorAll('.run-test-btn');
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      btn.onclick = function() {
        const index = parseInt(this.getAttribute('data-index'), 10);
        const category = this.getAttribute('data-category');
        
        console.log(`Running test: ${category}, index: ${index}`);
        
        // Find the right scenario based on category
        switch(category) {
          case 'Blocked Date Tests':
            if (index === 0) testBlockedMiddleDate();
            else if (index === 1) testBlockedCheckoutDate();
            break;
          case 'Minimum Stay Tests':
            if (index === 0) testBelowMinimumStay();
            else if (index === 1) testExactMinimumStay();
            break;
          case 'Guest Count Tests':
            if (index === 0) testGuestCount(1);
            else if (index === 1) testGuestCount(4);
            else if (index === 2) testGuestCount(8);
            break;
          case 'Date Range Tests':
            if (index === 0) testDateRange('weekend');
            else if (index === 1) testDateRange('week');
            else if (index === 2) testDateRange('month-ahead');
            break;
        }
      };
    }
  }

  // API Helper to directly check pricing
  async function checkPricingAPI(checkIn, checkOut, guests) {
    try {
      const response = await fetch('/api/check-pricing-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId: propertySlug,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          guests: guests
        }),
      });

      return await response.json();
    } catch (error) {
      logTest(`API Error: ${error.message}`, true);
      return null;
    }
  }

  // Helper to navigate to a test case
  function navigateToTestCase(checkIn, checkOut, guests) {
    const baseUrl = document.location.origin;
    const checkInStr = formatDateISO(checkIn);
    const checkOutStr = formatDateISO(checkOut);
    
    // Format URL with parameters
    const url = `${baseUrl}/booking/check/${propertySlug}?checkIn=${checkInStr}&checkOut=${checkOutStr}&guests=${guests}`;
    
    // Ask user if they want to navigate directly
    const wantToNavigate = confirm(`Do you want to open a new tab with the test case?\n\nProperty: ${propertySlug}\nDates: ${formatDate(checkIn)} to ${formatDate(checkOut)}\nGuests: ${guests}\n\nURL: ${url}`);
    
    if (wantToNavigate) {
      window.open(url, '_blank');
      logTest(`Opened test case in new tab: ${url}`);
    } else {
      // Show URL for manual copying
      logTest(`Test URL (copy to navigate): ${url}`);
    }
    
    return url;
  }
  
  // Format date as YYYY-MM-DD for URLs
  function formatDateISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Test functions
  async function testBlockedMiddleDate() {
    const scenario = createTestScenarios().blockedDates[0];
    logTest(`Starting test: ${scenario.name}`);
    
    // Call the API directly first
    const apiResult = await checkPricingAPI(scenario.checkIn, scenario.checkOut, scenario.guests);
    
    if (apiResult) {
      if (!apiResult.available && apiResult.reason === 'unavailable_dates') {
        logTest(`API correctly rejected booking with unavailable dates: ${apiResult.unavailableDates?.join(', ')}`);
      } else if (apiResult.available) {
        logTest(`API unexpectedly allowed booking with potentially unavailable dates`, true);
      } else {
        logTest(`API rejected booking for reason: ${apiResult.reason}`);
      }
    }
    
    // Now test with UI elements if possible
    const elements = getBookingElements();
    if (!elements.datePickerButton) {
      logTest('Could not find date picker in UI', true);
      // Offer to navigate to the correct page
      navigateToTestCase(scenario.checkIn, scenario.checkOut, scenario.guests);
      return;
    }
    
    // Check for error messages on current page
    if (elements.errorMessage) {
      const errorText = elements.errorMessage.textContent.trim();
      if (errorText) {
        logTest(`Found error message in UI: ${errorText}`);
        if (errorText.toLowerCase().includes('unavailable') || errorText.toLowerCase().includes('not available')) {
          logTest('UI correctly shows unavailability message');
        }
      }
    }
    
    logTest('Found booking elements in UI, check for error messages or disabled booking button');
    
    // If book button exists, check if it's disabled
    if (elements.bookButton) {
      if (elements.bookButton.disabled || elements.bookButton.classList.contains('disabled')) {
        logTest('Book button is correctly disabled due to unavailability');
      } else {
        logTest('Book button appears to be enabled - unavailability might not be detected in UI', true);
      }
    }
    
    // Offer direct navigation for easier testing
    navigateToTestCase(scenario.checkIn, scenario.checkOut, scenario.guests);
  }

  async function testBlockedCheckoutDate() {
    const scenario = createTestScenarios().blockedDates[1];
    logTest(`Starting test: ${scenario.name}`);
    
    // Call the API directly
    const apiResult = await checkPricingAPI(scenario.checkIn, scenario.checkOut, scenario.guests);
    
    if (apiResult) {
      if (apiResult.available) {
        logTest(`API correctly allowed booking with checkout on potentially unavailable date`);
      } else {
        logTest(`API rejected booking with reason: ${apiResult.reason}`, true);
      }
    }
    
    // Check UI elements if available
    const elements = getBookingElements();
    if (elements.bookButton && !elements.bookButton.disabled) {
      logTest(`UI correctly allows booking with checkout date blocked`);
    }
    
    // Offer direct navigation for testing
    navigateToTestCase(scenario.checkIn, scenario.checkOut, scenario.guests);
  }
  
  async function testBelowMinimumStay() {
    const scenario = createTestScenarios().minStay[0];
    logTest(`Starting test: ${scenario.name}`);
    
    // Call the API directly
    const apiResult = await checkPricingAPI(scenario.checkIn, scenario.checkOut, scenario.guests);
    
    if (apiResult) {
      if (!apiResult.available && apiResult.reason === 'minimum_stay') {
        logTest(`API correctly rejected booking with too short stay. Minimum required: ${apiResult.minimumStay} nights`);
      } else if (apiResult.available) {
        logTest(`API allowed booking - either no minimum stay requirement or requirement is satisfied`);
      } else {
        logTest(`API rejected booking for reason: ${apiResult.reason}`);
      }
    }
    
    // Check UI elements if available
    const elements = getBookingElements();
    if (elements.errorMessage) {
      const errorText = elements.errorMessage.textContent.trim();
      if (errorText && errorText.toLowerCase().includes('minimum stay')) {
        logTest(`UI correctly shows minimum stay error: ${errorText}`);
      }
    }
    
    // Offer direct navigation for testing
    navigateToTestCase(scenario.checkIn, scenario.checkOut, scenario.guests);
  }
  
  async function testExactMinimumStay() {
    const scenario = createTestScenarios().minStay[1];
    logTest(`Starting test: ${scenario.name}`);
    
    // Call the API directly
    const apiResult = await checkPricingAPI(scenario.checkIn, scenario.checkOut, scenario.guests);
    
    if (apiResult) {
      if (apiResult.available) {
        logTest(`API correctly allowed booking that meets minimum stay requirement`);
      } else {
        logTest(`API rejected booking with reason: ${apiResult.reason}`, true);
      }
    }
    
    // Check UI elements if available
    const elements = getBookingElements();
    if (elements.bookButton && !elements.bookButton.disabled) {
      logTest(`UI correctly allows booking that meets minimum stay requirement`);
    }
    
    // Offer direct navigation for testing
    navigateToTestCase(scenario.checkIn, scenario.checkOut, scenario.guests);
  }
  
  async function testGuestCount(guestCount) {
    logTest(`Starting guest count test with ${guestCount} guests`);
    
    // Find right scenario based on guest count
    const scenarios = createTestScenarios().guestCount;
    const scenario = scenarios.find(s => s.guests === guestCount) || scenarios[0];
    
    // Call the API directly
    const apiResult = await checkPricingAPI(scenario.checkIn, scenario.checkOut, guestCount);
    
    if (apiResult && apiResult.available && apiResult.pricing) {
      logTest(`API returned pricing for ${guestCount} guests: ${apiResult.pricing.totalPrice} ${apiResult.pricing.currency}`);
      
      // Check if pricing varies for different guest counts
      const basePrice = await checkPricingAPI(scenario.checkIn, scenario.checkOut, 2);
      if (basePrice && basePrice.available && basePrice.pricing) {
        const baseTotalPrice = basePrice.pricing.totalPrice;
        const currentTotalPrice = apiResult.pricing.totalPrice;
        
        if (baseTotalPrice !== currentTotalPrice) {
          logTest(`Price difference detected: Base (2 guests): ${baseTotalPrice}, Current (${guestCount} guests): ${currentTotalPrice}`);
        } else {
          logTest(`No price difference detected between 2 and ${guestCount} guests`);
        }
      }
    } else if (apiResult) {
      logTest(`API rejected booking with reason: ${apiResult.reason}`, true);
    }
    
    // Check UI for price display if we're on the right page
    const elements = getBookingElements();
    if (elements.priceDisplay) {
      logTest(`UI shows price: ${elements.priceDisplay.textContent}`);
    }
    
    // Offer direct navigation for testing
    navigateToTestCase(scenario.checkIn, scenario.checkOut, guestCount);
  }
  
  async function testDateRange(rangeType) {
    logTest(`Starting date range test: ${rangeType}`);
    
    let scenario;
    switch(rangeType) {
      case 'weekend':
        scenario = createTestScenarios().dateRanges[0];
        break;
      case 'week':
        scenario = createTestScenarios().dateRanges[1];
        break;
      case 'month-ahead':
        scenario = createTestScenarios().dateRanges[2];
        break;
      default:
        scenario = createTestScenarios().dateRanges[0];
    }
    
    // Call the API directly
    const apiResult = await checkPricingAPI(scenario.checkIn, scenario.checkOut, scenario.guests);
    
    if (apiResult && apiResult.available && apiResult.pricing) {
      const nights = Object.keys(apiResult.pricing.dailyRates).length;
      logTest(`API returned pricing for ${rangeType} stay (${nights} nights): ${apiResult.pricing.totalPrice} ${apiResult.pricing.currency}`);
      
      // Check if there's pricing variation
      const rates = Object.values(apiResult.pricing.dailyRates);
      const minRate = Math.min(...rates);
      const maxRate = Math.max(...rates);
      
      if (minRate !== maxRate) {
        logTest(`Price variation detected: Min: ${minRate}, Max: ${maxRate}, Range: ${Math.round(maxRate - minRate)} ${apiResult.pricing.currency}`);
        
        // Check for weekend pricing
        if (rangeType === 'weekend') {
          logTest(`Weekend pricing test: Higher rates on weekend days would indicate weekend pricing`);
        }
      } else {
        logTest(`No price variation detected - flat rate of ${minRate} ${apiResult.pricing.currency} across all days`);
      }
      
      // Check for length of stay discount
      if (apiResult.pricing.lengthOfStayDiscount && apiResult.pricing.lengthOfStayDiscount.discountAmount > 0) {
        logTest(`Length of stay discount applied: ${apiResult.pricing.lengthOfStayDiscount.discountPercentage}% (${apiResult.pricing.lengthOfStayDiscount.discountAmount} ${apiResult.pricing.currency})`);
      }
    } else if (apiResult) {
      logTest(`API rejected booking with reason: ${apiResult.reason}`, true);
    }
    
    // Check UI booking summary if available
    const elements = getBookingElements();
    if (elements.bookingSummary) {
      logTest(`UI shows booking summary. Check for proper calculation of ${nights} nights`);
    }
    
    // Offer direct navigation for testing
    navigateToTestCase(scenario.checkIn, scenario.checkOut, scenario.guests);
  }

  // Initialize
  createTestUI();
  logTest('Test panel initialized. Select a test to run.');
  logTest(`Testing property: ${propertySlug}`);
})();