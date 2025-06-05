// Production Testing Script
// Run this in the browser console

const BASE_URL = 'https://prop-management-1061532538391.europe-west4.run.app';

// Test function to check page load
async function testPageLoad(path) {
    try {
        const response = await fetch(BASE_URL + path);
        return {
            path,
            status: response.status,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
        };
    } catch (error) {
        return {
            path,
            error: error.message
        };
    }
}

// Test API endpoints
async function testAPI(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        if (body) {
            options.body = JSON.stringify(body);
        }
        const response = await fetch(BASE_URL + endpoint, options);
        const data = await response.json();
        return {
            endpoint,
            status: response.status,
            data
        };
    } catch (error) {
        return {
            endpoint,
            error: error.message
        };
    }
}

// Run all tests
async function runTests() {
    console.log('Starting Production Tests...');
    
    // Page load tests
    const pages = [
        '/',
        '/properties/prahova-mountain-chalet',
        '/admin',
        '/login',
        '/test-page',
        '/nonexistent'
    ];
    
    console.log('\n1. Testing Page Loads:');
    for (const page of pages) {
        const result = await testPageLoad(page);
        console.log(`${page}: ${result.status || result.error}`);
    }
    
    // API tests
    console.log('\n2. Testing APIs:');
    
    const apiTests = [
        { endpoint: '/api/health' },
        { endpoint: '/api/readiness' },
        { 
            endpoint: '/api/check-availability',
            method: 'POST',
            body: {
                propertyId: 'prahova-mountain-chalet',
                startDate: '2025-06-01',
                endDate: '2025-06-05'
            }
        },
        {
            endpoint: '/api/check-pricing',
            method: 'POST',
            body: {
                propertyId: 'prahova-mountain-chalet',
                startDate: '2025-06-01',
                endDate: '2025-06-05',
                guestCount: 2
            }
        }
    ];
    
    for (const test of apiTests) {
        const result = await testAPI(test.endpoint, test.method, test.body);
        console.log(`${test.endpoint}: ${result.status || result.error}`);
        if (result.data) {
            console.log('Response:', result.data);
        }
    }
    
    // UI element tests
    console.log('\n3. Testing UI Elements (if on property page):');
    if (window.location.pathname.includes('properties')) {
        // Check for booking form
        const bookingForm = document.querySelector('[data-testid="booking-form"]');
        console.log('Booking form:', bookingForm ? 'Found' : 'Not found');
        
        // Check for language selector
        const langSelector = document.querySelector('[aria-label*="language"]');
        console.log('Language selector:', langSelector ? 'Found' : 'Not found');
        
        // Check for currency selector
        const currencySelector = document.querySelector('[aria-label*="currency"]');
        console.log('Currency selector:', currencySelector ? 'Found' : 'Not found');
        
        // Check for calendar
        const calendar = document.querySelector('[role="grid"]');
        console.log('Calendar:', calendar ? 'Found' : 'Not found');
    }
    
    console.log('\nTests complete!');
}

// Run tests
runTests();

// Helper to test booking flow
function testBookingInteraction() {
    console.log('\n4. Testing Booking Interaction:');
    
    // Try to find and click date inputs
    const checkIn = document.querySelector('[name="check-in"], [aria-label*="check"]');
    const checkOut = document.querySelector('[name="check-out"], [aria-label*="check"]');
    
    if (checkIn && checkOut) {
        console.log('Date inputs found');
        // Simulate clicks
        checkIn.click();
        setTimeout(() => {
            checkOut.click();
        }, 1000);
    } else {
        console.log('Date inputs not found');
    }
}

// Additional helper functions
window.productionTest = {
    runTests,
    testPageLoad,
    testAPI,
    testBookingInteraction,
    baseUrl: BASE_URL
};