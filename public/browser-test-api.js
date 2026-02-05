/**
 * API-Based Test Script for Pricing and Availability
 *
 * This script builds test scenarios by directly querying the API instead of
 * using Firebase. It creates a test panel to help verify pricing and availability
 * behavior through both API and UI testing.
 *
 * Usage:
 * 1. Navigate to a booking page in your browser (e.g., http://localhost:9002/booking/check/prahova-mountain-chalet)
 * 2. Open the browser console (F12 or right-click > Inspect > Console)
 * 3. Paste this entire script and press Enter
 * 4. The test panel will appear at the bottom of the page
 */

(async function() {
  console.log('Initializing API-based test panel...');

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

  // Remove existing test panel if it exists
  const existingPanel = document.getElementById('pricing-test-panel');
  if (existingPanel) {
    try {
      document.body.removeChild(existingPanel);
      console.log('Removed existing test panel');
    } catch (e) {
      console.error('Error removing existing panel:', e);
    }
  }

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
    },

    // Get next Friday
    getNextFriday(startDate = new Date()) {
      const date = new Date(startDate);
      while (date.getDay() !== 5) { // 5 is Friday
        date.setDate(date.getDate() + 1);
      }
      return date;
    },

    // Get next Sunday
    getNextSunday(startDate = new Date()) {
      const friday = this.getNextFriday(startDate);
      const sunday = new Date(friday);
      sunday.setDate(friday.getDate() + 2);
      return sunday;
    }
  };

  // Log messages array for the logs tab
  const logMessages = [];

  // Helper to log messages
  function log(message, isError = false) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const formattedMessage = `[${timestamp}] ${isError ? '❌ ' : '✅ '} ${message}`;

    console.log(isError ? 'ERROR: ' + message : message);
    logMessages.push(formattedMessage);

    // Update logs tab if it's currently shown
    const currentTab = document.querySelector('[style*="border-bottom: 2px solid rgb(0, 123, 255)"]');
    if (currentTab && currentTab.id === 'tab-logs') {
      showTabContent('logs');
    }
  }

  // Status indicator during data loading
  function showLoadingIndicator() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'test-panel-loading';
    loadingDiv.style.position = 'fixed';
    loadingDiv.style.bottom = '20px';
    loadingDiv.style.right = '20px';
    loadingDiv.style.background = '#007bff';
    loadingDiv.style.color = 'white';
    loadingDiv.style.padding = '10px 15px';
    loadingDiv.style.borderRadius = '4px';
    loadingDiv.style.zIndex = '10000';
    loadingDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    loadingDiv.style.fontFamily = 'Arial, sans-serif';
    loadingDiv.innerHTML = 'Discovering test scenarios...';

    document.body.appendChild(loadingDiv);
    return loadingDiv;
  }

  function removeLoadingIndicator() {
    const loadingDiv = document.getElementById('test-panel-loading');
    if (loadingDiv) {
      document.body.removeChild(loadingDiv);
    }
  }

  // Create test UI panel
  function createTestPanel(testScenarios) {
    // Create container
    const panel = document.createElement('div');
    panel.id = 'pricing-test-panel';
    panel.style.position = 'fixed';
    panel.style.bottom = '0';
    panel.style.left = '0';
    panel.style.right = '0';
    panel.style.backgroundColor = '#f8f9fa';
    panel.style.borderTop = '2px solid #dee2e6';
    panel.style.padding = '15px';
    panel.style.zIndex = '9999';
    panel.style.boxShadow = '0 -2px 10px rgba(0,0,0,0.1)';
    panel.style.fontFamily = 'Arial, sans-serif';
    panel.style.fontSize = '14px';
    panel.style.maxHeight = '50vh';
    panel.style.overflowY = 'auto';

    // Create header
    const header = document.createElement('div');
    header.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0; color: #333;">Pricing & Availability Test Panel</h3>
        <button id="close-test-panel" style="border: none; background: #f44336; color: white; padding: 5px 10px; cursor: pointer; border-radius: 4px;">Close</button>
      </div>
      <p>Property: <strong>${propertySlug}</strong></p>
    `;
    panel.appendChild(header);

    // Add tabs
    const tabContainer = document.createElement('div');
    tabContainer.style.display = 'flex';
    tabContainer.style.borderBottom = '1px solid #dee2e6';
    tabContainer.style.marginBottom = '15px';

    const tabs = [
      { id: 'blocked-dates', label: 'Blocked Dates' },
      { id: 'min-stay', label: 'Min Stay' },
      { id: 'guest-count', label: 'Guest Count' },
      { id: 'date-ranges', label: 'Date Ranges' },
      { id: 'logs', label: 'Test Logs' }
    ];

    tabs.forEach((tab, index) => {
      const tabBtn = document.createElement('button');
      tabBtn.innerText = tab.label;
      tabBtn.id = 'tab-' + tab.id;
      tabBtn.style.padding = '8px 15px';
      tabBtn.style.cursor = 'pointer';
      tabBtn.style.background = 'none';
      tabBtn.style.border = 'none';

      if (index === 0) {
        tabBtn.style.borderBottom = '2px solid #007bff';
      }

      tabBtn.onclick = function() {
        // Remove active from all tabs
        tabs.forEach(t => {
          document.getElementById('tab-' + t.id).style.borderBottom = 'none';
        });

        // Set active on clicked tab
        this.style.borderBottom = '2px solid #007bff';

        // Show appropriate content
        showTabContent(tab.id, testScenarios);
      };

      tabContainer.appendChild(tabBtn);
    });

    panel.appendChild(tabContainer);

    // Content area
    const contentArea = document.createElement('div');
    contentArea.id = 'test-content-area';
    panel.appendChild(contentArea);

    // Close button handler
    document.body.appendChild(panel);
    document.getElementById('close-test-panel').onclick = function() {
      document.body.removeChild(panel);
    };

    // Show initial tab
    showTabContent('blocked-dates', testScenarios);
  }

  // Show appropriate tab content
  function showTabContent(tabId, scenarios) {
    const contentArea = document.getElementById('test-content-area');

    switch(tabId) {
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
            ${logMessages.length ? logMessages.join('<br>') : 'No logs yet. Run some tests to see results.'}
          </div>
        `;
        break;
    }
  }

  // Render test scenarios
  function renderScenarios(container, scenarios, title) {
    if (!scenarios || scenarios.length === 0) {
      // Show meaningful information about what the absence of tests means
      container.innerHTML = `
        <h4 style="margin-top: 0;">${title}</h4>
        <div style="padding: 20px; text-align: center; color: #666; border: 1px dashed #ccc; border-radius: 4px; margin-bottom: 20px;">
          <p><strong>No ${title.toLowerCase()} found for this property.</strong></p>
          <p>This is useful information! It means:</p>
          ${title === 'Blocked Date Tests' ?
            '<p>• No unavailable dates were found in the next 3 months</p><p>• All dates appear to be available for booking</p>' :
            title === 'Minimum Stay Tests' ?
            '<p>• No minimum stay requirements detected for this property</p><p>• Guests can book any number of nights (1+)</p>' :
            title === 'Guest Count Tests' ?
            '<p>• No price variation based on guest count was detected</p><p>• The price appears to be the same regardless of party size</p>' :
            '<p>• No special pricing for different lengths of stay was detected</p><p>• No discounts for longer stays were found</p>'
          }
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <h4 style="margin-top: 0;">${title} (${scenarios.length} scenarios)</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 15px;">
        ${scenarios.map((scenario, i) => {
          // Calculate nights for better display
          const nights = Math.round((scenario.checkOut - scenario.checkIn) / (1000 * 60 * 60 * 24));

          // Create custom labels based on test type
          let statusBadge = '';
          let keyInfo = '';

          if (title === 'Blocked Date Tests') {
            const badgeColor = scenario.expectedOutcome === 'rejected' ? '#dc3545' : '#28a745';
            const badgeText = scenario.expectedOutcome === 'rejected' ? 'Unavailable' : 'Checkout OK';
            statusBadge = `<span style="display: inline-block; background: ${badgeColor}; color: white; font-size: 10px; font-weight: bold; padding: 3px 6px; border-radius: 10px; margin-left: 5px;">${badgeText}</span>`;

            // No extra keyInfo needed - already in the title and description
            keyInfo = '';
          } else if (title === 'Minimum Stay Tests') {
            const badgeColor = scenario.expectedOutcome === 'rejected' ? '#dc3545' : '#28a745';
            statusBadge = `<span style="display: inline-block; background: ${badgeColor}; color: white; font-size: 10px; font-weight: bold; padding: 3px 6px; border-radius: 10px; margin-left: 5px;">${scenario.expectedOutcome === 'rejected' ? 'Too Short' : 'Valid Stay'}</span>`;

            // No extra keyInfo needed - already in description
            keyInfo = '';
          }

          return `
          <div style="border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <h5 style="margin-top: 0; margin-bottom: 10px; flex: 1;">${scenario.name} ${statusBadge}</h5>
              <span style="font-size: 11px; background: #f8f9fa; padding: 2px 6px; border-radius: 3px; color: #495057; font-weight: 600;">${nights} night${nights !== 1 ? 's' : ''}</span>
            </div>

            <p style="margin-bottom: 10px; color: #666; font-size: 13px;">${scenario.description}</p>

            ${keyInfo ? `<div style="margin-bottom: 8px; background: #f8f9fa; padding: 5px 8px; border-radius: 4px; font-size: 12px; border-left: 3px solid #007bff;">
              <strong>${keyInfo}</strong>
            </div>` : ''}

            <div style="display: flex; margin-bottom: 8px;">
              <div style="flex: 1; border: 1px solid #e9ecef; border-radius: 4px; padding: 8px; margin-right: 5px;">
                <div style="font-size: 11px; text-transform: uppercase; color: #6c757d; font-weight: 600; margin-bottom: 3px;">Check-in</div>
                <div style="display: flex; align-items: center;">
                  <div style="background: ${scenario.expectedOutcome === 'allowed' || title !== 'Blocked Date Tests' ? '#e9f7ef' : '#f8d9d7'}; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px;"></div>
                  <strong style="font-size: 12px;">${utils.formatDate(scenario.checkIn)}</strong>
                </div>
                <div style="font-size: 10px; color: #6c757d; margin-top: 2px;">${scenario.checkIn.toLocaleDateString('en-US', {weekday: 'short'})}</div>
              </div>

              <div style="flex: 1; border: 1px solid #e9ecef; border-radius: 4px; padding: 8px;">
                <div style="font-size: 11px; text-transform: uppercase; color: #6c757d; font-weight: 600; margin-bottom: 3px;">Check-out</div>
                <div style="display: flex; align-items: center;">
                  <div style="background: ${title === 'Blocked Date Tests' && scenario.name.includes('Checkout') ? '#f8d9d7' : '#e9f7ef'}; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px;"></div>
                  <strong style="font-size: 12px;">${utils.formatDate(scenario.checkOut)}</strong>
                </div>
                <div style="font-size: 10px; color: #6c757d; margin-top: 2px;">${scenario.checkOut.toLocaleDateString('en-US', {weekday: 'short'})}</div>
              </div>
            </div>

            <div style="display: flex; align-items: center; margin-bottom: 8px; background: #f8f9fa; border-radius: 4px; padding: 5px 8px;">
              <div style="flex: 1; font-size: 11px;">
                <span style="color: #6c757d; text-transform: uppercase; font-weight: 600; margin-right: 5px;">Guests:</span>
                <strong>${scenario.guests}</strong>
                ${title === 'Guest Count Tests' && scenario.expectedPriceDifference ?
                  `<span style="display: inline-block; background: ${scenario.expectedPriceDifference.startsWith('+') ? '#f8d9d7' : '#e9f7ef'}; color: ${scenario.expectedPriceDifference.startsWith('+') ? '#dc3545' : '#28a745'}; font-size: 10px; padding: 0px 4px; border-radius: 3px; margin-left: 5px; font-weight: bold;">${scenario.expectedPriceDifference}</span>` :
                  ''}
              </div>

              ${scenario.expectedOutcome ?
                `<div style="font-size: 11px;">
                  <span style="color: #6c757d; text-transform: uppercase; font-weight: 600; margin-right: 5px;">Expected:</span>
                  <span style="color: ${scenario.expectedOutcome === 'allowed' ? '#28a745' : '#dc3545'}; font-weight: bold;">
                    ${scenario.expectedOutcome === 'allowed' ? '✓ Allowed' : '✗ Rejected'}
                  </span>
                </div>` :
                ''}
            </div>

            <div style="display: flex; gap: 10px;">
              <button class="test-api-btn" data-index="${i}" data-category="${title}" style="flex: 1; background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: 500;">Test API</button>
              <button class="open-ui-btn" data-index="${i}" data-category="${title}" style="flex: 1; background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: 500;">Test UI</button>
            </div>
          </div>
          `;
        }).join('')}
      </div>
    `;

    // Add event handlers
    const apiButtons = container.querySelectorAll('.test-api-btn');
    for (let i = 0; i < apiButtons.length; i++) {
      const btn = apiButtons[i];
      btn.onclick = function() {
        const index = parseInt(this.getAttribute('data-index'), 10);
        const category = this.getAttribute('data-category');
        runApiTest(category, index, scenarios);
      };
    }

    const uiButtons = container.querySelectorAll('.open-ui-btn');
    for (let i = 0; i < uiButtons.length; i++) {
      const btn = uiButtons[i];
      btn.onclick = function() {
        const index = parseInt(this.getAttribute('data-index'), 10);
        const category = this.getAttribute('data-category');
        openUiTest(category, index, scenarios);
      };
    }
  }

  // Run an API test
  async function runApiTest(category, index, scenarios) {
    const scenario = scenarios[index];
    if (!scenario) return;

    log(`Running API test: ${scenario.name}`);

    try {
      const response = await fetch('/api/check-pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId: propertySlug,
          checkIn: utils.formatDateISO(scenario.checkIn),
          checkOut: utils.formatDateISO(scenario.checkOut),
          guests: scenario.guests
        }),
      });

      const data = await response.json();

      // Log detailed results
      if (data.available) {
        log(`API allows booking for "${scenario.name}"`);

        // Check if this matches expected outcome
        if (scenario.expectedOutcome === 'rejected') {
          log(`❓ Unexpected result: API allowed booking but we expected rejection`, true);
        } else {
          log(`✅ Result matches expected outcome: Booking allowed`);
        }

        log(`Total price: ${data.pricing.total} ${data.pricing.currency}`);

        // Check for discounts
        if (data.pricing.lengthOfStayDiscount && data.pricing.lengthOfStayDiscount.discountAmount > 0) {
          log(`Length of stay discount: ${data.pricing.lengthOfStayDiscount.discountPercentage}% (${data.pricing.lengthOfStayDiscount.discountAmount} ${data.pricing.currency})`);
        }

        // Analyze daily rates
        const dailyRates = Object.entries(data.pricing.dailyRates);
        if (dailyRates.length > 0) {
          const prices = dailyRates.map(([date, price]) => price);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);

          log(`Daily rate range: ${minPrice} to ${maxPrice} ${data.pricing.currency}`);

          if (minPrice !== maxPrice) {
            log(`Dynamic pricing detected - different rates on different days`);

            // Check for weekend pricing
            const weekendDates = dailyRates.filter(([dateStr]) => {
              const date = new Date(dateStr);
              return date.getDay() === 5 || date.getDay() === 6; // Friday or Saturday
            });

            if (weekendDates.length > 0) {
              const weekendPrices = weekendDates.map(([, price]) => price);
              const weekdayPrices = dailyRates
                .filter(([dateStr]) => {
                  const date = new Date(dateStr);
                  return date.getDay() !== 5 && date.getDay() !== 6;
                })
                .map(([, price]) => price);

              if (weekendPrices.length > 0 && weekdayPrices.length > 0) {
                const avgWeekendPrice = weekendPrices.reduce((sum, p) => sum + p, 0) / weekendPrices.length;
                const avgWeekdayPrice = weekdayPrices.reduce((sum, p) => sum + p, 0) / weekdayPrices.length;

                if (avgWeekendPrice > avgWeekdayPrice) {
                  const increase = Math.round((avgWeekendPrice / avgWeekdayPrice - 1) * 100);
                  log(`Weekend pricing detected: ~${increase}% higher than weekdays`);
                }
              }
            }
          }
        }
      } else {
        log(`API rejects booking for "${scenario.name}": ${data.reason}`);

        // Check if this matches expected outcome
        if (scenario.expectedOutcome === 'allowed') {
          log(`❓ Unexpected result: API rejected booking but we expected it to be allowed`, true);
        } else {
          log(`✅ Result matches expected outcome: Booking rejected due to ${data.reason}`);
        }

        // Additional details for specific failure reasons
        if (data.reason === 'minimum_stay') {
          log(`Minimum stay required: ${data.minimumStay} nights`);
        } else if (data.reason === 'unavailable_dates') {
          log(`Unavailable dates: ${data.unavailableDates?.join(', ')}`);
        }
      }
    } catch (error) {
      log(`API error: ${error.message}`, true);
    }
  }

  // Open test case in UI
  function openUiTest(category, index, scenarios) {
    const scenario = scenarios[index];
    if (!scenario) return;

    // Format dates for URL
    const checkInStr = utils.formatDateISO(scenario.checkIn);
    const checkOutStr = utils.formatDateISO(scenario.checkOut);

    // Build URL for booking check page
    const url = `${document.location.origin}/booking/check/${propertySlug}?checkIn=${checkInStr}&checkOut=${checkOutStr}&guests=${scenario.guests}`;

    // Open in new tab
    log(`Opening test case in new tab: ${scenario.name}`);
    window.open(url, '_blank');
  }

  // Check availability to find blocked dates
  async function findBlockedDates() {
    try {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() + 7);
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 90); // Look 3 months ahead

      log(`Checking availability from ${utils.formatDate(startDate)} to ${utils.formatDate(endDate)}...`);

      // Query the API to get unavailable dates
      const response = await fetch(`/api/check-availability?propertySlug=${propertySlug}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Process unavailable dates if they exist
      if (data.unavailableDates && Array.isArray(data.unavailableDates) && data.unavailableDates.length > 0) {
        const unavailableDates = data.unavailableDates
          .map(dateStr => new Date(dateStr))
          // Filter out past dates
          .filter(date => date > today)
          // Sort by date
          .sort((a, b) => a.getTime() - b.getTime());

        log(`Found ${unavailableDates.length} unavailable dates in the next 3 months`);

        // No hardcoded dates - using only data from the API

        // Identify and log any consecutive blocked dates for debugging
        let consecutiveBlocks = [];
        let currentBlock = [];

        // First, ensure the dates are sorted chronologically
        unavailableDates.sort((a, b) => a.getTime() - b.getTime());

        // Create consecutive blocks by identifying dates that are exactly 1 day apart
        for (let i = 0; i < unavailableDates.length; i++) {
          const current = unavailableDates[i];

          if (currentBlock.length === 0) {
            currentBlock.push(current);
          } else {
            const previous = currentBlock[currentBlock.length - 1];
            const oneDayAfter = new Date(previous);
            oneDayAfter.setDate(previous.getDate() + 1);

            // Compare dates using ISO string format to avoid time issues
            if (utils.formatDateISO(oneDayAfter) === utils.formatDateISO(current)) {
              // This date is consecutive to the previous one
              currentBlock.push(current);
            } else {
              // Not consecutive, start a new block
              if (currentBlock.length > 1) {
                consecutiveBlocks.push([...currentBlock]);
              }
              currentBlock = [current];
            }
          }
        }

        // Add the last block if it has consecutive dates
        if (currentBlock.length > 1) {
          consecutiveBlocks.push([...currentBlock]);
        }

        // Log detailed information about consecutive blocks for debugging
        if (consecutiveBlocks.length > 0) {
          log(`Found ${consecutiveBlocks.length} blocks of consecutive unavailable dates:`);
          consecutiveBlocks.forEach((block, index) => {
            const dateRange = `${utils.formatDate(block[0])} to ${utils.formatDate(block[block.length - 1])}`;
            log(`  Block ${index + 1}: ${dateRange} (${block.length} days):`);

            // Log individual dates in each block for verification
            block.forEach(date => {
              log(`    - ${utils.formatDate(date)} [${utils.formatDateISO(date)}]`);
            });

            // General warning for all consecutive blocks - no hardcoded dates
            log(`    ⚠️ NOTE: Consecutive blocked dates in this block should not generate "Blocked Checkout" tests`);
          });
        }

        return unavailableDates;
      } else {
        log('No unavailable dates found through the API');
        return [];
      }
    } catch (error) {
      log(`Error finding blocked dates: ${error.message}`, true);
      return [];
    }
  }

  // Discover tests by using the API
  async function discoverTestScenarios() {
    const loadingIndicator = showLoadingIndicator();

    try {
      const today = new Date();

      // Start with empty scenarios - we'll only add real test cases
      const scenarios = {
        blockedDates: [],
        minStay: [],
        guestCount: [],
        dateRanges: []
      };

      // Check if dates are blocked
      const blockedDates = await findBlockedDates();

      // Generate blocked date tests only if we found real blocked dates
      if (blockedDates.length > 0) {
        log(`Found ${blockedDates.length} blocked dates to test with`);

        // First, convert blockedDates array to strings for easier checking
        const blockedDateStrings = blockedDates.map(date => utils.formatDateISO(date));

        // Create a utility function to check if a date is blocked
        const isDateBlocked = (date) => {
          const dateStr = utils.formatDateISO(date);
          const isBlocked = blockedDateStrings.includes(dateStr);

          // Log detailed debugging information for important checks
          if ((date.getMonth() === 4 && date.getDate() === 13) ||
              (date.getMonth() === 4 && date.getDate() === 14)) {

            const formattedDate = utils.formatDate(date);
            log(`🔍 DETAILED DATE CHECK: ${formattedDate} (${dateStr}) is ${isBlocked ? 'BLOCKED' : 'AVAILABLE'}`);
            log(`🔍 Full blockedDateStrings array: ${JSON.stringify(blockedDateStrings)}`);
          }

          return isBlocked;
        };

        // First identify consecutive blocks of dates
        // Identify and log any consecutive blocked dates for debugging
        let consecutiveBlocks = [];
        let currentBlock = [];

        // First, ensure the dates are sorted chronologically
        const sortedDates = [...blockedDates].sort((a, b) => a.getTime() - b.getTime());

        // Create consecutive blocks by identifying dates that are exactly 1 day apart
        for (let i = 0; i < sortedDates.length; i++) {
          const current = sortedDates[i];

          if (currentBlock.length === 0) {
            currentBlock.push(current);
          } else {
            const previous = currentBlock[currentBlock.length - 1];
            const oneDayAfter = new Date(previous);
            oneDayAfter.setDate(previous.getDate() + 1);

            // Compare dates using ISO string format to avoid time issues
            if (utils.formatDateISO(oneDayAfter) === utils.formatDateISO(current)) {
              // This date is consecutive to the previous one
              currentBlock.push(current);
            } else {
              // Not consecutive, start a new block
              if (currentBlock.length > 1) {
                consecutiveBlocks.push([...currentBlock]);
              }
              currentBlock = [current];
            }
          }
        }

        // Add the last block if it has consecutive dates
        if (currentBlock.length > 1) {
          consecutiveBlocks.push([...currentBlock]);
        }

        // Log detailed information about consecutive blocks for debugging
        if (consecutiveBlocks.length > 0) {
          log(`Found ${consecutiveBlocks.length} blocks of consecutive unavailable dates:`);
          consecutiveBlocks.forEach((block, index) => {
            const dateRange = `${utils.formatDate(block[0])} to ${utils.formatDate(block[block.length - 1])}`;
            log(`  Block ${index + 1}: ${dateRange} (${block.length} days):`);

            // Log individual dates in each block for verification
            block.forEach(date => {
              log(`    - ${utils.formatDate(date)} [${utils.formatDateISO(date)}]`);
            });

            // General warning for all consecutive blocks - no hardcoded dates
            log(`    ⚠️ NOTE: Consecutive blocked dates in this block should not generate "Blocked Checkout" tests`);
          });
        }

        // Instead of just taking the first 5 dates, look for dates that will create good test scenarios
        const candidateDates = [];
        let processedDates = 0;

        // Filter out dates in consecutive blocks before selecting candidates
        log(`Excluding dates in consecutive blocks from candidates (better for testing)...`);

        // Create a set of dates that are part of consecutive blocks
        const datesInConsecutiveBlocks = new Set();

        for (const block of consecutiveBlocks) {
          for (const date of block) {
            datesInConsecutiveBlocks.add(utils.formatDateISO(date));
          }
        }

        log(`Found ${datesInConsecutiveBlocks.size} dates that are part of consecutive blocks`);

        // First, try to find isolated blocked dates (not part of consecutive blocks)
        for (let i = 0; i < blockedDates.length && candidateDates.length < 5 && processedDates < 20; i++) {
          const blockedDate = blockedDates[i];
          const blockedDateStr = utils.formatDateISO(blockedDate);
          processedDates++;

          // Skip dates that are part of consecutive blocks for first pass
          if (datesInConsecutiveBlocks.has(blockedDateStr)) {
            continue;
          }

          // For "blocked middle" test, we need an available day before and an available day after
          const dayBefore = new Date(blockedDate);
          dayBefore.setDate(blockedDate.getDate() - 1);

          const dayAfter = new Date(blockedDate);
          dayAfter.setDate(blockedDate.getDate() + 1);

          const isBeforeBlocked = isDateBlocked(dayBefore);
          const isAfterBlocked = isDateBlocked(dayAfter);

          if (!isBeforeBlocked && !isAfterBlocked) {
            // This is a good isolated blocked date
            log(`Found isolated blocked date ${utils.formatDate(blockedDate)} - ideal for testing`);
            candidateDates.push(blockedDate);
          }
        }

        // If we don't have enough isolated dates, now try dates with at least day before available
        if (candidateDates.length < 3) {
          log(`Not enough isolated dates found, looking for dates with day before available...`);

          for (let i = 0; i < blockedDates.length && candidateDates.length < 5 && processedDates < 30; i++) {
            const blockedDate = blockedDates[i];
            const blockedDateStr = utils.formatDateISO(blockedDate);

            // Skip dates we've already processed
            if (candidateDates.some(d => utils.formatDateISO(d) === blockedDateStr)) {
              continue;
            }

            processedDates++;

            // Check if day before is available
            const dayBefore = new Date(blockedDate);
            dayBefore.setDate(blockedDate.getDate() - 1);

            const isBeforeBlocked = isDateBlocked(dayBefore);

            if (!isBeforeBlocked) {
              // Skip if it's in a consecutive block (not first day)
              if (datesInConsecutiveBlocks.has(blockedDateStr)) {
                log(`Skipping ${utils.formatDate(blockedDate)} despite available day before - part of consecutive block`);
                continue;
              }

              // Day before is available, can use for limited testing
              log(`Found blocked date ${utils.formatDate(blockedDate)} with day before available`);
              candidateDates.push(blockedDate);
            }
          }
        }

        // NEW: If still no candidates, create checkout tests for the FIRST day of each consecutive block
        if (candidateDates.length === 0 && consecutiveBlocks.length > 0) {
          log(`No isolated dates found, creating checkout tests for first day of consecutive blocks...`);

          for (const block of consecutiveBlocks) {
            if (candidateDates.length >= 5) break;

            const firstDayOfBlock = block[0];
            const dayBefore = new Date(firstDayOfBlock);
            dayBefore.setDate(firstDayOfBlock.getDate() - 1);

            // Check if day before first day of block is available
            if (!isDateBlocked(dayBefore)) {
              log(`Found first day of consecutive block ${utils.formatDate(firstDayOfBlock)} - can create checkout test`);

              // Create checkout test directly for first day of consecutive block
              const twoDaysBefore = new Date(firstDayOfBlock);
              twoDaysBefore.setDate(firstDayOfBlock.getDate() - 2);

              if (!isDateBlocked(twoDaysBefore)) {
                scenarios.blockedDates.push({
                  name: `Checkout on Block Start: ${utils.formatDate(firstDayOfBlock)}`,
                  description: `Checkout on first day of consecutive block (should be allowed - guest is leaving)`,
                  checkIn: twoDaysBefore,
                  checkOut: firstDayOfBlock,
                  guests: 2,
                  expectedOutcome: 'allowed'
                });
                log(`✅ Created checkout test for ${utils.formatDate(firstDayOfBlock)}`);
              }

              // Also add a "booking spans blocked dates" rejection test
              const lastDayOfBlock = block[block.length - 1];
              const dayAfterBlock = new Date(lastDayOfBlock);
              dayAfterBlock.setDate(lastDayOfBlock.getDate() + 1);

              if (!isDateBlocked(dayAfterBlock)) {
                scenarios.blockedDates.push({
                  name: `Spans Block: ${utils.formatDate(firstDayOfBlock)}`,
                  description: `Booking that spans blocked dates (should be rejected)`,
                  checkIn: dayBefore,
                  checkOut: dayAfterBlock,
                  guests: 2,
                  expectedOutcome: 'rejected'
                });
                log(`✅ Created rejection test spanning block from ${utils.formatDate(firstDayOfBlock)}`);
              }
            }
          }
        }

        log(`Identified ${candidateDates.length} good candidate dates for testing`);

        // Process each candidate date to generate test scenarios
        for (const blockedDate of candidateDates) {
          const blockedDateStr = utils.formatDateISO(blockedDate);

          // For "blocked middle" test, check if we can find an available day before and after
          const dayBefore = new Date(blockedDate);
          dayBefore.setDate(blockedDate.getDate() - 1);

          const dayAfter = new Date(blockedDate);
          dayAfter.setDate(blockedDate.getDate() + 1);

          // Only create a "blocked middle" test if day before is available
          if (!isDateBlocked(dayBefore)) {
            // We found at least one available day before the blocked date
            const twoDaysAfter = new Date(blockedDate);
            twoDaysAfter.setDate(blockedDate.getDate() + 2);

            // Check if the end date for our test would be blocked too
            if (!isDateBlocked(twoDaysAfter)) {
              log(`Creating "Blocked Middle" test for ${utils.formatDate(blockedDate)}`);

              scenarios.blockedDates.push({
                name: `Blocked Date: ${utils.formatDate(blockedDate)}`,
                description: `Tests booking with unavailable date in the stay period`,
                checkIn: dayBefore,
                checkOut: twoDaysAfter,
                guests: 2,
                expectedOutcome: 'rejected'
              });
            } else {
              log(`Not creating "Blocked Middle" test for ${utils.formatDate(blockedDate)} because end date is also blocked`);
            }

            // Now check for "Blocked Checkout" test
            // We need the night before checkout to be available and checkout day to be blocked
            const twoDaysBefore = new Date(blockedDate);
            twoDaysBefore.setDate(blockedDate.getDate() - 2);

            const nightBeforeCheckout = new Date(blockedDate);
            nightBeforeCheckout.setDate(blockedDate.getDate() - 1);

            // Add comprehensive debug logging
            const nightBeforeStr = utils.formatDateISO(nightBeforeCheckout);
            const blockedDateStr = utils.formatDateISO(blockedDate);
            const isNightBeforeBlocked = isDateBlocked(nightBeforeCheckout);
            const isTwoDaysBeforeBlocked = isDateBlocked(twoDaysBefore);

            log(`CHECKOUT TEST DEBUG for ${utils.formatDate(blockedDate)}:`);
            log(` - Date (${utils.formatDate(blockedDate)}) [${blockedDateStr}] is blocked? ${isDateBlocked(blockedDate)}`);
            log(` - Night before (${utils.formatDate(nightBeforeCheckout)}) [${nightBeforeStr}] is blocked? ${isNightBeforeBlocked}`);
            log(` - Two days before (${utils.formatDate(twoDaysBefore)}) is blocked? ${isTwoDaysBeforeBlocked}`);

            // Double-check with explicit string search in the blocked dates array
            const isNightBeforeInArray = blockedDateStrings.includes(nightBeforeStr);
            log(` - Night before (${nightBeforeStr}) is in blockedDateStrings array? ${isNightBeforeInArray}`);

            // Enhanced check: Verify night before with both methods to ensure consistency
            if (isNightBeforeBlocked !== isNightBeforeInArray) {
              log(` - ⚠️ WARNING: Inconsistency detected between isDateBlocked() and blockedDateStrings.includes()!`);
            }

            // Check if this date is part of a consecutive block of unavailable dates
            const isPartOfConsecutiveBlock = datesInConsecutiveBlocks.has(blockedDateStr);
            log(` - Is part of consecutive block? ${isPartOfConsecutiveBlock}`);

            // Critical: NEVER create checkout tests for dates that are part of consecutive blocked days
            if (isPartOfConsecutiveBlock) {
              log(`⚠️ Not creating checkout test for ${utils.formatDate(blockedDate)} because it's part of a consecutive block of unavailable dates`);
            }
            // Only create checkout test if ALL the following conditions are met:
            // 1. The night before checkout is available
            // 2. Two nights before checkout are available
            // 3. The checkout date is NOT part of a consecutive block
            else if (!isNightBeforeBlocked && !isTwoDaysBeforeBlocked && !isNightBeforeInArray) {
              log(`✅ Creating "Blocked Checkout" test for ${utils.formatDate(blockedDate)}`);

              scenarios.blockedDates.push({
                name: `Blocked Checkout: ${utils.formatDate(blockedDate)}`,
                description: `Tests booking with checkout on unavailable date (should be allowed)`,
                checkIn: twoDaysBefore,
                checkOut: blockedDate,
                guests: 2,
                expectedOutcome: 'allowed'
              });
            } else {
              log(`⛔ Not creating "Blocked Checkout" test for ${utils.formatDate(blockedDate)} because preceding night (${isNightBeforeBlocked ? 'blocked' : 'not blocked'}) or two nights before (${isTwoDaysBeforeBlocked ? 'blocked' : 'not blocked'}) is unavailable`);
            }
          } else {
            log(`Skipping tests for ${utils.formatDate(blockedDate)} as adjacent days are also blocked`);
          }
        }

        // Add debugging message if we couldn't create any tests
        if (scenarios.blockedDates.length === 0) {
          log(`Found blocked dates but couldn't create valid test scenarios (dates might be in consecutive blocks)`);
        }
      } else {
        // Don't create fake tests - leave the array empty
        log('No blocked dates found for this property in the next 3 months');
      }

      // Find minimum stay requirements by testing various stay lengths and dates
      async function findMinStayThresholds() {
        // Test different lengths
        const testLengths = [1, 2, 3, 4, 7];

        // Test multiple dates to find varied minimum stay requirements
        // Try dates 14, 30, 60, and 90 days in the future, plus a weekend date
        const testStartDates = [];

        // Add regular future dates
        const futureOffsets = [14, 30, 60, 90];
        for (const daysAhead of futureOffsets) {
          const futureDate = new Date(today);
          futureDate.setDate(today.getDate() + daysAhead);
          testStartDates.push(futureDate);
        }

        // Add next weekend start date (Friday)
        const nextFriday = utils.getNextFriday(today);
        testStartDates.push(nextFriday);

        log(`Testing minimum stay requirements on ${testStartDates.length} different start dates`);

        // Track all minimum stay requirements we find
        const minStayRequirements = [];

        // Check each start date
        for (const startDate of testStartDates) {
          log(`Checking minimum stay requirements for check-in on ${utils.formatDate(startDate)}`);

          // Try each length for this start date
          for (const length of testLengths) {
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + length);

            // Check if this booking length is allowed
            try {
              const response = await fetch('/api/check-pricing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  propertyId: propertySlug,
                  checkIn: utils.formatDateISO(startDate),
                  checkOut: utils.formatDateISO(endDate),
                  guests: 2
                })
              });

              const data = await response.json();

              if (!data.available && data.reason === 'minimum_stay') {
                // We found a minimum stay requirement
                log(`Found minimum stay requirement of ${data.minimumStay} nights for check-in on ${utils.formatDate(startDate)}`);

                // Check if we already have this requirement
                const alreadyFound = minStayRequirements.some(req =>
                  req.minStay === data.minimumStay &&
                  utils.formatDate(req.date) === utils.formatDate(startDate)
                );

                if (!alreadyFound) {
                  minStayRequirements.push({
                    minStay: data.minimumStay,
                    date: startDate
                  });
                }

                // No need to check other lengths for this date once we find a requirement
                break;
              }
            } catch (error) {
              log(`Error checking minimum stay for ${length} nights from ${utils.formatDate(startDate)}`, true);
              console.error(error);
            }
          }
        }

        // If we found requirements, return the most interesting one
        // Preference: higher min stay value, then earlier date
        if (minStayRequirements.length > 0) {
          // Sort by min stay (descending) then by date (ascending)
          minStayRequirements.sort((a, b) => {
            if (a.minStay !== b.minStay) {
              return b.minStay - a.minStay; // Higher min stay first
            }
            return a.date.getTime() - b.date.getTime(); // Earlier date first
          });

          log(`Found ${minStayRequirements.length} different minimum stay requirements`);
          for (const req of minStayRequirements) {
            log(`- ${req.minStay} nights for check-in on ${utils.formatDate(req.date)}`);
          }

          // Return the most interesting one
          return minStayRequirements[0];
        }

        log(`No minimum stay requirements found after checking ${testStartDates.length} different start dates`);
        return null;
      }

      // Try to find minimum stay requirements
      const minStayInfo = await findMinStayThresholds();

      if (minStayInfo) {
        log(`Using minimum stay requirement: ${minStayInfo.minStay} nights for check-in on ${utils.formatDate(minStayInfo.date)}`);

        // Create test for exactly meeting minimum stay
        const minStayEndDate = new Date(minStayInfo.date);
        minStayEndDate.setDate(minStayInfo.date.getDate() + minStayInfo.minStay);

        scenarios.minStay.push({
          name: `Exact Min Stay: ${minStayInfo.minStay} nights`,
          description: `Tests booking exactly ${minStayInfo.minStay} nights (minimum required)`,
          checkIn: new Date(minStayInfo.date),
          checkOut: minStayEndDate,
          guests: 2,
          expectedOutcome: 'allowed'
        });

        // Create test for one night below minimum stay (should be rejected)
        if (minStayInfo.minStay > 1) {
          const belowMinStayEndDate = new Date(minStayInfo.date);
          belowMinStayEndDate.setDate(minStayInfo.date.getDate() + minStayInfo.minStay - 1);

          scenarios.minStay.push({
            name: `Just Below Min Stay: ${minStayInfo.minStay - 1} nights`,
            description: `Tests booking ${minStayInfo.minStay - 1} nights when ${minStayInfo.minStay} is required`,
            checkIn: new Date(minStayInfo.date),
            checkOut: belowMinStayEndDate,
            guests: 2,
            expectedOutcome: 'rejected'
          });
        }

        // Create test for significantly below minimum stay
        if (minStayInfo.minStay > 2) {
          const farBelowMinStayEndDate = new Date(minStayInfo.date);
          // One night stay (always much shorter than the minimum)
          const farBelowNights = 1;
          farBelowMinStayEndDate.setDate(minStayInfo.date.getDate() + farBelowNights);

          scenarios.minStay.push({
            name: `Far Below Min Stay: ${farBelowNights} night(s)`,
            description: `Tests booking only ${farBelowNights} night(s) when ${minStayInfo.minStay} is required`,
            checkIn: new Date(minStayInfo.date),
            checkOut: farBelowMinStayEndDate,
            guests: 2,
            expectedOutcome: 'rejected'
          });
        }

        // Create test for above minimum stay (should be allowed)
        const aboveMinStayEndDate = new Date(minStayInfo.date);
        aboveMinStayEndDate.setDate(minStayInfo.date.getDate() + minStayInfo.minStay + 2);

        scenarios.minStay.push({
          name: `Above Min Stay: ${minStayInfo.minStay + 2} nights`,
          description: `Tests booking ${minStayInfo.minStay + 2} nights when ${minStayInfo.minStay} is required`,
          checkIn: new Date(minStayInfo.date),
          checkOut: aboveMinStayEndDate,
          guests: 2,
          expectedOutcome: 'allowed'
        });

        // If the minimum stay is high (4+), also test a long stay
        if (minStayInfo.minStay >= 4) {
          const longStayEndDate = new Date(minStayInfo.date);
          const longStayLength = minStayInfo.minStay * 2;
          longStayEndDate.setDate(minStayInfo.date.getDate() + longStayLength);

          scenarios.minStay.push({
            name: `Long Stay: ${longStayLength} nights`,
            description: `Tests a longer booking (${longStayLength} nights) when minimum is ${minStayInfo.minStay}`,
            checkIn: new Date(minStayInfo.date),
            checkOut: longStayEndDate,
            guests: 2,
            expectedOutcome: 'allowed'
          });
        }
      } else {
        // Don't create fake tests - leave the array empty
        log('No minimum stay requirements found for this property');
      }

      // Guest count tests - try different occupancy levels
      const guestStartDate = new Date(today);
      guestStartDate.setDate(today.getDate() + 14);
      const guestEndDate = new Date(guestStartDate);
      guestEndDate.setDate(guestStartDate.getDate() + 3);

      // Test if prices differ for different guest counts
      async function detectGuestPricing() {
        const guestCounts = [1, 2, 4, 6, 8];
        const results = [];

        for (const guests of guestCounts) {
          try {
            const response = await fetch('/api/check-pricing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                propertyId: propertySlug,
                checkIn: utils.formatDateISO(guestStartDate),
                checkOut: utils.formatDateISO(guestEndDate),
                guests: guests
              })
            });

            const data = await response.json();

            if (data.available && data.pricing) {
              results.push({
                guests,
                price: data.pricing.total
              });
            }
          } catch (error) {
            console.error(`Error checking price for ${guests} guests:`, error);
          }
        }

        return results;
      }

      const guestPricing = await detectGuestPricing();

      if (guestPricing.length > 1) {
        log(`Found pricing data for ${guestPricing.length} different guest counts`);

        // Check if prices vary by guest count
        const basePricing = guestPricing[0];
        const pricingByGuests = {};
        let hasDifference = false;

        for (let i = 1; i < guestPricing.length; i++) {
          const current = guestPricing[i];
          if (current.price !== basePricing.price) {
            hasDifference = true;
            pricingByGuests[current.guests] = {
              price: current.price,
              difference: current.price - basePricing.price,
              percentage: Math.round((current.price / basePricing.price - 1) * 100)
            };
          }
        }

        if (hasDifference) {
          log('Found occupancy-based pricing: prices vary by guest count');

          // Create test scenarios for each interesting guest count
          scenarios.guestCount.push({
            name: `Base Guests: ${basePricing.guests}`,
            description: `Tests pricing with ${basePricing.guests} guests (base pricing)`,
            checkIn: new Date(guestStartDate),
            checkOut: new Date(guestEndDate),
            guests: basePricing.guests,
            expectedOutcome: 'allowed'
          });

          // Add tests for differential pricing
          for (const guestCount in pricingByGuests) {
            const info = pricingByGuests[guestCount];
            scenarios.guestCount.push({
              name: `${guestCount} Guests (${info.percentage > 0 ? '+' : ''}${info.percentage}%)`,
              description: `Tests pricing with ${guestCount} guests (${info.percentage > 0 ? 'higher' : 'lower'} pricing)`,
              checkIn: new Date(guestStartDate),
              checkOut: new Date(guestEndDate),
              guests: parseInt(guestCount, 10),
              expectedOutcome: 'allowed',
              expectedPriceDifference: `${info.percentage > 0 ? '+' : ''}${info.percentage}%`
            });
          }
        } else {
          // No price difference by guest count
          log('No occupancy-based pricing detected: prices do not vary by guest count');

          // Create standard tests
          scenarios.guestCount.push({
            name: 'Small Group: 2 Guests',
            description: 'Tests booking with a small number of guests',
            checkIn: new Date(guestStartDate),
            checkOut: new Date(guestEndDate),
            guests: 2,
            expectedOutcome: 'allowed'
          });

          scenarios.guestCount.push({
            name: 'Large Group: 8 Guests',
            description: 'Tests booking with a large number of guests',
            checkIn: new Date(guestStartDate),
            checkOut: new Date(guestEndDate),
            guests: 8,
            expectedOutcome: 'allowed'
          });
        }
      } else {
        // Don't create fake tests - leave the array empty
        log('No occupancy-based pricing detected: prices do not vary by guest count');
      }

      // Date range tests - check for weekend pricing and length of stay

      // Weekend stay
      const nextFriday = utils.getNextFriday();
      const nextSunday = utils.getNextSunday();

      scenarios.dateRanges.push({
        name: 'Weekend Stay',
        description: 'Tests Friday to Sunday (weekend pricing)',
        checkIn: nextFriday,
        checkOut: nextSunday,
        guests: 2,
        expectedOutcome: 'allowed'
      });

      // Test for length-of-stay discounts
      const stayLengths = [3, 7, 14, 30];

      // Test a short stay and several longer stays to detect discounts
      async function detectStayDiscounts() {
        const results = [];
        const baseDate = new Date(today);
        baseDate.setDate(today.getDate() + 30);

        for (const nights of stayLengths) {
          const checkIn = new Date(baseDate);
          const checkOut = new Date(baseDate);
          checkOut.setDate(baseDate.getDate() + nights);

          try {
            const response = await fetch('/api/check-pricing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                propertyId: propertySlug,
                checkIn: utils.formatDateISO(checkIn),
                checkOut: utils.formatDateISO(checkOut),
                guests: 2
              })
            });

            const data = await response.json();

            if (data.available && data.pricing) {
              results.push({
                nights,
                totalPrice: data.pricing.total,
                pricePerNight: data.pricing.total / nights,
                hasDiscount: !!(data.pricing.lengthOfStayDiscount && data.pricing.lengthOfStayDiscount.discountAmount > 0),
                discountPercentage: data.pricing.lengthOfStayDiscount?.discountPercentage || 0,
                discountAmount: data.pricing.lengthOfStayDiscount?.discountAmount || 0
              });
            }
          } catch (error) {
            console.error(`Error checking pricing for ${nights} nights:`, error);
          }
        }

        return results;
      }

      const stayDiscounts = await detectStayDiscounts();

      if (stayDiscounts.length > 1) {
        log(`Found pricing data for ${stayDiscounts.length} different stay lengths`);

        // Check if any stays have explicit discounts
        const discountedStays = stayDiscounts.filter(stay => stay.hasDiscount);

        if (discountedStays.length > 0) {
          log('Found length-of-stay discounts in pricing data');

          // Create test scenarios for discounted stays
          for (const stay of discountedStays) {
            const baseDate = new Date(today);
            baseDate.setDate(today.getDate() + 30);

            scenarios.dateRanges.push({
              name: `${stay.nights}-Night Discount (${stay.discountPercentage}%)`,
              description: `Tests ${stay.nights}-night stay with ${stay.discountPercentage}% discount`,
              checkIn: new Date(baseDate),
              checkOut: new Date(new Date(baseDate).setDate(baseDate.getDate() + stay.nights)),
              guests: 2,
              expectedOutcome: 'allowed',
              expectedDiscount: `${stay.discountPercentage}%`
            });
          }

          // Find first threshold and create a test just below it
          const lowestDiscountStay = discountedStays.reduce((lowest, stay) =>
            stay.nights < lowest.nights ? stay : lowest, discountedStays[0]);

          if (lowestDiscountStay.nights > 1) {
            const baseDate = new Date(today);
            baseDate.setDate(today.getDate() + 30);

            scenarios.dateRanges.push({
              name: `Below Discount Threshold: ${lowestDiscountStay.nights - 1} nights`,
              description: `Tests ${lowestDiscountStay.nights - 1}-night stay (just below discount threshold)`,
              checkIn: new Date(baseDate),
              checkOut: new Date(new Date(baseDate).setDate(baseDate.getDate() + lowestDiscountStay.nights - 1)),
              guests: 2,
              expectedOutcome: 'allowed',
              expectedDiscount: null
            });
          }
        } else {
          // No explicit discounts, but check if price per night decreases with length
          const shortestStay = stayDiscounts[0];
          const longestStay = stayDiscounts[stayDiscounts.length - 1];

          if (longestStay.pricePerNight < shortestStay.pricePerNight) {
            const percentageDecrease = Math.round((1 - longestStay.pricePerNight / shortestStay.pricePerNight) * 100);
            log(`Found implicit pricing benefit: ${percentageDecrease}% lower per-night price for ${longestStay.nights}-night stay vs ${shortestStay.nights}-night stay`);

            scenarios.dateRanges.push({
              name: `Short Stay: ${shortestStay.nights} nights`,
              description: `Tests ${shortestStay.nights}-night stay (standard pricing)`,
              checkIn: new Date(new Date(today).setDate(today.getDate() + 30)),
              checkOut: new Date(new Date(today).setDate(today.getDate() + 30 + shortestStay.nights)),
              guests: 2,
              expectedOutcome: 'allowed'
            });

            scenarios.dateRanges.push({
              name: `Long Stay: ${longestStay.nights} nights (better rate)`,
              description: `Tests ${longestStay.nights}-night stay (${percentageDecrease}% lower per-night price)`,
              checkIn: new Date(new Date(today).setDate(today.getDate() + 30)),
              checkOut: new Date(new Date(today).setDate(today.getDate() + 30 + longestStay.nights)),
              guests: 2,
              expectedOutcome: 'allowed',
              expectedBenefit: `${percentageDecrease}% lower per-night`
            });
          } else {
            // No apparent stay-length benefits
            log('No length-of-stay discounts or benefits detected');

            // Add generic tests
            scenarios.dateRanges.push({
              name: 'Week-long Stay',
              description: 'Tests standard 7-night booking',
              checkIn: new Date(new Date(today).setDate(today.getDate() + 30)),
              checkOut: new Date(new Date(today).setDate(today.getDate() + 37)),
              guests: 2,
              expectedOutcome: 'allowed'
            });
          }
        }
      } else {
        // Keep only the weekend test in date ranges if we don't have clear discount data
        log('No length-of-stay discounts detected, testing only weekend pricing');
      }

      // Always keep the weekend test since we want to check weekend pricing
      if (scenarios.dateRanges.length === 0) {
        scenarios.dateRanges.push({
          name: 'Weekend Stay',
          description: 'Tests Friday to Sunday (weekend pricing)',
          checkIn: nextFriday,
          checkOut: nextSunday,
          guests: 2,
          expectedOutcome: 'allowed'
        });
      }

      return scenarios;
    } catch (error) {
      log(`Error discovering test scenarios: ${error.message}`, true);
      console.error('Error details:', error);

      // Return empty scenarios on error - don't use defaults
      return {
        blockedDates: [],
        minStay: [],
        guestCount: [],
        dateRanges: []
      };
    } finally {
      removeLoadingIndicator();
    }
  }

  // Main execution
  async function initialize() {
    log('Initializing API-based test panel...');

    // Discover test scenarios
    const testScenarios = await discoverTestScenarios();

    // Create the test panel with discovered scenarios
    createTestPanel(testScenarios);

    log(`Test panel ready with ${
      testScenarios.blockedDates.length +
      testScenarios.minStay.length +
      testScenarios.guestCount.length +
      testScenarios.dateRanges.length
    } test scenarios`);
  }

  // Start the initialization
  initialize();
})();
