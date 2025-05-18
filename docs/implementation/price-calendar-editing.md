# Price Calendar Editing System

This document describes the approach used for editing price calendars in the RentalSpot-Builder admin interface.

## Overview

The price calendar editing system allows property managers to:

1. View pre-calculated pricing for future dates in a calendar format
2. Edit pricing details for individual days
3. See real-time updates without page refreshes
4. Maintain data integrity across different Firestore collections

## Architecture

The system uses a dual-update approach to provide both data integrity and excellent user experience:

### Data Flow

1. **Source of Truth: dateOverrides Collection**
   - All date-specific overrides are stored in the `dateOverrides` collection
   - Each override includes customPrice, available status, minimumStay, etc.
   - This collection is the authoritative record of all manual price adjustments

2. **Derived Data: priceCalendars Collection**
   - Contains pre-calculated daily prices for efficient lookups
   - Combines all pricing rules (base, seasonal, weekend, overrides)
   - Used for performance optimization in the booking flow

3. **UI State: React Component State**
   - Local component state for immediate visual feedback
   - Updates synchronously with user actions
   - Prevents unnecessary page reloads

### Update Process

When a user edits a day's pricing, the following occurs:

1. **Server-Side**:
   - The override is saved to the `dateOverrides` collection
   - The corresponding day in the `priceCalendars` collection is directly updated
   - Both operations occur within the same server action for consistency

2. **Client-Side**:
   - The local React state is updated to reflect the changes
   - UI updates immediately without waiting for server response
   - Toast notifications provide feedback on the operation

## Implementation Details

### Server-Side Implementation

The `updateDay` function in `server-actions-hybrid.ts` handles the dual update:

```typescript
export async function updateDay(dayData: any) {
  try {
    // 1. Update or create the date override (source of truth)
    let overrideId = dayData.id;
    if (overrideId) {
      // Update existing override
      const overrideRef = doc(db, 'dateOverrides', overrideId);
      await updateDoc(overrideRef, {
        customPrice: dayData.customPrice,
        available: dayData.available,
        minimumStay: dayData.minimumStay,
        reason: dayData.reason,
        updatedAt: new Date().toISOString()
      });
    } else {
      // Create new override
      const docRef = await addDoc(collection(db, 'dateOverrides'), {
        propertyId: dayData.propertyId,
        date: dayData.date,
        customPrice: dayData.customPrice,
        available: dayData.available,
        minimumStay: dayData.minimumStay,
        reason: dayData.reason,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      overrideId = docRef.id;
    }

    // 2. Update the price calendar (for performance optimization)
    const [year, month, day] = dayData.date.split('-').map(part => parseInt(part, 10));
    const calendarId = `${dayData.propertyId}_${year}-${month.toString().padStart(2, '0')}`;
    
    try {
      const calendarRef = doc(db, 'priceCalendars', calendarId);
      const calendarDoc = await getDoc(calendarRef);
      
      if (calendarDoc.exists()) {
        // Update the specific day in the calendar
        await updateDoc(calendarRef, {
          [`days.${day}.adjustedPrice`]: dayData.customPrice,
          [`days.${day}.available`]: dayData.available,
          [`days.${day}.minimumStay`]: dayData.minimumStay,
          [`days.${day}.reason`]: dayData.reason,
          [`days.${day}.priceSource`]: 'override',
          [`days.${day}.overrideId`]: overrideId,
          // Also update prices for different guest counts
          ...(calendarDoc.data().days[day]?.prices ? {
            [`days.${day}.prices`]: Object.keys(calendarDoc.data().days[day].prices).reduce((acc, guestCount) => {
              acc[guestCount] = dayData.customPrice;
              return acc;
            }, {})
          } : {})
        });
      }
    } catch (calendarError) {
      // Don't fail the entire operation if calendar update fails
      console.error(`[Server] Error updating price calendar:`, calendarError);
    }

    // 3. Revalidate paths for server components
    revalidatePath('/admin/pricing');
    revalidatePath(`/admin/pricing?propertyId=${dayData.propertyId}`);

    return { success: true };
  } catch (error) {
    console.error(`[Server] Error updating day:`, error);
    return { success: false, error: `Failed to update day: ${error}` };
  }
}
```

