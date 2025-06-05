# UI Testing Guide for Pricing and Availability

This guide outlines how to test the pricing and availability functionality, ensuring that guests have the correct experience when booking properties. It covers both manual testing approaches and automated testing scripts.

## Test Environment Setup

Before testing, ensure:

1. The application is running locally (`npm run dev`)
2. Price calendars are generated and up-to-date (`npm run generate-price-calendars`)
3. Test data is available (properties with various pricing configurations)

## Testing Tools

Two main testing tools are available:

1. **Browser Test Panel** (Recommended):
   - Interactive testing tool that discovers real test scenarios
   - Makes API calls to test backend logic directly
   - Opens test scenarios in new tabs for UI verification
   - Provides detailed logs of test execution

2. **Manual URL Testing**:
   - Direct testing using URL parameters
   - Useful for quick tests of specific scenarios

## Test Pages

For UI testing, use either:

1. **Booking Check Page** (Recommended):
   - URL format: `http://localhost:9002/booking/check/[property-slug]`
   - Example: `http://localhost:9002/booking/check/prahova-mountain-chalet`
   - This page contains the complete booking form with date selection, guest count, and pricing
   - Ideal for testing the entire booking experience

2. **Property Detail Page**:
   - URL format: `http://localhost:9002/properties/[property-slug]`
   - Contains availability calendar and initial booking widget
   - Useful for testing initial date selection and availability display

You can add URL parameters to pre-select dates:
- `?checkIn=2025-05-28&checkOut=2025-05-31` to test specific date ranges
- `?guests=4` to test specific guest counts

## Using the Browser Test Panel

The Browser Test Panel is an interactive tool that finds real test scenarios using your actual property data. To use it:

### Automatic Loading (Recommended)

The test panel can be automatically loaded by adding a URL parameter:

1. Navigate to any page with the `test-mode` parameter:
   - Example: `http://localhost:9002/booking/check/prahova-mountain-chalet?test-mode`
2. The test panel will automatically appear at the bottom of the page
3. Different test scripts can be loaded by specifying the test type:
   - Default API-based tests: `?test-mode`
   - UI-focused tests: `?test-mode=ui`
   - Simplified tests: `?test-mode=simple`

### Manual Loading (Alternative)

If needed, you can also load the test panel manually:

1. Navigate to a booking check page (e.g., `http://localhost:9002/booking/check/prahova-mountain-chalet`)
2. Open the browser's developer console (F12 or right-click > Inspect > Console)
3. Copy and paste the contents of `scripts/browser-test-api.js` into the console
4. Wait for the test panel to appear at the bottom of the page

The test panel performs these actions:
1. Checks your property's availability data to find blocked dates
2. Probes minimum stay requirements by testing various booking lengths
3. Tests different guest counts to detect occupancy-based pricing
4. Examines pricing for different stay lengths to find discounts
5. Creates test scenarios based on real conditions it discovers

### Test Categories

The browser test panel includes four categories of tests:

1. **Blocked Date Tests**:
   - Tests booking requests with unavailable dates in the middle of the stay
   - Tests booking requests with checkout dates that are blocked
   - Verifies that the booking system correctly rejects stays with blocked dates
   - Confirms that the convention of allowing blocked checkout dates works correctly

2. **Minimum Stay Tests**:
   - Tests bookings that are shorter than minimum stay requirements
   - Tests bookings that exactly meet minimum stay requirements
   - Verifies that minimum stay validations work as expected

3. **Guest Count Tests**:
   - Tests bookings with different numbers of guests
   - Checks if pricing varies based on occupancy
   - Confirms that price differences are applied correctly for larger parties

4. **Date Range Tests**:
   - Tests weekend stays to verify weekend pricing
   - Tests longer stays to check for length-of-stay discounts
   - Verifies that pricing adjustments for different stay lengths are applied correctly

### Using the Test Panel

The test panel features an enhanced visual interface with detailed test cards that display:

- **Visual Status Indicators**:
  - Color-coded badges for test status (green for allowed, red for rejected)
  - Colored indicators for date availability 
  - Clearly labeled check-in and check-out dates

- **Date Information**:
  - Number of nights for each test scenario
  - Day of week for both check-in and check-out dates
  - Visual indicators for blocked or available dates

- **Test Actions**:
  1. **Test API**: Click the "Test API" button to check how the backend API responds
     - Results appear in the "Test Logs" tab
     - Shows whether the booking was allowed or rejected
     - Displays pricing details when relevant
     - Provides analysis of pricing patterns (weekend rates, discounts, etc.)

  2. **Test UI**: Click the "Test UI" button to open a new tab with the test scenario
     - Opens a new browser tab with the check-in, check-out, and guest count pre-filled
     - Allows you to observe how the UI handles the scenario
     - Verify error messages and price displays in the actual user interface

