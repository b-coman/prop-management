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
  
  if (!propertySlug) {
    console.error('This script must be run on a booking check page or property page');
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
      
      const response1 = await fetch('/api/check-pricing-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: propertySlug,
          checkIn: dayBeforeBlock.toISOString(),
          checkOut: dayAfterBlock.toISOString(),
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
      
      const response2 = await fetch('/api/check-pricing-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: propertySlug,
          checkIn: blockStart.toISOString(),
          checkOut: dayAfterBlock.toISOString(),
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
      
      const response3 = await fetch('/api/check-pricing-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: propertySlug,
          checkIn: dayBeforeBlock.toISOString(),
          checkOut: blockEnd.toISOString(),
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
      const response = await fetch('/api/check-pricing-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId: propertySlug,
          checkIn: test.checkIn.toISOString(),
          checkOut: test.checkOut.toISOString(),
          guests: test.guests
        }),
      });
      
      const data = await response.json();
      
      if (data.available) {
        log(`✅ API correctly allows checkout on blocked date ${utils.formatDate(test.checkOut)}`);
        log(`Total price: ${data.pricing.totalPrice} ${data.pricing.currency}`);
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
  
  // Find blocked dates and analyze consecutive patterns
  async function analyzeBlockedDates() {
    try {
      const today = new Date();
      
      log(`Checking availability to find blocked dates...`);
      
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
        
        log(`Found ${unavailableDates.length} unavailable dates in the future`);
        
        if (unavailableDates.length === 0) {
          return { 
            allBlockedDates: [], 
            consecutiveBlocks: [], 
            checkoutTests: [] 
          };
        }
        
        // Convert to ISO strings for easier comparison
        const blockedDateStrings = unavailableDates.map(date => utils.formatDateISO(date));
        
        // Identify consecutive blocks
        let consecutiveBlocks = [];
        let currentBlock = [];
        
        // First, ensure the dates are sorted chronologically
        const sortedDates = [...unavailableDates].sort((a, b) => a.getTime() - b.getTime());
        
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
        
        log(`Identified ${consecutiveBlocks.length} blocks of consecutive unavailable dates`);
        
        // Function to check if a date is in any consecutive block
        // Create a set of ISO date strings that are part of consecutive blocks
        const datesInConsecutiveBlocks = new Set();
        for (const block of consecutiveBlocks) {
          for (const date of block) {
            datesInConsecutiveBlocks.add(utils.formatDateISO(date));
          }
        }
        
        // Create function to check if a date is blocked
        const isDateBlocked = (date) => {
          return blockedDateStrings.includes(utils.formatDateISO(date));
        };
        
        // Generate checkout tests for isolated blocked dates
        const checkoutTests = [];
        
        for (const blockedDate of unavailableDates) {
          const blockedDateStr = utils.formatDateISO(blockedDate);
          
          // Skip dates that are part of consecutive blocks
          if (datesInConsecutiveBlocks.has(blockedDateStr)) {
            continue;
          }
          
          // For checkout tests, we need day before to be available
          const dayBefore = new Date(blockedDate);
          dayBefore.setDate(blockedDate.getDate() - 1);
          
          const twoDaysBefore = new Date(blockedDate);
          twoDaysBefore.setDate(blockedDate.getDate() - 2);
          
          if (!isDateBlocked(dayBefore) && !isDateBlocked(twoDaysBefore)) {
            log(`Found suitable isolated blocked date for checkout test: ${utils.formatDate(blockedDate)}`);
            
            checkoutTests.push({
              name: `Checkout on Blocked Date: ${utils.formatDate(blockedDate)}`,
              description: `Tests checkout on unavailable date - should be allowed because the night before is available`,
              checkIn: twoDaysBefore,
              checkOut: blockedDate,
              guests: 2
            });
          }
        }
        
        log(`Created ${checkoutTests.length} checkout tests for isolated blocked dates`);
        
        // Return all the analysis results
        return {
          allBlockedDates: unavailableDates,
          consecutiveBlocks: consecutiveBlocks,
          checkoutTests: checkoutTests
        };
      }
      
      log('No unavailable dates found through the API');
      return { 
        allBlockedDates: [], 
        consecutiveBlocks: [], 
        checkoutTests: [] 
      };
    } catch (error) {
      log(`Error analyzing blocked dates: ${error.message}`, true);
      return { 
        allBlockedDates: [], 
        consecutiveBlocks: [], 
        checkoutTests: [] 
      };
    }
  }
  
  // Main execution
  async function initialize() {
    const loadingIndicator = showLoadingIndicator();
    
    try {
      log('Initializing consecutive blocked dates test panel...');
      
      // Analyze blocked dates
      const analysis = await analyzeBlockedDates();
      
      // Create the test panel
      createTestPanel(analysis);
      
      log(`Test panel ready with ${analysis.consecutiveBlocks.length} consecutive blocks and ${analysis.checkoutTests.length} checkout tests`);
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