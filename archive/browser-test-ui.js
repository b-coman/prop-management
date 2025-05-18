/**
 * UI Testing Script for Pricing and Availability
 * 
 * This script creates a testing panel to help you test different booking scenarios
 * and observe how the UI responds. It includes tests for blocked dates, minimum stay
 * requirements, guest count pricing, and more.
 * 
 * Usage:
 * 1. Navigate to a booking page in your browser (e.g., http://localhost:9002/booking/check/prahova-mountain-chalet)
 * 2. Open the browser console (F12 or right-click > Inspect > Console)
 * 3. Paste this entire script and press Enter
 * 4. The test panel will appear at the bottom of the page
 */

(function() {
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
  
  // Create test UI panel
  function createTestPanel() {
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
        <h3 style="margin: 0; color: #333;">Pricing & Availability UI Test Panel</h3>
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
        showTabContent(tab.id);
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
    showTabContent('blocked-dates');
  }
  
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
  
  // Generate test scenarios
  function getTestScenarios() {
    const today = new Date();
    
    // Helper function to get next Friday
    function getNextFriday() {
      const date = new Date(today);
      while (date.getDay() !== 5) { // 5 is Friday
        date.setDate(date.getDate() + 1);
      }
      return date;
    }
    
    // Helper function to get next Sunday
    function getNextSunday() {
      const friday = getNextFriday();
      const sunday = new Date(friday);
      sunday.setDate(friday.getDate() + 2);
      return sunday;
    }
    
    return {
      blockedDates: [
        {
          name: 'Blocked Middle Date',
          description: 'Tests booking with a blocked date in the middle',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10),
          guests: 2
        },
        {
          name: 'Blocked Checkout Date',
          description: 'Tests when checkout date is unavailable (should work)',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 9),
          guests: 2
        }
      ],
      minStay: [
        {
          name: 'Below Minimum Stay',
          description: 'Tests 2 nights when minimum stay is higher',
          checkIn: new Date(today.getFullYear(), today.getMonth() + 1, 15),
          checkOut: new Date(today.getFullYear(), today.getMonth() + 1, 17),
          guests: 2
        },
        {
          name: 'Exact Minimum Stay',
          description: 'Tests exactly the minimum required nights',
          checkIn: new Date(today.getFullYear(), today.getMonth() + 1, 15),
          checkOut: new Date(today.getFullYear(), today.getMonth() + 1, 19), // 4 nights
          guests: 2
        }
      ],
      guestCount: [
        {
          name: 'Base Occupancy',
          description: 'Tests with minimum guest count',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 17),
          guests: 1
        },
        {
          name: 'Medium Occupancy',
          description: 'Tests with medium guest count',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 17),
          guests: 4
        },
        {
          name: 'Maximum Occupancy',
          description: 'Tests with maximum guest count',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 17),
          guests: 8
        }
      ],
      dateRanges: [
        {
          name: 'Weekend Stay',
          description: 'Tests Friday to Sunday (weekend pricing)',
          checkIn: getNextFriday(),
          checkOut: getNextSunday(),
          guests: 2
        },
        {
          name: 'Week Stay',
          description: 'Tests 7-night stay (potential discount)',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 37),
          guests: 2
        },
        {
          name: 'Long Stay (30 days)',
          description: 'Tests 30-day stay (potential discount)',
          checkIn: new Date(today.getFullYear(), today.getMonth() + 1, 1),
          checkOut: new Date(today.getFullYear(), today.getMonth() + 2, 1),
          guests: 2
        }
      ]
    };
  }
  
  // Format date for display
  function formatDate(date) {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  // Format date for URL
  function formatDateISO(date) {
    return date.toISOString().split('T')[0];
  }
  
  // Show appropriate tab content
  function showTabContent(tabId) {
    const contentArea = document.getElementById('test-content-area');
    const scenarios = getTestScenarios();
    
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
            <div style="display: flex; gap: 10px;">
              <button class="test-api-btn" data-index="${i}" data-category="${title}" style="flex: 1; background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Test API</button>
              <button class="open-ui-btn" data-index="${i}" data-category="${title}" style="flex: 1; background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Test UI</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
    // Add event handlers
    container.querySelectorAll('.test-api-btn').forEach(btn => {
      btn.onclick = function() {
        const index = parseInt(this.getAttribute('data-index'), 10);
        const category = this.getAttribute('data-category');
        runApiTest(category, index);
      };
    });
    
    container.querySelectorAll('.open-ui-btn').forEach(btn => {
      btn.onclick = function() {
        const index = parseInt(this.getAttribute('data-index'), 10);
        const category = this.getAttribute('data-category');
        openUiTest(category, index);
      };
    });
  }
  
  // Run an API test
  async function runApiTest(category, index) {
    const scenarios = getTestScenarios();
    let scenario;
    
    // Get the right scenario
    switch(category) {
      case 'Blocked Date Tests':
        scenario = scenarios.blockedDates[index];
        break;
      case 'Minimum Stay Tests':
        scenario = scenarios.minStay[index];
        break;
      case 'Guest Count Tests':
        scenario = scenarios.guestCount[index];
        break;
      case 'Date Range Tests':
        scenario = scenarios.dateRanges[index];
        break;
      default:
        return;
    }
    
    if (!scenario) return;
    
    log(`Running API test: ${scenario.name}`);
    
    try {
      const response = await fetch('/api/check-pricing-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId: propertySlug,
          checkIn: scenario.checkIn.toISOString(),
          checkOut: scenario.checkOut.toISOString(),
          guests: scenario.guests
        }),
      });
      
      const data = await response.json();
      
      // Log detailed results
      if (data.available) {
        log(`API allowed the booking request`);
        log(`Total price: ${data.pricing.totalPrice} ${data.pricing.currency}`);
        
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
          }
        }
      } else {
        log(`API rejected the booking request: ${data.reason}`);
        
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
  function openUiTest(category, index) {
    const scenarios = getTestScenarios();
    let scenario;
    
    // Get the right scenario
    switch(category) {
      case 'Blocked Date Tests':
        scenario = scenarios.blockedDates[index];
        break;
      case 'Minimum Stay Tests':
        scenario = scenarios.minStay[index];
        break;
      case 'Guest Count Tests':
        scenario = scenarios.guestCount[index];
        break;
      case 'Date Range Tests':
        scenario = scenarios.dateRanges[index];
        break;
      default:
        return;
    }
    
    if (!scenario) return;
    
    // Format dates for URL
    const checkInStr = formatDateISO(scenario.checkIn);
    const checkOutStr = formatDateISO(scenario.checkOut);
    
    // Build URL for booking check page
    const url = `${document.location.origin}/booking/check/${propertySlug}?checkIn=${checkInStr}&checkOut=${checkOutStr}&guests=${scenario.guests}`;
    
    // Open in new tab
    log(`Opening test case in new tab: ${scenario.name}`);
    window.open(url, '_blank');
  }
  
  // Initialize the test panel
  createTestPanel();
  log(`Test panel initialized for property: ${propertySlug}`);
  log(`Use "Test API" to check API responses or "Test UI" to open the scenario in a new tab`);
})();