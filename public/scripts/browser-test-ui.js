/**
 * UI-Focused Test Script for Pricing and Availability
 * 
 * This script creates test scenarios focused on the UI aspects of booking.
 * It generates simple, visual tests to verify the booking UI functions correctly.
 * 
 * Usage:
 * 1. Navigate to a booking page in your browser
 * 2. Open the browser console (F12 or right-click > Inspect > Console)
 * 3. Paste this entire script and press Enter
 * 4. The test panel will appear at the bottom of the page
 */

(async function() {
  console.log('Initializing UI-focused test panel...');
  
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
    loadingDiv.innerHTML = 'Creating UI test scenarios...';
    
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
        <h3 style="margin: 0; color: #333;">UI Test Panel</h3>
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
      { id: 'basic-ui', label: 'Basic UI Tests' },
      { id: 'component', label: 'Component Tests' },
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
    showTabContent('basic-ui', testScenarios);
  }
  
  // Show appropriate tab content
  function showTabContent(tabId, scenarios) {
    const contentArea = document.getElementById('test-content-area');
    
    switch(tabId) {
      case 'basic-ui':
        renderBasicUITests(contentArea, scenarios.basicUI);
        break;
      case 'component':
        renderComponentTests(contentArea, scenarios.componentTests);
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
  
  // Render basic UI tests
  function renderBasicUITests(container, tests) {
    container.innerHTML = `
      <h4 style="margin-top: 0;">Basic UI Tests</h4>
      <p style="margin-bottom: 15px; color: #666;">These tests focus on basic UI interactions and form validation.</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 15px;">
        ${tests.map((test, i) => `
          <div style="border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; background: white;">
            <h5 style="margin-top: 0; margin-bottom: 10px;">${test.name}</h5>
            <p style="margin-bottom: 10px; color: #666; font-size: 13px;">${test.description}</p>
            <div style="font-size: 12px; margin-bottom: 8px;">
              <div>Check-in: <strong>${utils.formatDate(test.checkIn)}</strong></div>
              <div>Check-out: <strong>${utils.formatDate(test.checkOut)}</strong></div>
              <div>Guests: <strong>${test.guests}</strong></div>
            </div>
            <div style="display: flex; gap: 10px;">
              <button class="open-ui-btn" data-index="${i}" data-type="basic" style="flex: 1; background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Test UI</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
    // Add event handlers
    const uiButtons = container.querySelectorAll('.open-ui-btn');
    for (let i = 0; i < uiButtons.length; i++) {
      const btn = uiButtons[i];
      btn.onclick = function() {
        const index = parseInt(this.getAttribute('data-index'), 10);
        const type = this.getAttribute('data-type');
        openUiTest(type === 'basic' ? tests[index] : null);
      };
    }
  }
  
  // Render component tests
  function renderComponentTests(container, tests) {
    container.innerHTML = `
      <h4 style="margin-top: 0;">Component Tests</h4>
      <p style="margin-bottom: 15px; color: #666;">These tests focus on specific components like date pickers, guest selectors, etc.</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 15px;">
        ${tests.map((test, i) => `
          <div style="border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; background: white;">
            <h5 style="margin-top: 0; margin-bottom: 10px;">${test.name}</h5>
            <p style="margin-bottom: 10px; color: #666; font-size: 13px;">${test.description}</p>
            <div style="font-size: 12px; margin-bottom: 8px;">
              <div>Test target: <strong>${test.component}</strong></div>
              <div>Focus: <strong>${test.focus}</strong></div>
            </div>
            <div style="display: flex; gap: 10px;">
              <button class="open-ui-btn" data-index="${i}" data-type="component" style="flex: 1; background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Test UI</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
    // Add event handlers
    const uiButtons = container.querySelectorAll('.open-ui-btn');
    for (let i = 0; i < uiButtons.length; i++) {
      const btn = uiButtons[i];
      btn.onclick = function() {
        const index = parseInt(this.getAttribute('data-index'), 10);
        const type = this.getAttribute('data-type');
        openComponentTest(type === 'component' ? tests[index] : null);
      };
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
    log(`Opening UI test case in new tab: ${test.name}`);
    window.open(url, '_blank');
  }
  
  // Open component test
  function openComponentTest(test) {
    if (!test) return;
    
    // URL for component test will include special flags
    let url = `${document.location.origin}/booking/check/${propertySlug}?component=${encodeURIComponent(test.component)}`;
    
    if (test.params) {
      Object.keys(test.params).forEach(key => {
        url += `&${key}=${encodeURIComponent(test.params[key])}`;
      });
    }
    
    // Open in new tab
    log(`Opening component test in new tab: ${test.name}`);
    window.open(url, '_blank');
  }
  
  // Create test scenarios
  function createTestScenarios() {
    const today = new Date();
    const tomorrow = utils.addDays(today, 1);
    
    // Create a date 30 days from now
    const futureDate = utils.addDays(today, 30);
    const laterFutureDate = utils.addDays(today, 33);
    
    // Create weekend dates
    const weekendStart = new Date(futureDate);
    // Adjust to the next Friday
    while (weekendStart.getDay() !== 5) { // 5 = Friday
      weekendStart.setDate(weekendStart.getDate() + 1);
    }
    const weekendEnd = utils.addDays(weekendStart, 2); // Sunday
    
    // Basic UI tests
    const basicUITests = [
      {
        name: "Weekend Stay",
        description: "Tests the UI for a weekend stay booking",
        checkIn: weekendStart,
        checkOut: weekendEnd,
        guests: 2
      },
      {
        name: "Future 3-Night Stay",
        description: "Tests booking a 3-night stay in the future",
        checkIn: futureDate,
        checkOut: utils.addDays(futureDate, 3),
        guests: 2
      },
      {
        name: "Large Group",
        description: "Tests the UI with a larger group size",
        checkIn: futureDate,
        checkOut: utils.addDays(futureDate, 2),
        guests: 6
      },
      {
        name: "Small Group",
        description: "Tests the UI with a minimal group size",
        checkIn: futureDate,
        checkOut: utils.addDays(futureDate, 2),
        guests: 1
      },
      {
        name: "Week-long Stay",
        description: "Tests the UI for a longer week-long stay",
        checkIn: futureDate,
        checkOut: utils.addDays(futureDate, 7),
        guests: 3
      }
    ];
    
    // Component-specific tests
    const componentTests = [
      {
        name: "Date Picker Interaction",
        description: "Tests interactions with the date picker component",
        component: "DatePicker",
        focus: "UI interaction",
        params: { highlight: "true" }
      },
      {
        name: "Guest Selector",
        description: "Tests the guest selector dropdown and validation",
        component: "GuestSelector",
        focus: "Validation",
        params: { highlight: "true" }
      },
      {
        name: "Booking Summary",
        description: "Tests the booking summary display with various parameters",
        component: "BookingSummary",
        focus: "Display",
        params: { 
          checkIn: utils.formatDateISO(futureDate),
          checkOut: utils.formatDateISO(utils.addDays(futureDate, 3)),
          guests: 4,
          highlight: "true"
        }
      },
      {
        name: "Form Validation",
        description: "Tests validation rules on the booking form",
        component: "BookingForm",
        focus: "Validation",
        params: { highlight: "true", testMode: "validation" }
      },
      {
        name: "Pricing Display",
        description: "Tests how prices and discounts are displayed in the UI",
        component: "PricingDisplay",
        focus: "Display",
        params: { 
          checkIn: utils.formatDateISO(futureDate),
          checkOut: utils.formatDateISO(utils.addDays(futureDate, 7)),
          guests: 2,
          highlight: "true"
        }
      }
    ];
    
    return {
      basicUI: basicUITests,
      componentTests: componentTests
    };
  }
  
  // Main execution
  async function initialize() {
    const loadingIndicator = showLoadingIndicator();
    
    try {
      log('Initializing UI test panel...');
      
      // Create test scenarios
      const testScenarios = createTestScenarios();
      
      // Create the test panel
      createTestPanel(testScenarios);
      
      log(`Test panel ready with ${testScenarios.basicUI.length + testScenarios.componentTests.length} UI test scenarios`);
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