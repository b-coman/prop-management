/**
 * Smart UI Test Script for Pricing and Availability
 * 
 * This enhanced test script uses real Firestore data to create relevant test scenarios
 * for pricing and availability testing. It examines actual price calendars, property
 * configuration, and availability data to generate tests for real edge cases.
 * 
 * IMPORTANT: This is a testing-only tool that does not modify any production code.
 * 
 * Usage:
 * 1. Navigate to a booking page in your browser (e.g., http://localhost:9002/booking/check/prahova-mountain-chalet)
 * 2. Open the browser console (F12 or right-click > Inspect > Console)
 * 3. Paste this entire script and press Enter
 * 4. The test panel will load data and then appear at the bottom of the page
 */

(async function() {
  console.log('Initializing smart test panel...');
  
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
  
  // Try to load Firebase from the application
  let firestore;
  try {
    // Import Firebase modules from the app's code
    const firebase = await import('/lib/firebase.js').catch(() => null);
    if (!firebase) {
      throw new Error('Could not import Firebase from /lib/firebase.js');
    }
    
    console.log('Successfully imported Firebase from app');
    firestore = firebase.db;
    
    if (!firestore) {
      // Try to import explicitly
      const { getFirestore, collection, query, where, getDocs, doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('/lib/firebase.js');
      firestore = db;
    }
  } catch (error) {
    console.warn('Failed to load Firebase from app, falling back to manual imports:', error);
    
    try {
      // Manual import fallback
      const { initializeApp } = await import('firebase/app');
      const { getFirestore } = await import('firebase/firestore');
      
      // Get Firebase config from window if available
      const firebaseConfig = window.firebaseConfig || {
        apiKey: prompt('Enter Firebase API key (this is only used for testing):'),
        authDomain: `${prompt('Enter Firebase project ID:')}.firebaseapp.com`,
        projectId: prompt('Enter Firebase project ID:'),
      };
      
      const app = initializeApp(firebaseConfig);
      firestore = getFirestore(app);
      console.log('Initialized Firebase manually');
    } catch (fallbackError) {
      console.error('Failed to initialize Firebase:', fallbackError);
      alert('Could not initialize Firebase for testing. Please check console for details.');
      return;
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
    
    getLastDayOfMonth(year, month) {
      return new Date(year, month + 1, 0).getDate();
    },
    
    // Format YYYY-MM
    getYearMonth(date) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    },
    
    async fetchFromFirestore(collection, docId) {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const docRef = doc(firestore, collection, docId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          return docSnap.data();
        } else {
          console.log(`No document found: ${collection}/${docId}`);
          return null;
        }
      } catch (error) {
        console.error(`Error fetching ${collection}/${docId}:`, error);
        return null;
      }
    },
    
    async queryCollection(collectionName, conditions = []) {
      try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        let q = collection(firestore, collectionName);
        
        // Add query conditions if provided
        if (conditions.length > 0) {
          q = query(q, ...conditions.map(c => where(c.field, c.op, c.value)));
        }
        
        const querySnapshot = await getDocs(q);
        const results = [];
        
        querySnapshot.forEach(doc => {
          results.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        return results;
      } catch (error) {
        console.error(`Error querying ${collectionName}:`, error);
        return [];
      }
    }
  };
  
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
    loadingDiv.innerHTML = 'Loading test data from Firestore...';
    
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
        <h3 style="margin: 0; color: #333;">Smart Pricing & Availability Test Panel</h3>
        <button id="close-test-panel" style="border: none; background: #f44336; color: white; padding: 5px 10px; cursor: pointer; border-radius: 4px;">Close</button>
      </div>
      <p>Property: <strong>${propertySlug}</strong> (Tests based on actual data)</p>
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
      container.innerHTML = `
        <h4 style="margin-top: 0;">${title}</h4>
        <div style="padding: 20px; text-align: center; color: #666;">
          No ${title.toLowerCase()} scenarios found for this property.
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <h4 style="margin-top: 0;">${title} (${scenarios.length} found)</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">
        ${scenarios.map((scenario, i) => `
          <div style="border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; background: white;">
            <h5 style="margin-top: 0; margin-bottom: 10px;">${scenario.name}</h5>
            <p style="margin-bottom: 10px; color: #666; font-size: 13px;">${scenario.description}</p>
            <div style="font-size: 12px; margin-bottom: 8px;">
              <div>Check-in: <strong>${utils.formatDate(scenario.checkIn)}</strong></div>
              <div>Check-out: <strong>${utils.formatDate(scenario.checkOut)}</strong></div>
              <div>Guests: <strong>${scenario.guests}</strong></div>
              ${scenario.expectedOutcome ? `<div>Expected: <strong>${scenario.expectedOutcome === 'allowed' ? '✅ Allowed' : '❌ Rejected'}</strong></div>` : ''}
              ${scenario.reason ? `<div>Reason: <strong>${scenario.reason}</strong></div>` : ''}
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
        runApiTest(category, index, scenarios);
      };
    });
    
    container.querySelectorAll('.open-ui-btn').forEach(btn => {
      btn.onclick = function() {
        const index = parseInt(this.getAttribute('data-index'), 10);
        const category = this.getAttribute('data-category');
        openUiTest(category, index, scenarios);
      };
    });
  }
  
  // Run an API test
  async function runApiTest(category, index, allScenarios) {
    // Find the right scenario category
    let scenarios;
    switch(category) {
      case 'Blocked Date Tests':
        scenarios = allScenarios.blockedDates;
        break;
      case 'Minimum Stay Tests':
        scenarios = allScenarios.minStay;
        break;
      case 'Guest Count Tests':
        scenarios = allScenarios.guestCount;
        break;
      case 'Date Range Tests':
        scenarios = allScenarios.dateRanges;
        break;
      default:
        return;
    }
    
    const scenario = scenarios[index];
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
        log(`API allows booking for "${scenario.name}"`);
        
        // Check if this matches expected outcome
        if (scenario.expectedOutcome === 'rejected') {
          log(`❓ Unexpected result: API allowed booking but we expected rejection due to "${scenario.reason}"`, true);
        } else {
          log(`✅ Result matches expected outcome: Booking allowed`);
        }
        
        log(`Total price: ${data.pricing.totalPrice} ${data.pricing.currency}`);
        
        // Check for discounts
        if (data.pricing.lengthOfStayDiscount && data.pricing.lengthOfStayDiscount.discountAmount > 0) {
          log(`Length of stay discount: ${data.pricing.lengthOfStayDiscount.discountPercentage}% (${data.pricing.lengthOfStayDiscount.discountAmount} ${data.pricing.currency})`);
          
          // Check if discount matches expectation
          if (scenario.expectedDiscount && scenario.expectedDiscount.includes('%')) {
            const expectedPct = parseInt(scenario.expectedDiscount);
            if (data.pricing.lengthOfStayDiscount.discountPercentage === expectedPct) {
              log(`✅ Discount percentage matches expected value: ${expectedPct}%`);
            } else {
              log(`❓ Discount percentage (${data.pricing.lengthOfStayDiscount.discountPercentage}%) differs from expected (${expectedPct}%)`, true);
            }
          }
        } else if (scenario.expectedDiscount) {
          log(`❓ Expected discount of ${scenario.expectedDiscount} but none was applied`, true);
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
        log(`API rejects booking for "${scenario.name}": ${data.reason}`);
        
        // Check if this matches expected outcome
        if (scenario.expectedOutcome === 'allowed') {
          log(`❓ Unexpected result: API rejected booking but we expected it to be allowed`, true);
        } else if (scenario.reason && data.reason !== scenario.reason) {
          log(`❓ Rejection reason (${data.reason}) differs from expected (${scenario.reason})`, true);
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
  function openUiTest(category, index, allScenarios) {
    // Find the right scenario category
    let scenarios;
    switch(category) {
      case 'Blocked Date Tests':
        scenarios = allScenarios.blockedDates;
        break;
      case 'Minimum Stay Tests':
        scenarios = allScenarios.minStay;
        break;
      case 'Guest Count Tests':
        scenarios = allScenarios.guestCount;
        break;
      case 'Date Range Tests':
        scenarios = allScenarios.dateRanges;
        break;
      default:
        return;
    }
    
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
  
  // Generate test scenarios based on real Firestore data
  async function discoverTestScenarios() {
    // Show loading indicator
    const loadingIndicator = showLoadingIndicator();
    
    // Initialize default scenarios
    const scenarios = {
      blockedDates: [],
      minStay: [],
      guestCount: [],
      dateRanges: []
    };
    
    try {
      log('Fetching property data from Firestore...');
      
      // Step 1: Load property configuration
      const propertyData = await utils.fetchFromFirestore('properties', propertySlug);
      if (!propertyData) {
        log(`Could not find property ${propertySlug} in Firestore`, true);
        return getDefaultScenarios();
      }
      
      log(`Successfully loaded property data for ${propertySlug}`);
      
      // Step 2: Generate date range for calendars to check
      const today = new Date();
      const startDate = new Date(today);
      const endDate = new Date(today);
      endDate.setMonth(today.getMonth() + 3); // Look 3 months ahead
      
      // Step 3: Get price calendars
      log('Fetching price calendars...');
      
      // Collect all months we need to check
      const monthsToCheck = [];
      let currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const yearMonth = utils.getYearMonth(currentDate);
        monthsToCheck.push(yearMonth);
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      
      log(`Checking calendars for months: ${monthsToCheck.join(', ')}`);
      
      // Track unavailable dates and min stay requirements
      const unavailableDates = [];
      const minStayDates = [];
      const datesWithPricing = [];
      
      // Fetch each calendar
      for (const yearMonth of monthsToCheck) {
        const calendarId = `${propertySlug}_${yearMonth}`;
        const calendarData = await utils.fetchFromFirestore('priceCalendars', calendarId);
        
        if (calendarData) {
          log(`Found price calendar: ${calendarId}`);
          
          const days = calendarData.days || {};
          const [year, month] = yearMonth.split('-').map(Number);
          
          // Process each day in the calendar
          Object.entries(days).forEach(([dayStr, dayData]) => {
            const dayNum = parseInt(dayStr, 10);
            if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) return;
            
            const date = new Date(year, month - 1, dayNum);
            
            // Skip dates in the past
            if (date < today) return;
            
            // Track unavailable dates
            if (dayData.available === false) {
              unavailableDates.push({
                date,
                reason: dayData.reason || 'marked as unavailable'
              });
            }
            
            // Track min stay requirements
            if (dayData.minimumStay && dayData.minimumStay > 1) {
              minStayDates.push({
                date,
                minStay: dayData.minimumStay,
                reason: dayData.reason || `minimum stay of ${dayData.minimumStay} nights required`
              });
            }
            
            // Track pricing data
            if (dayData.available && (dayData.prices || dayData.adjustedPrice)) {
              datesWithPricing.push({
                date,
                basePrice: dayData.basePrice,
                adjustedPrice: dayData.adjustedPrice,
                prices: dayData.prices,
                isWeekend: dayData.isWeekend,
                seasonId: dayData.seasonId
              });
            }
          });
        } else {
          log(`No price calendar found for ${calendarId}`);
        }
      }
      
      log(`Found ${unavailableDates.length} unavailable dates`);
      log(`Found ${minStayDates.length} dates with minimum stay requirements`);
      log(`Found ${datesWithPricing.length} dates with pricing data`);
      
      // Step 4: Generate blocked date scenarios
      if (unavailableDates.length > 0) {
        // Sort dates to find consecutive blocks
        unavailableDates.sort((a, b) => a.date.getTime() - b.date.getTime());
        
        // Generate isolated blocked date tests
        for (let i = 0; i < Math.min(5, unavailableDates.length); i++) {
          const blockedDate = unavailableDates[i];
          
          // Create test with this unavailable date in the middle
          const dayBefore = new Date(blockedDate.date);
          dayBefore.setDate(blockedDate.date.getDate() - 1);
          
          const twoDaysAfter = new Date(blockedDate.date);
          twoDaysAfter.setDate(blockedDate.date.getDate() + 2);
          
          scenarios.blockedDates.push({
            name: `Blocked Middle Day: ${utils.formatDate(blockedDate.date)}`,
            description: `Test booking with unavailable date in the middle of stay`,
            checkIn: dayBefore,
            checkOut: twoDaysAfter,
            guests: 2,
            expectedOutcome: 'rejected',
            reason: 'unavailable_dates'
          });
          
          // Create test with this date as checkout (should be allowed)
          const twoDaysBefore = new Date(blockedDate.date);
          twoDaysBefore.setDate(blockedDate.date.getDate() - 2);
          
          scenarios.blockedDates.push({
            name: `Blocked Checkout: ${utils.formatDate(blockedDate.date)}`,
            description: `Test booking with checkout on an unavailable date (standard convention allows this)`,
            checkIn: twoDaysBefore,
            checkOut: blockedDate.date,
            guests: 2,
            expectedOutcome: 'allowed'
          });
        }
      }
      
      // Step 5: Generate minimum stay scenarios
      if (minStayDates.length > 0) {
        // Sort by minimum stay requirement (highest to lowest)
        minStayDates.sort((a, b) => b.minStay - a.minStay);
        
        // Generate tests for different minimum stay requirements
        for (let i = 0; i < Math.min(5, minStayDates.length); i++) {
          const minStayDate = minStayDates[i];
          
          // Test exactly meeting the minimum stay
          scenarios.minStay.push({
            name: `Exact Min Stay: ${minStayDate.minStay} nights`,
            description: `Test booking exactly ${minStayDate.minStay} nights (required on ${utils.formatDate(minStayDate.date)})`,
            checkIn: minStayDate.date,
            checkOut: new Date(new Date(minStayDate.date).setDate(minStayDate.date.getDate() + minStayDate.minStay)),
            guests: 2,
            expectedOutcome: 'allowed'
          });
          
          // Test below the minimum stay (should be rejected)
          scenarios.minStay.push({
            name: `Below Min Stay: ${minStayDate.minStay - 1} nights`,
            description: `Test booking ${minStayDate.minStay - 1} nights when ${minStayDate.minStay} required`,
            checkIn: minStayDate.date,
            checkOut: new Date(new Date(minStayDate.date).setDate(minStayDate.date.getDate() + minStayDate.minStay - 1)),
            guests: 2,
            expectedOutcome: 'rejected',
            reason: 'minimum_stay'
          });
        }
      }
      
      // Step 6: Generate occupancy pricing scenarios
      if (propertyData.pricing?.occupancyPricing?.enabled) {
        const baseOccupancy = propertyData.pricing.occupancyPricing.baseOccupancy || 2;
        const maxOccupancy = propertyData.maxGuests || 8;
        
        // Find a date with some price data to use for tests
        let testStartDate = today;
        if (datesWithPricing.length > 0) {
          testStartDate = datesWithPricing[0].date;
        }
        
        // Create tests at different occupancy levels
        scenarios.guestCount = [
          {
            name: `Base Occupancy: ${baseOccupancy} guests`,
            description: `Test pricing with base occupancy (${baseOccupancy} guests)`,
            checkIn: testStartDate,
            checkOut: new Date(new Date(testStartDate).setDate(testStartDate.getDate() + 3)),
            guests: baseOccupancy,
            expectedOutcome: 'allowed'
          },
          {
            name: `Above Base: ${baseOccupancy + 1} guests`,
            description: `Test pricing just above base occupancy`,
            checkIn: testStartDate,
            checkOut: new Date(new Date(testStartDate).setDate(testStartDate.getDate() + 3)),
            guests: baseOccupancy + 1,
            expectedOutcome: 'allowed',
            expectedPriceIncrease: true
          }
        ];
        
        if (maxOccupancy > baseOccupancy + 1) {
          scenarios.guestCount.push({
            name: `Maximum Occupancy: ${maxOccupancy} guests`,
            description: `Test pricing at maximum allowed occupancy`,
            checkIn: testStartDate,
            checkOut: new Date(new Date(testStartDate).setDate(testStartDate.getDate() + 3)),
            guests: maxOccupancy,
            expectedOutcome: 'allowed',
            expectedPriceIncrease: true
          });
        }
      }
      
      // Step 7: Generate date range scenarios
      
      // Weekend pricing
      let nextFriday = new Date(today);
      while (nextFriday.getDay() !== 5) { // 5 is Friday
        nextFriday.setDate(nextFriday.getDate() + 1);
      }
      
      const nextSunday = new Date(nextFriday);
      nextSunday.setDate(nextFriday.getDate() + 2);
      
      scenarios.dateRanges.push({
        name: 'Weekend Stay',
        description: 'Test Friday to Sunday to check weekend pricing adjustments',
        checkIn: nextFriday,
        checkOut: nextSunday,
        guests: 2,
        expectedOutcome: 'allowed',
        expectWeekendPricing: true
      });
      
      // Length of stay discounts
      if (propertyData.pricing?.lengthOfStayDiscounts?.length > 0) {
        const discounts = propertyData.pricing.lengthOfStayDiscounts.sort((a, b) => a.nights - b.nights);
        
        for (const discount of discounts) {
          const discountStart = new Date(today);
          discountStart.setDate(today.getDate() + 30); // Start a month from now
          
          scenarios.dateRanges.push({
            name: `${discount.nights}-Night Discount`,
            description: `Test ${discount.discountPercentage}% discount for ${discount.nights}+ nights`,
            checkIn: discountStart,
            checkOut: new Date(new Date(discountStart).setDate(discountStart.getDate() + discount.nights)),
            guests: 2,
            expectedOutcome: 'allowed',
            expectedDiscount: `${discount.discountPercentage}%`
          });
          
          // Test just below discount threshold if possible
          if (discount.nights > 1) {
            scenarios.dateRanges.push({
              name: `Below ${discount.nights}-Night Discount`,
              description: `Test ${discount.nights - 1} nights (just below discount threshold)`,
              checkIn: discountStart,
              checkOut: new Date(new Date(discountStart).setDate(discountStart.getDate() + discount.nights - 1)),
              guests: 2,
              expectedOutcome: 'allowed',
              expectedDiscount: null
            });
          }
        }
      }
      
      log('Successfully generated test scenarios based on Firestore data');
      return scenarios;
    } catch (error) {
      log(`Error discovering test scenarios: ${error.message}`, true);
      console.error(error);
      
      // Fallback to default scenarios
      return getDefaultScenarios();
    } finally {
      // Hide loading indicator
      removeLoadingIndicator();
    }
  }
  
  // Fallback to generate default test scenarios if Firestore fails
  function getDefaultScenarios() {
    log('Using default test scenarios (not based on Firestore data)');
    
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
          name: 'Potentially Blocked Middle Date',
          description: 'Tests booking with a date potentially blocked in the middle',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10),
          guests: 2
        },
        {
          name: 'Potentially Blocked Checkout Date',
          description: 'Tests when checkout date might be unavailable (should work)',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 9),
          guests: 2
        }
      ],
      minStay: [
        {
          name: 'Potential Minimum Stay Check - 2 Nights',
          description: 'Tests 2 nights stay (might have minimum stay requirement)',
          checkIn: new Date(today.getFullYear(), today.getMonth() + 1, 15),
          checkOut: new Date(today.getFullYear(), today.getMonth() + 1, 17),
          guests: 2
        },
        {
          name: 'Potential Minimum Stay Check - 4 Nights',
          description: 'Tests 4 nights stay (likely meets minimum requirements)',
          checkIn: new Date(today.getFullYear(), today.getMonth() + 1, 15),
          checkOut: new Date(today.getFullYear(), today.getMonth() + 1, 19),
          guests: 2
        }
      ],
      guestCount: [
        {
          name: 'Base Occupancy - 1 Guest',
          description: 'Tests with minimum guest count',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 17),
          guests: 1
        },
        {
          name: 'Medium Occupancy - 4 Guests',
          description: 'Tests with medium guest count',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 17),
          guests: 4
        },
        {
          name: 'Maximum Occupancy - 8 Guests',
          description: 'Tests with high guest count',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 17),
          guests: 8
        }
      ],
      dateRanges: [
        {
          name: 'Weekend Stay',
          description: 'Tests Friday to Sunday (potential weekend pricing)',
          checkIn: getNextFriday(),
          checkOut: getNextSunday(),
          guests: 2
        },
        {
          name: 'Week Stay - 7 Nights',
          description: 'Tests 7-night stay (potential discount)',
          checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30),
          checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 37),
          guests: 2
        },
        {
          name: 'Long Stay - 30 Days',
          description: 'Tests 30-day stay (potential long stay discount)',
          checkIn: new Date(today.getFullYear(), today.getMonth() + 1, 1),
          checkOut: new Date(today.getFullYear(), today.getMonth() + 2, 1),
          guests: 2
        }
      ]
    };
  }
  
  // Main execution
  async function initialize() {
    log('Initializing smart pricing test panel...');
    
    // Discover test scenarios
    const testScenarios = await discoverTestScenarios();
    
    // Create the test panel with discovered scenarios
    createTestPanel(testScenarios);
    
    log(`Smart pricing test panel ready with ${
      testScenarios.blockedDates.length +
      testScenarios.minStay.length +
      testScenarios.guestCount.length +
      testScenarios.dateRanges.length
    } test scenarios`);
  }
  
  // Start the initialization
  initialize();
})();