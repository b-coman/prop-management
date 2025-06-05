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
  console.log('Initializing UI-focused test panel from direct path...');
  
  // Extract the property slug from the URL
  let propertySlug;
  
  // Check if we're on a booking check page
  if (document.location.pathname.includes('/booking/check/')) {
    propertySlug = document.location.pathname.split('/').filter(Boolean)[2];
  } 
  // Or on a property page
  else if (document.location.pathname.includes('/properties/')) {
    propertySlug = document.location.pathname.split('/').filter(Boolean)[1];
  } else if (document.location.pathname.includes('/admin/pricing')) {
    // Check if there's a propertyId parameter in the URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('propertyId')) {
      propertySlug = urlParams.get('propertyId');
    } else {
      // Default to a test property if none detected
      propertySlug = "prahova-mountain-chalet";
    }
  } else {
    // Default to a test property if none detected
    propertySlug = "prahova-mountain-chalet";
    console.log("No property detected in URL, using default:", propertySlug);
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
  
  // Create test scenarios for display - we'll show these immediately
  const createTestScenarios = () => {
    const today = new Date();
    const tomorrow = utils.addDays(today, 1);
    
    // Create a date 30 days from now
    const futureDate = utils.addDays(today, 30);
    
    // Create weekend dates
    const weekendStart = new Date(futureDate);
    // Adjust to the next Friday
    while (weekendStart.getDay() !== 5) { // 5 = Friday
      weekendStart.setDate(weekendStart.getDate() + 1);
    }
    const weekendEnd = utils.addDays(weekendStart, 2); // Sunday
    
    // Create sample test scenarios
    return [
      {
        name: "Weekend Stay Test",
        description: "Tests a weekend stay (Friday-Sunday)",
        checkIn: weekendStart,
        checkOut: weekendEnd,
        guests: 2,
        expectedOutcome: "allowed"
      },
      {
        name: "Mid-week Stay Test",
        description: "Tests a mid-week stay (Tuesday-Thursday)",
        checkIn: utils.addDays(today, 30),
        checkOut: utils.addDays(today, 32),
        guests: 2,
        expectedOutcome: "allowed"
      },
      {
        name: "Large Group Test",
        description: "Tests booking with a larger group",
        checkIn: utils.addDays(today, 45),
        checkOut: utils.addDays(today, 47),
        guests: 6,
        expectedOutcome: "allowed"
      }
    ];
  };
  
  // Create the test panel with sample scenarios
  function createSimpleTestPanel() {
    const testScenarios = createTestScenarios();
    
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
    
    // Content area
    const contentArea = document.createElement('div');
    contentArea.innerHTML = `
      <h4 style="margin-top: 0;">Sample Test Scenarios</h4>
      <p style="margin-bottom: 15px; color: #666;">These are pre-generated test scenarios to demonstrate the UI.</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 15px;">
        ${testScenarios.map((test, i) => `
          <div style="border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; background: white;">
            <h5 style="margin-top: 0; margin-bottom: 10px;">${test.name}</h5>
            <p style="margin-bottom: 10px; color: #666; font-size: 13px;">${test.description}</p>
            <div style="font-size: 12px; margin-bottom: 8px;">
              <div>Check-in: <strong>${utils.formatDate(test.checkIn)}</strong></div>
              <div>Check-out: <strong>${utils.formatDate(test.checkOut)}</strong></div>
              <div>Guests: <strong>${test.guests}</strong></div>
              <div>Expected: <strong>${test.expectedOutcome}</strong></div>
            </div>
            <div style="display: flex; gap: 10px;">
              <button class="test-api-btn" data-index="${i}" style="flex: 1; background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Test API</button>
              <button class="open-ui-btn" data-index="${i}" style="flex: 1; background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Test UI</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    panel.appendChild(contentArea);
    
    // Add event handlers
    document.body.appendChild(panel);
    
    // Add event handlers for the buttons after the panel is in the DOM
    setTimeout(() => {
      // API test buttons
      const apiButtons = document.querySelectorAll('.test-api-btn');
      for (let i = 0; i < apiButtons.length; i++) {
        const btn = apiButtons[i];
        btn.onclick = function() {
          const index = parseInt(this.getAttribute('data-index'), 10);
          console.log(`Running API test for scenario ${index + 1}`);
          alert(`API test for ${testScenarios[index].name} would be run here`);
        };
      }
      
      // UI test buttons
      const uiButtons = document.querySelectorAll('.open-ui-btn');
      for (let i = 0; i < uiButtons.length; i++) {
        const btn = uiButtons[i];
        btn.onclick = function() {
          const index = parseInt(this.getAttribute('data-index'), 10);
          const test = testScenarios[index];
          console.log(`Opening UI test for scenario ${index + 1}`);
          
          // Format dates for URL
          const checkInStr = utils.formatDateISO(test.checkIn);
          const checkOutStr = utils.formatDateISO(test.checkOut);
          
          // Build URL for booking check page
          const url = `${document.location.origin}/booking/check/${propertySlug}?checkIn=${checkInStr}&checkOut=${checkOutStr}&guests=${test.guests}`;
          
          // Open in new tab
          window.open(url, '_blank');
        };
      }
      
      // Close button handler
      document.getElementById('close-test-panel').onclick = function() {
        document.body.removeChild(panel);
      };
    }, 100);
  }
  
  // Create and show test panel immediately
  createSimpleTestPanel();
  
  console.log('UI test panel initialized successfully');
})();