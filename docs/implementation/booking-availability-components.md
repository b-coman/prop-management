# Booking Availability Components - Technical Details

This document describes the technical implementation details of the availability checking components in the booking system, focusing on the data flow and order of operations.

## Component Architecture

The booking availability system consists of these main components:

1. `AvailabilityCheck` - The original component (legacy)
2. `EnhancedAvailabilityChecker` - The improved, refactored component
3. `AvailabilityCalendar` - The calendar display showing unavailable dates
4. `SimpleDateSelector` - Date picker with unavailable dates support
5. `CustomDateRangePicker` - Enhanced date range picker

These components work together to:
- Load unavailable dates from the API
- Display these dates in the calendar
- Allow users to select dates
- Check if selected dates are available for booking

## Order of Operations

The correct sequence for availability checking is:

1. **Component Mount**
   - Component mounts and initializes state
   - URL parameters are parsed for initial check-in/check-out dates
   - Immediately start loading unavailable dates from API

2. **Data Loading**
   - Show loading indicator while fetching data
   - Process fetched unavailable dates (normalize to midnight time)
   - Store unavailable dates in component state
   - Once data is loaded, proceed to display phase

3. **UI Display**
   - Render calendar with unavailable dates already marked
   - Apply proper styling (strikethrough) to unavailable dates
   - Show date selectors with pre-loaded unavailability information

4. **Automatic Checking**
   - If dates are provided in URL, automatically check availability
   - Use the pre-loaded unavailable dates to check availability without API call
   - Show result to user (available or not available)
   - Always allow manual re-checking via button

5. **User Interaction**
   - When user changes dates, reset availability status
   - If both dates are selected, auto-check again
   - Maintain unavailable dates in state throughout the session

## Critical Technical Details

### Unavailable Dates Handling

- Dates must be normalized to midnight for consistent comparison
- All dates should be processed as UTC or in the same timezone
- Date formatting should use a consistent format (yyyy-MM-dd)
- Validate all dates to ensure they are proper Date objects

### Circular Dependency Prevention

- The availability check function should be self-contained
- Don't include the check function itself in useEffect dependencies
- Use separate functions for different parts of the process
- When auto-checking, use timeouts to ensure state is updated

### Rendering Optimization

- Only render the calendar once unavailable dates are loaded
- Use memoization for date modifiers to prevent unnecessary re-renders
- Separate local state from context state to prevent update loops
- Apply `useMemo` and `useCallback` for performance-critical functions

## Example Data Flow

```
Mount → Load Dates → Process Dates → Display Calendar → Auto-Check → Show Result
```

This flow ensures that:
1. The calendar is never displayed without unavailable dates
2. Unavailable dates are properly styled
3. Availability is checked automatically when appropriate
4. The user gets immediate feedback about availability

## API Integration

The unavailable dates are fetched from:
```
/api/check-availability?propertySlug=${propertySlug}&months=${monthsToFetch}
```

This endpoint returns unavailable dates in ISO string format, which must be converted to Date objects for use in the components.

## Debugging Tips

- Check the network tab for API calls
- Look for specific log messages:
  - `[EnhancedAvailabilityChecker] Loading unavailable dates on mount`
  - `[EnhancedAvailabilityChecker] Loaded X unavailable dates`
  - `[EnhancedAvailabilityChecker] Auto-checking availability`
- Verify that unavailable dates are properly formatted and stored
- When checking availability, ensure the date comparison is done correctly

## Common Issues

1. **Calendar doesn't show unavailable dates**: 
   - Ensure dates are loaded before calendar is rendered
   - Check that dates are properly normalized

2. **Auto-check doesn't work**:
   - Verify that the effect dependencies are correctly set
   - Check for circular dependencies in the code

3. **Dates appear available when they shouldn't**:
   - Check date comparison logic (time zones, date formats)
   - Ensure the unavailable dates array contains valid Date objects

4. **Infinite re-rendering loops**:
   - Use refs to track previous values and prevent unnecessary updates
   - Add deep equality checks before updating state or context
   - Limit URL parameter processing to happen only once
   - Remove unnecessary dependencies from useEffect dependency arrays
   - When working with dates, compare timestamps, not object references

## Future Improvements

- Consider caching unavailable dates for better performance
- Implement date ranges for unavailability instead of individual dates
- Add visual indicators for partially available date ranges