### Client-Side Implementation

The `PriceCalendarDisplay` component in `price-calendar-display.tsx` handles the client-side update:

```typescript
// State to track calendars
const [calendars, setCalendars] = useState<any[]>(initialCalendars);

// Handle updating a day
const handleUpdateDay = async (dayData: any) => {
  try {
    const result = await updateDay(dayData);

    if (result.success) {
      toast({
        title: "Day updated",
        description: `The changes for ${dayData.date} have been saved.`,
      });

      // Update the local calendar data
      if (selectedCalendar) {
        // Extract day number from the date
        const dayNumber = parseInt(dayData.date.split('-')[2], 10).toString();
        
        // Create a deep copy of the selected calendar
        const updatedCalendar = JSON.parse(JSON.stringify(selectedCalendar));
        
        // Update the specific day in our local data
        if (updatedCalendar.days[dayNumber]) {
          // Update the day's properties
          updatedCalendar.days[dayNumber] = {
            ...updatedCalendar.days[dayNumber],
            adjustedPrice: dayData.customPrice,
            available: dayData.available,
            minimumStay: dayData.minimumStay,
            reason: dayData.reason || updatedCalendar.days[dayNumber].reason,
            priceSource: 'override',
            overrideId: dayData.id
          };
          
          // Update the prices for different guest counts
          if (updatedCalendar.days[dayNumber].prices) {
            for (const guestCount in updatedCalendar.days[dayNumber].prices) {
              updatedCalendar.days[dayNumber].prices[guestCount] = dayData.customPrice;
            }
          }
          
          // Update the state to trigger a re-render
          const updatedCalendars = calendars.map(cal =>
            cal.id === selectedCalendarId ? updatedCalendar : cal
          );
          
          // Update the state with the modified calendar
          setCalendars(updatedCalendars);
        }
      }

      // Close the dialog
      setIsEditDialogOpen(false);
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to update day",
        variant: "destructive"
      });
    }
  } catch (error) {
    console.error('Error updating day:', error);
    toast({
      title: "Error",
      description: "An unexpected error occurred",
      variant: "destructive"
    });
  }
};
```

## Day Editing Dialog

The `EditDayDialog` component provides the UI for editing individual days:

- **Component**: `edit-day-dialog.tsx`
- **Features**:
  - Form fields for custom price, availability, minimum stay, and reason
  - Input validation for proper values
  - Clean date formatting for display
  - Proper handling of numeric values for accurate price calculations

## Security Considerations

The system uses Firebase security rules to ensure that only authorized users can update pricing information:

```js
// Date Overrides Collection
match /dateOverrides/{overrideId} {
  allow read: if true; // Public read for price calculations
  allow write: if isSignedIn() && 
              (isOwner(extractPropertyId(overrideId)) || isAdmin());
}

// Price Calendars Collection
match /priceCalendars/{calendarId} {
  allow read: if true; // Public read for price lookups
  allow write: if isSignedIn() && 
              (isOwner(extractPropertyId(calendarId)) || isAdmin());
}
```

## Benefits

This dual-update approach offers several benefits:

1. **Data Integrity**: The source of truth (`dateOverrides`) is maintained independently
2. **Performance**: Direct calendar updates avoid regenerating entire price calendars
3. **User Experience**: Immediate UI updates without page reloads or waiting for server responses
4. **Fault Tolerance**: Even if price calendar updates fail, the source of truth is preserved
5. **Scalability**: The approach scales well with increased calendar data

## Future Improvements

Potential improvements to the system include:

1. **Batch Editing**: Allow editing multiple days at once
2. **Drag Selection**: Implement drag-to-select date ranges
3. **Undo/Redo**: Add history tracking for price changes
4. **Conflict Resolution**: Improve handling of concurrent edits
5. **Optimistic Updates**: Further enhance UI responsiveness
6. **Background Sync**: Add background syncing for unsaved changes

## Conclusion

The dual-update approach for price calendar editing provides a good balance between data integrity, performance, and user experience. By storing the authoritative data in the `dateOverrides` collection while directly updating the `priceCalendars` collection, we ensure both accurate data and excellent performance.