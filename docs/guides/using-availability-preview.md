# Using the Availability Preview Feature

The Availability Preview feature allows users to check availability for multiple date ranges without modifying their current selection. This is particularly useful when planning trips or comparing different booking options.

## Feature Overview

The Availability Preview functionality provides:

1. A popup dialog that shows the property's availability calendar
2. The ability to check the availability of any date range
3. A way to save multiple date ranges for comparison
4. Visual indicators showing which dates are available or unavailable

## How to Use

### Opening the Preview

To access the Availability Preview feature:

1. On any property page, look for the booking widget
2. Click the "Check More Dates" button located above the date picker
3. This will open a dialog window with the Availability Preview

### Checking Date Availability

Once the preview dialog is open:

1. Use the built-in calendar to select a date range (check-in and check-out dates)
2. The system will automatically check if those dates are available
3. Visual indicators will show available dates in green and unavailable dates in red

### Saving Date Ranges for Comparison

The preview feature allows you to save multiple date ranges for comparison:

1. After selecting a date range, click the "Save This Date Range" button
2. Click the "Saved Ranges" tab to view all your saved date ranges
3. Each saved range will show its availability status and duration
4. You can remove individual ranges or clear all saved ranges

### Refreshing Availability Data

To get the most up-to-date availability information:

1. Click the "Refresh Availability" button at the bottom of the dialog
2. This will fetch the latest data from the server
3. All saved ranges will be rechecked with the fresh data

## Implementation Details

The Availability Preview feature leverages the existing availability checking infrastructure with the following additions:

- A modal dialog that can be opened without affecting the main booking flow
- A tab system to organize the date selection and saved ranges
- State management to track multiple date ranges
- Efficient use of cached availability data when possible

## Testing the Feature

To test the Availability Preview feature:

1. Load a property page in your browser
2. Open the browser console (F12 or right-click > Inspect > Console)
3. Load the test script by pasting the following code:
   ```javascript
   const script = document.createElement('script');
   script.src = '/scripts/test-availability-preview.js';
   document.body.appendChild(script);
   ```
4. Use the test panel that appears in the lower right corner to run automated tests
5. Alternatively, call the test functions directly from the console:
   - `window.testOpenPreviewDialog()` - Test opening the preview dialog
   - `window.testSelectDatesInPreview()` - Test selecting dates in the preview
   - `window.testSavedRangesTab()` - Test the saved ranges tab
   - `window.testAvailabilityPreviewFeature()` - Run all tests in sequence

## Troubleshooting

### Preview Dialog Won't Open

If the preview dialog doesn't appear when clicking the "Check More Dates" button:

1. Check the browser console for any JavaScript errors
2. Verify that the property has a valid slug and availability data
3. Try refreshing the page and clicking the button again

### Dates Not Showing as Available or Unavailable

If dates aren't correctly showing their availability status:

1. Click the "Refresh Availability" button to fetch the latest data
2. Check if the property has recent updates to its availability calendar
3. Verify that you've selected a valid date range (check-in before check-out)

### Saved Ranges Not Updating

If saved date ranges aren't updating when refreshing availability:

1. Make sure the property's availability data is being properly loaded
2. Check for any errors in the browser console
3. Try clearing all saved ranges and adding them again