- **Test Logs Tab**:
  - Comprehensive logs of all test execution
  - Detailed results for each API test
  - Breakdowns of pricing calculations
  - Identification of pricing patterns and discounts

If no scenarios appear in a category, this is valuable information about your property:
- No blocked dates means all dates appear to be available
- No minimum stay requirements means any length of stay is allowed
- No guest count variation means pricing is the same regardless of party size
- No date range pricing variations means no special weekend or length-of-stay pricing

## Test Scenarios

### 1. Booking with Blocked Middle Date

**Objective**: Verify that bookings with unavailable dates in the middle are properly rejected.

**Steps**:
1. Navigate to a property page (e.g., `/properties/prahova-mountain-chalet`)
2. Open the booking date picker
3. Find dates with unavailable dates visible in the calendar (marked with strikethrough)
4. Select a check-in date before the unavailable date
5. Select a check-out date after the unavailable date
6. Observe the system's response

**Expected Results**:
- The booking form should show an error message about unavailable dates
- The calendar should clearly mark unavailable dates
- The "Book Now" button should be disabled or the form should prevent submission

### 2. Booking with Blocked Checkout Date

**Objective**: Verify that bookings where only the checkout date is blocked are allowed.

**Steps**:
1. Navigate to a property page
2. Open the booking date picker
3. Find a sequence where available dates are followed by an unavailable date
4. Select a check-in date from the available dates
5. Select the unavailable date as the check-out date
6. Observe the system's response

**Expected Results**:
- The booking should be allowed to proceed
- The price calculation should be correct (only counting nights up to but not including checkout)
- No error messages about unavailable dates should appear

### 3. Minimum Stay Requirements

**Objective**: Verify that minimum stay requirements are enforced and communicated to users.

**Steps**:
1. Navigate to a property page
2. Open the booking date picker
3. Hover over or select dates to see if minimum stay information is displayed
4. Try to book a stay shorter than the minimum requirement
5. Try to book a stay that meets the minimum requirement
6. Observe the system's response in both cases

**Expected Results**:
- Calendar should indicate minimum stay requirements visually or via tooltip
- Attempt to book shorter stays should be rejected with clear error message
- Stays meeting minimum requirement should be allowed
- Error message should state the specific minimum stay requirement

### 4. Guest Count Impact on Pricing

**Objective**: Verify that changing guest count correctly updates pricing when occupancy-based pricing is configured.

**Steps**:
1. Navigate to a property page
2. Select valid date range (e.g., 5 nights)
3. Note the initial price shown
4. Increment guest count to test different occupancy levels:
   - Base occupancy
   - Above base occupancy
   - Maximum occupancy
5. Observe price changes at each step

**Expected Results**:
- Price should update immediately when guest count changes
- For properties with occupancy pricing, higher guest counts should increase the price
- Price breakdown should show any additional guest fees separately
- UI should prevent selecting more than the maximum allowed guests

### 5. Dynamic Pricing Elements

**Objective**: Verify that weekend pricing, seasonal adjustments, and other pricing factors are correctly displayed.

**Steps**:
1. Navigate to a property page
2. Select a date range that includes both weekdays and weekend days
3. View the booking summary or price breakdown
4. Change the date range to span different seasons or special dates
5. Observe the price differences

**Expected Results**:
- Weekend days should show higher rates than weekdays
- Seasonal adjustments should be reflected in the daily rates
- Special dates (holidays, events) should show appropriate pricing
- Price breakdown should be clear and accurate

## Test Reporting

For each test, document:

1. **Test Case ID** (e.g., "UI-1: Blocked Middle Date")
2. **Date and Time** of testing
3. **Browser** and device used
4. **Test Results** with screenshots
5. **Issues Found** if any
6. **Notes** on user experience

### Example Test Report Format

```
# Test Report: UI Pricing and Availability

## Test Case: UI-1 Booking with Blocked Middle Date
Date: 2025-05-13
Tester: [Name]
Browser: Chrome 120
Device: Desktop

## Steps Performed:
1. Navigated to /properties/prahova-mountain-chalet
2. Selected May 20, 2025 as check-in
3. Selected May 25, 2025 as check-out (with May 22 unavailable)

## Results:
- ✅ Calendar correctly displayed May 22 as unavailable
- ✅ Error message displayed: "Your selected dates include unavailable dates"
- ✅ Booking button was disabled

## Screenshots:
[Attach screenshots showing the error state]

## Notes:
The error message could be more specific by naming the exact dates that are unavailable.
```

## Common UI Issues to Watch For

1. **Calendar Synchronization**: Ensure calendar properly marks unavailable dates immediately on load
2. **Error Message Clarity**: Check that error messages are descriptive and helpful
3. **Loading States**: Verify appropriate loading states while pricing information is being fetched
4. **Mobile Responsiveness**: Test the booking form on mobile devices
5. **Date Selection Flow**: Ensure the date selection process is intuitive
6. **Price Update Speed**: Price updates should happen promptly after date or guest count changes

