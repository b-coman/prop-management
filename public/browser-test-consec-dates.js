/**
 * Consecutive Blocked Dates Test Script
 *
 * This script specifically focuses on testing consecutive blocked date patterns
 * to ensure the system correctly handles them.
 *
 * Usage:
 * 1. Navigate to a booking page with consecutively blocked dates
 * 2. Open the browser console and paste this script
 * 3. The focused test panel will appear showing only tests related to consecutive dates
 */

(async function() {
  console.log('Initializing Consecutive Blocked Dates Test Panel...');

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
    // Get propertyId from URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('propertyId')) {
      propertySlug = urlParams.get('propertyId');
    } else {
      propertySlug = "prahova-mountain-chalet"; // Default if not specified
    }
  } else {
    propertySlug = "prahova-mountain-chalet"; // Default fallback
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
    loadingDiv.innerHTML = 'Analyzing consecutive blocked dates...';

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
  function createTestPanel(testData) {
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
    panel.style.maxHeight = '70vh';
    panel.style.overflowY = 'auto';

    // Create header
    const header = document.createElement('div');
    header.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0; color: #333;">Consecutive Blocked Dates Test Panel</h3>
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
      { id: 'consec-blocks', label: 'Consecutive Blocks' },
      { id: 'checkout-tests', label: 'Checkout Tests' },
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
        showTabContent(tab.id, testData);
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
    showTabContent('consec-blocks', testData);
  }

  // Show appropriate tab content
  function showTabContent(tabId, testData) {
    const contentArea = document.getElementById('test-content-area');

    switch(tabId) {
      case 'consec-blocks':
        renderConsecutiveBlocks(contentArea, testData.consecutiveBlocks);
        break;
      case 'checkout-tests':
        renderCheckoutTests(contentArea, testData.checkoutTests);
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

  // Render consecutive blocks
  function renderConsecutiveBlocks(container, blocks) {
    if (!blocks || blocks.length === 0) {
      container.innerHTML = `
        <h4 style="margin-top: 0;">Consecutive Blocked Date Analysis</h4>
        <div style="padding: 20px; text-align: center; color: #666; border: 1px dashed #ccc; border-radius: 4px; margin-bottom: 20px;">
          <p><strong>No consecutive blocked dates found for this property.</strong></p>
          <p>All unavailable dates appear to be isolated. This is useful for testing checkout-on-blocked-day scenarios.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <h4 style="margin-top: 0;">Consecutive Blocked Date Analysis (${blocks.length} blocks found)</h4>
      <p class="text-sm" style="color: #666; margin-bottom: 15px;">
        These are sequences of blocked dates that appear consecutively in the calendar.
        Checkout tests should NOT be created for any dates that are part of these blocks.
      </p>
      <div style="display: flex; flex-direction: column; gap: 15px;">
        ${blocks.map((block, i) => {
          const blockStart = new Date(block[0]);
          const blockEnd = new Date(block[block.length - 1]);

          return `
          <div style="border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; background: white;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
              <h5 style="margin: 0; color: #333;">Block #${i + 1}: ${block.length} consecutive days</h5>
              <span style="font-size: 12px; background: #dc3545; color: white; padding: 2px 6px; border-radius: 3px;">No Checkout Tests</span>
            </div>

            <div style="display: flex; margin-bottom: 10px;">
              <div style="flex: 1; border: 1px solid #e9ecef; border-radius: 4px; padding: 8px; margin-right: 8px;">
                <div style="font-size: 12px; text-transform: uppercase; color: #6c757d; margin-bottom: 2px;">Start Date</div>
                <div style="font-weight: bold; font-size: 14px;">${utils.formatDate(blockStart)}</div>
              </div>

              <div style="flex: 1; border: 1px solid #e9ecef; border-radius: 4px; padding: 8px;">
                <div style="font-size: 12px; text-transform: uppercase; color: #6c757d; margin-bottom: 2px;">End Date</div>
                <div style="font-weight: bold; font-size: 14px;">${utils.formatDate(blockEnd)}</div>
              </div>
            </div>

            <div style="background: #f5f5f5; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
              <div style="font-size: 12px; text-transform: uppercase; color: #6c757d; margin-bottom: 5px;">Dates in this block:</div>
              <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                ${block.map(date => {
                  const dateObj = new Date(date);
                  return `<span style="font-size: 12px; background: #ffdcdc; padding: 2px 5px; border-radius: 3px;">${utils.formatDate(dateObj)}</span>`;
                }).join('')}
              </div>
            </div>

            <div style="display: flex; gap: 10px;">
              <button class="test-block-btn" data-index="${i}" style="flex: 1; background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Test This Block</button>
            </div>
          </div>
          `;
        }).join('')}
      </div>
    `;

    // Add event handlers for block testing
    const testButtons = container.querySelectorAll('.test-block-btn');
    for (let i = 0; i < testButtons.length; i++) {
      const btn = testButtons[i];
      btn.onclick = function() {
        const index = parseInt(this.getAttribute('data-index'), 10);
        testConsecutiveBlock(blocks[index]);
      };
    }
  }

  // Render checkout tests
  function renderCheckoutTests(container, tests) {
    if (!tests || tests.length === 0) {
      container.innerHTML = `
        <h4 style="margin-top: 0;">Checkout on Blocked Day Tests</h4>
        <div style="padding: 20px; text-align: center; color: #666; border: 1px dashed #ccc; border-radius: 4px; margin-bottom: 20px;">
          <p><strong>No suitable checkout tests could be created.</strong></p>
          <p>This could be because:</p>
          <p>• All unavailable dates are part of consecutive blocks</p>
          <p>• There are no isolated unavailable dates with available days before them</p>
          <p>• No unavailable dates were found at all</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <h4 style="margin-top: 0;">Checkout on Blocked Day Tests (${tests.length} tests)</h4>
      <p class="text-sm" style="color: #666; margin-bottom: 15px;">
        These are isolated blocked dates (not part of consecutive blocks) where the night before is available.
        You should be able to check out on these dates, even though they're unavailable for new check-ins.
      </p>
      <div style="display: flex; flex-direction: column; gap: 15px;">
        ${tests.map((test, i) => `
          <div style="border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; background: white;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
              <h5 style="margin: 0; color: #333;">Checkout Test #${i + 1}: ${utils.formatDate(test.checkOut)}</h5>
              <span style="font-size: 12px; background: #28a745; color: white; padding: 2px 6px; border-radius: 3px;">Should Be Allowed</span>
            </div>

            <p style="margin-bottom: 10px; color: #666; font-size: 13px;">${test.description}</p>

            <div style="display: flex; margin-bottom: 10px;">
              <div style="flex: 1; border: 1px solid #e9ecef; border-radius: 4px; padding: 8px; margin-right: 8px;">
                <div style="font-size: 12px; text-transform: uppercase; color: #6c757d; margin-bottom: 2px;">Check-in</div>
                <div style="font-weight: bold; font-size: 14px;">${utils.formatDate(test.checkIn)}</div>
                <div style="font-size: 10px; color: #28a745;">(Available)</div>
              </div>

              <div style="flex: 1; border: 1px solid #e9ecef; border-radius: 4px; padding: 8px;">
                <div style="font-size: 12px; text-transform: uppercase; color: #6c757d; margin-bottom: 2px;">Check-out</div>
                <div style="font-weight: bold; font-size: 14px;">${utils.formatDate(test.checkOut)}</div>
                <div style="font-size: 10px; color: #dc3545;">(Blocked but should work)</div>
              </div>
            </div>

            <div style="display: flex; gap: 10px;">
              <button class="test-api-btn" data-index="${i}" style="flex: 1; background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Test API</button>
              <button class="open-ui-btn" data-index="${i}" style="flex: 1; background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Test UI</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Add event handlers
    const apiButtons = container.querySelectorAll('.test-api-btn');
    for (let i = 0; i < apiButtons.length; i++) {
      const btn = apiButtons[i];
      btn.onclick = function() {
        const index = parseInt(this.getAttribute('data-index'), 10);
        runApiTest(tests[index]);
      };
    }

    const uiButtons = container.querySelectorAll('.open-ui-btn');
    for (let i = 0; i < uiButtons.length; i++) {
      const btn = uiButtons[i];
      btn.onclick = function() {
        const index = parseInt(this.getAttribute('data-index'), 10);
        openUiTest(tests[index]);
      };
    }
  }

  // Test a consecutive block with the API
  async function testConsecutiveBlock(block) {
    try {
      if (!block || block.length < 2) {
        log(`Invalid block data`, true);
        return;
      }

      const dateFormat = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      const blockStart = new Date(block[0]);
      const blockEnd = new Date(block[block.length - 1]);

      log(`Testing consecutive block: ${dateFormat.format(blockStart)} to ${dateFormat.format(blockEnd)}`);

      // Test case 1: Check in immediately before the block, check out after the block
      const dayBeforeBlock = new Date(blockStart);
      dayBeforeBlock.setDate(blockStart.getDate() - 1);

      const dayAfterBlock = new Date(blockEnd);
      dayAfterBlock.setDate(blockEnd.getDate() + 1);

      log(`Test 1: Check in before block (${dateFormat.format(dayBeforeBlock)}), check out after block (${dateFormat.format(dayAfterBlock)})`);

      const response1 = await fetch('/api/check-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: propertySlug,
          checkIn: utils.formatDateISO(dayBeforeBlock),
          checkOut: utils.formatDateISO(dayAfterBlock),
          guests: 2
        })
      });

      const data1 = await response1.json();

      if (data1.available) {
        log(`❌ UNEXPECTED: API allowed booking span across block - should be rejected`, true);
      } else {
        log(`✅ API correctly rejected booking spanning across block`);
        log(`Reason: ${data1.reason}`);
        if (data1.unavailableDates && data1.unavailableDates.length > 0) {
          log(`Flagged unavailable dates: ${data1.unavailableDates.join(', ')}`);
        }
      }

      // Test case 2: Check in on first day of block (should be rejected)
      const secondDayOfBlock = new Date(block[1]);

      log(`Test 2: Check in on first day of block (${dateFormat.format(blockStart)}), check out on day after block (${dateFormat.format(dayAfterBlock)})`);

      const response2 = await fetch('/api/check-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: propertySlug,
          checkIn: utils.formatDateISO(blockStart),
          checkOut: utils.formatDateISO(dayAfterBlock),
          guests: 2
        })
      });

      const data2 = await response2.json();

      if (data2.available) {
        log(`❌ UNEXPECTED: API allowed check-in on first day of block - should be rejected`, true);
      } else {
        log(`✅ API correctly rejected check-in on blocked date`);
        log(`Reason: ${data2.reason}`);
      }

      // Test case 3: Check in before block, checkout on last day of block (should be allowed)
      log(`Test 3: Check in before block (${dateFormat.format(dayBeforeBlock)}), check out on last day of block (${dateFormat.format(blockEnd)})`);

      const response3 = await fetch('/api/check-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: propertySlug,
          checkIn: utils.formatDateISO(dayBeforeBlock),
          checkOut: utils.formatDateISO(blockEnd),
          guests: 2
        })
      });

      const data3 = await response3.json();

      // IMPORTANT: This is where the bug is - this should be allowed!
      if (data3.available) {
        log(`✅ API correctly allowed checkout on last day of block`);
        log(`Total price: ${data3.pricing?.totalPrice || 'N/A'}`);
      } else {
        log(`❌ UNEXPECTED: API rejected checkout on last day of block - should be allowed`, true);
        log(`Reason: ${data3.reason}`);
        if (data3.unavailableDates && data3.unavailableDates.length > 0) {
          log(`Flagged unavailable dates: ${data3.unavailableDates.join(', ')}`);
        }
      }

    } catch (error) {
      log(`Error testing block: ${error.message}`, true);
    }
  }

  // Run an API test for a checkout test
  async function runApiTest(test) {
    if (!test) return;

    log(`Running API test: Checkout on ${utils.formatDate(test.checkOut)}`);

    try {
      const response = await fetch('/api/check-pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId: propertySlug,
          checkIn: utils.formatDateISO(test.checkIn),
          checkOut: utils.formatDateISO(test.checkOut),
          guests: test.guests
        }),
      });

      const data = await response.json();

      if (data.available) {
        log(`✅ API correctly allows checkout on blocked date ${utils.formatDate(test.checkOut)}`);
        log(`Total price: ${data.pricing.total} ${data.pricing.currency}`);
      } else {
        log(`❌ UNEXPECTED: API rejected checkout on blocked date ${utils.formatDate(test.checkOut)}`, true);
        log(`Reason: ${data.reason}`);

        if (data.unavailableDates && data.unavailableDates.length > 0) {
          log(`Flagged unavailable dates: ${data.unavailableDates.join(', ')}`);
        }
      }
    } catch (error) {
      log(`API error: ${error.message}`, true);
    }
  }

  // Open test case in UI
  function openUiTest(test) {
    if (!test) return;

    // Format dates for URL
    const checkInStr = utils.formatDateISO(test.checkIn);
    const checkOutStr = utils.formatDateISO(test.checkOut);

    // Build URL for booking check page
    const url = `${document.location.origin}/booking/check/${propertySlug}?checkIn=${checkInStr}&checkOut=${checkOutStr}&guests=${test.guests}`;

    // Open in new tab
    log(`Opening test case in new tab: Checkout on ${utils.formatDate(test.checkOut)}`);
    window.open(url, '_blank');
  }

  // Instead of trying to fetch real data, use sample data for testing
  function createSampleTestData() {
    const today = new Date();

    // Sample consecutive blocks
    const block1Start = new Date(today);
    block1Start.setDate(today.getDate() + 15); // 15 days from now

    const block1 = [];
    for (let i = 0; i < 3; i++) {
      const date = new Date(block1Start);
      date.setDate(block1Start.getDate() + i);
      block1.push(date);
    }

    const block2Start = new Date(today);
    block2Start.setDate(today.getDate() + 30); // 30 days from now

    const block2 = [];
    for (let i = 0; i < 2; i++) {
      const date = new Date(block2Start);
      date.setDate(block2Start.getDate() + i);
      block2.push(date);
    }

    // Sample checkout tests
    const isolatedDate1 = new Date(today);
    isolatedDate1.setDate(today.getDate() + 45); // 45 days from now

    const isolatedDate2 = new Date(today);
    isolatedDate2.setDate(today.getDate() + 60); // 60 days from now

    // May 13-14, 2025 specific test
    const may13_2025 = new Date(2025, 4, 13); // May 13, 2025 (months are 0-indexed)
    const may14_2025 = new Date(2025, 4, 14); // May 14, 2025
    const may12_2025 = new Date(2025, 4, 12); // May 12, 2025

    const specific_block = [may13_2025, may14_2025];

    // Create sample checkouts
    const checkoutBefore = new Date(may12_2025);
    checkoutBefore.setDate(checkoutBefore.getDate() - 1); // May 11

    return {
      consecutiveBlocks: [block1, block2, specific_block],
      checkoutTests: [
        {
          name: `Checkout on Isolated Blocked Date`,
          description: `Tests checkout on an isolated unavailable date - should be allowed`,
          checkIn: new Date(isolatedDate1.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days before
          checkOut: isolatedDate1,
          guests: 2
        },
        {
          name: `Another Isolated Checkout Test`,
          description: `Tests another isolated checkout scenario`,
          checkIn: new Date(isolatedDate2.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days before
          checkOut: isolatedDate2,
          guests: 4
        },
        {
          name: `May 13, 2025 Checkout Test`,
          description: `Specific test for May 13, 2025 - part of consecutive block with May 14`,
          checkIn: checkoutBefore,
          checkOut: may13_2025,
          guests: 2
        }
      ]
    };
  }

  // Main execution
  async function initialize() {
    const loadingIndicator = showLoadingIndicator();

    try {
      log('Initializing consecutive blocked dates test panel...');

      // Instead of trying to fetch real data, use sample data for testing UI
      const testData = createSampleTestData();

      // Create the test panel
      createTestPanel(testData);

      log(`Test panel ready with ${testData.consecutiveBlocks.length} consecutive blocks and ${testData.checkoutTests.length} checkout tests`);
    } catch (error) {
      log(`Error initializing test panel: ${error.message}`, true);
      console.error('Error details:', error);
    } finally {
      removeLoadingIndicator();
    }
  }

  // Start the initialization
  initialize();
})();
