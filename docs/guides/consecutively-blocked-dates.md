# Handling Consecutive Blocked Dates

## Problem Overview

When multiple days in a row are blocked in the calendar, the booking system needs to handle these consecutive blocked dates carefully, particularly when it comes to checkout dates.

The key issue we discovered was:

**When two or more dates are consecutively blocked (e.g., May 13-14, 2025), the test script was incorrectly creating "Blocked Checkout" tests for these dates.**

This leads to confusion because:

1. If May 13 and May 14, 2025 are both blocked, the system should reject a booking with:
   - Check-in: May 12
   - Check-out: May 14 

2. However, the test script was creating tests that expected this to be allowed, which is incorrect.

## Proper Checkout Date Behavior

The correct behavior for checkout dates is:

1. A guest **should** be allowed to check out on a blocked date IF (and only if) the night before is available.
2. A guest **should not** be allowed to check out on a blocked date if the night before is also blocked.

## The Root Cause

The issue was in the date detection logic in our test script. When we were looking for dates to create "Blocked Checkout" tests, we were not properly checking if the date was part of a consecutive block of unavailable dates.

Here's the specific issue in the test script:

```javascript
// We weren't properly checking if the date was part of a consecutive block when
// creating checkout tests. The code would allow checkout tests for any blocked date
// as long as the night before was available, without considering longer patterns.
```

## The Solution

We've implemented a comprehensive fix:

1. **Better Consecutive Block Detection**: We now identify and track all consecutive blocks of unavailable dates.

2. **Set-Based Filtering**: We use a Set data structure to quickly check if a date is part of a consecutive block.

3. **Explicit Checkout Test Criteria**: We now explicitly check three conditions before creating a checkout test:
   - The checkout date must be blocked
   - The night before checkout must be available
   - The checkout date must NOT be part of any consecutive block of unavailable dates

4. **Additional Logging**: We've added detailed logging to help debug these issues in the future.

5. **Specialized Testing Tool**: We've created a dedicated testing tool specifically for analyzing and testing consecutive blocked date patterns.

## Using the Consecutive Blocked Dates Test Tool

We've added a specialized test tool to help analyze and test consecutive blocked date patterns:

1. Go to the Admin Panel > Pricing Management > Select a property
2. Click on the "Testing" tab
3. Select the "Consecutive Dates" tab
4. Click "Run Analyzer"

This tool will:
- Identify all consecutive blocks of unavailable dates
- Create checkout tests only for isolated blocked dates (not part of consecutive blocks)
- Allow you to test both through the API and the UI

Alternatively, you can access this tool by adding `?test-mode=consec-dates` to any booking page URL.

## Example Scenarios

### Scenario 1: Isolated Blocked Date

If May 20, 2025 is blocked, but May 19 is available:
- A booking with check-in on May 18 and check-out on May 20 should be ALLOWED
- A booking with check-in on May 20 and check-out on May 22 should be REJECTED
- A booking with check-in on May 18 and check-out on May 21 should be REJECTED (spans the blocked date)

### Scenario 2: Consecutive Blocked Dates

If May 13-14, 2025 are both blocked:
- A booking with check-in on May 12 and check-out on May 13 should be ALLOWED (checkout on first day of block)
- A booking with check-in on May 12 and check-out on May 14 should be REJECTED (checkout on second day of block which means spanning a blocked night)
- A booking with check-in on May 13 and check-out on May 15 should be REJECTED (check-in on a blocked date)

## Technical Implementation Details

The implementation includes:

1. Enhanced logic in the test script to correctly identify consecutive blocks of unavailable dates.
2. Improved checkout test generation to respect these consecutive block patterns.
3. Added a specialized test tool for debugging these specific patterns.
4. More detailed logging to help diagnose future issues.

## Future Considerations

When working with blocked dates, always ensure to:

1. Check for consecutive patterns of blocked dates.
2. Consider the interaction between checkout dates and the preceding night.
3. Remember that a blocked checkout date is only problematic if the night before is also blocked.

By respecting these rules, we ensure that the booking system handles edge cases correctly and provides a seamless experience for users.