## Test Data Management

### Creating Test Scenarios

To create specific test scenarios for UI testing:

1. **Blocked Dates**: Add specific blocked dates to property data:
   ```json
   // In the property JSON file
   "unavailableDates": ["2025-05-22", "2025-05-23"]
   ```

2. **Minimum Stay Requirements**: Configure minimum stays in seasonal pricing:
   ```json
   // In a seasonal pricing file
   "minimumStay": 3
   ```

3. **Occupancy Pricing**: Configure different prices for guest counts:
   ```json
   // In property configuration
   "occupancyPricing": {
     "enabled": true,
     "baseOccupancy": 4,
     "extraGuestFeePerNight": 25
   }
   ```

After updating test data, regenerate price calendars with `npm run generate-price-calendars` to reflect changes in the UI.

## Testing Tools for Automation

Consider using these tools for automated UI testing:

1. **Cypress**: For end-to-end testing of booking flows
2. **Playwright**: For cross-browser testing of pricing scenarios
3. **Jest with React Testing Library**: For component-level testing of booking widgets

An example Cypress test for checking unavailable date handling:

```javascript
describe('Booking Calendar Unavailable Dates', () => {
  it('should prevent booking when unavailable date is in range', () => {
    // Visit property page
    cy.visit('/properties/prahova-mountain-chalet');
    
    // Open calendar
    cy.get('[data-testid="date-picker-button"]').click();
    
    // Select check-in date
    cy.get('[data-date="2025-05-20"]').click();
    
    // Select check-out date after unavailable date
    cy.get('[data-date="2025-05-25"]').click();
    
    // Verify error message displayed
    cy.get('[data-testid="availability-error"]')
      .should('be.visible')
      .and('contain.text', 'unavailable dates');
    
    // Verify booking button is disabled
    cy.get('[data-testid="book-now-button"]').should('be.disabled');
  });
});
```

## Advanced Testing with Browser Scripts

For more advanced testing needs, several browser scripts are available:

1. `scripts/browser-test-api.js` (Recommended):
   - Uses the API directly to find real test scenarios
   - Works reliably across different browsers
   - Creates only tests based on actual property configuration
   - Enhanced visual interface with detailed test cards
   - Intelligent handling of consecutive blocked dates
   - Thorough minimum stay testing across multiple dates
   - Detailed logs of test execution and results

2. `scripts/browser-test-ui.js` (Alternative):
   - More UI-focused with predefined test scenarios
   - Less sophisticated but may be easier to understand
   - Doesn't automatically discover property-specific scenarios

3. `scripts/browser-test-simple.js` (Simplified):
   - Runs tests automatically without a UI panel
   - Logs results directly to the console
   - Good for quick sanity checks

### When to Use Each Test Approach

- **Browser Test Panel** (`browser-test-api.js`):
  - When you need to thoroughly test a specific property
  - After making changes to pricing logic or availability rules
  - When you want to verify different pricing and availability edge cases
  - For comprehensive testing of all features

- **Manual URL Testing**:
  - For quick verification of specific cases
  - When you have a specific date range in mind to test
  - For validating fixes to specific bugs with known parameters

## Best Practices for Testing Pricing and Availability

1. **Test Real Data**: 
   - Always use the browser test panel to find real test cases in your property data
   - The absence of certain tests (e.g., no min stay tests) tells you about your configuration

2. **Check Edge Cases**:
   - Test dates at the transition between seasons
   - Test bookings that span across price calendar boundaries
   - Test dates with multiple overlapping rules (e.g., weekend + seasonal pricing)
   - Verify consecutive blocked dates are handled correctly

3. **Key Test Scenarios to Verify**:
   - **Consecutive Blocked Dates**: Make sure consecutive unavailable dates are properly identified
   - **Minimum Stay Requirements**: Verify that stays shorter than minimum are rejected and those at or above are allowed
   - **Checkout on Blocked Date**: Confirm that a checkout date can be unavailable without affecting booking

4. **Verify Date Handling Convention**:
   - Remember that check-in dates are inclusive (part of the stay)
   - Check-out dates are exclusive (not part of the stay)
   - A booking from May 21 to May 29 includes the nights of May 21-28, not May 29

5. **Document Test Results**:
   - Keep notes of any issues found
   - Record screenshots of UI issues for later reference
   - Use the test panel logs to document test execution and results

## Conclusion

Testing pricing and availability thoroughly ensures that:
1. Guests see correct prices and availability
2. Error states and constraints are communicated clearly
3. Date selection and guest count changes work as expected
4. Pricing rules (weekend, seasonal, occupancy-based) are correctly applied
5. Minimum stay requirements are properly enforced

Regular testing after changes to the pricing system helps maintain a high-quality user experience and prevents pricing or availability errors from affecting real bookings.