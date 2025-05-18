# Booking Form Positioning System

This document explains the booking form positioning system within the hero section of property pages.

## Overview

The booking form within the hero section can be positioned in different layouts based on configuration in Firestore. This allows for customizable layouts per property without code changes.

## Position Types

### Schema-Defined Positions

These positions are defined in the Firestore schema (`overridesSchemas-multipage.ts`) and fully supported:

- **top**: Form appears at the top of the hero section
- **center**: Form appears in the center of the hero section
- **bottom**: Form appears at the bottom of the hero section (default)

### Extended Positions (Future Use)

These positions are implemented in the code but not yet in the schema:

- **top-left**: Form appears at the top-left corner
- **top-right**: Form appears at the top-right corner
- **bottom-left**: Form appears at the bottom-left corner
- **bottom-right**: Form appears at the bottom-right corner

## Size Options

The form supports two size options:

- **compressed**: Smaller, more compact form (default)
- **large**: Larger form with expanded layout

## Implementation Details

### 1. Data Flow

The position and size configuration flows through the system as follows:

1. **Data Source**: Stored in Firestore in the `websiteTemplate` collection
   ```json
   {
     "hero": {
       "bookingForm": {
         "position": "bottom",
         "size": "large"
       }
     }
   }
   ```

2. **Server-side**: The data is loaded and merged between defaults and overrides in `property-page-layout.tsx`

3. **Component Props**: Passed to the HeroSection component as `bookingForm` prop

4. **DOM Attributes**: Set as data attributes on the hero section:
   ```html
   <section data-form-position="bottom" data-form-size="large">
   ```

5. **JavaScript Positioning**: Read by `hero-helper.ts` to apply dynamic positioning

### 2. Positioning Logic

The form position is controlled by two mechanisms:

1. **CSS Classes**: For basic layout (flex positioning)
   ```typescript
   const formPositionClasses = {
     center: 'items-center justify-center',
     top: 'items-start justify-center',
     bottom: 'items-end justify-center',
     // etc.
   };
   ```

2. **JavaScript Adjustments**: For precise control with the transparent header
   ```typescript
   // Position-based calculations
   switch (positionAttribute) {
     case 'top':
       // Top position - minimal margin
       responsiveMargin = Math.max(16, availableSpace * 0.05);
       break;
     // etc.
   }
   ```

### 3. Responsive Adjustments

The form position and size adapt based on screen size:

- **Width Adjustments**: Based on position and viewport width
  ```typescript
  switch (positionAttribute) {
    case 'bottom':
      // Bottom position - wider on large screens
      (formWrapper as HTMLElement).style.maxWidth = viewportWidth >= 1280 ? '560px' : '480px';
      break;
    // etc.
  }
  ```

- **Margin Calculations**: Based on viewport height
  ```typescript
  if (viewportHeight < 600) {
    responsiveMargin = Math.max(16, availableSpace * 0.18);
  } else if (viewportHeight < 900) {
    responsiveMargin = Math.max(24, availableSpace * 0.22);
  } else {
    responsiveMargin = Math.max(32, availableSpace * 0.25);
  }
  ```

### 4. Layout Adaptation

The form layout adapts based on its position:

```typescript
const formContainerClasses = cn(
  'space-y-4', // Default vertical spacing
  // In corner positions, prefer vertical stacking on all screens
  isCornerPosition() 
    ? 'flex flex-col items-stretch w-full'
    // For center/top/bottom positions, use horizontal layout on medium screens
    : size === 'large' && 'flex flex-col md:flex-row md:items-end md:space-y-0 md:space-x-2 w-full'
);
```

## Debugging and Testing

### Debug Tool

A visual debug tool is available to test different form positions and sizes without having to modify Firestore data:

1. Open the browser's JavaScript console
2. Run the following code:
   ```javascript
   const script = document.createElement('script'); 
   script.src = '/debug-form-position.js'; 
   document.head.appendChild(script);
   ```
3. Use the UI panel that appears to test different configurations

### Debug Tool Features

The debug panel includes:

1. **Schema Position Buttons**
   - Buttons for positions defined in the schema: 'top', 'bottom', 'center'
   - Blue highlighting for the active position
   - Changes take effect immediately without page reload

2. **Extended Position Buttons**
   - Buttons for extended positions: 'top-left', 'top-right', 'bottom-left', 'bottom-right'
   - Yellow highlighting for the active position
   - Visual indication that these are extended features

3. **Size Controls**
   - Toggle between 'compressed' and 'large' form sizes
   - Green highlighting for the active size
   - Size changes require page reload (prompted by the tool)

4. **Visual Feedback**
   - Active state highlighting for all buttons
   - Confirmation prompts for changes requiring reload
   - Console logging with detailed information

### Using the Debug Tool

1. **Testing Positions**
   - Click any position button to immediately update the form position
   - The form will reposition using the same logic as with Firestore data
   - All responsive behaviors remain intact

2. **Testing Sizes**
   - Click either 'compressed' or 'large' to change the form size
   - Confirm the reload prompt to see the size change

3. **Analyzing Results**
   - Check the console for logs about applied positions and calculations
   - Test on different screen sizes to ensure responsive behavior
   - Verify that the schema positions work flawlessly

### Debug Tool Location

The debug utility is stored at `/public/debug-form-position.js` and can be modified to add new test features or positions as needed.

## Key Files

- **`src/components/homepage/hero-section.tsx`**: Main component that accepts position config
- **`src/components/homepage/hero-helper.ts`**: JavaScript positioning system
- **`src/lib/overridesSchemas-multipage.ts`**: Schema definitions for positions
- **`src/components/booking/initial-booking-form.tsx`**: Form component with size awareness
- **`public/debug-form-position.js`**: Debug utility for testing positions

## Best Practices

1. **Stick to Schema Positions**: Use 'top', 'bottom', or 'center' in production
2. **Test Responsively**: Ensure positions work well across all screen sizes
3. **Mind the Header**: Form positioning accounts for the transparent header
4. **Check Form Size**: Different form sizes may work better with different positions

## Layout Specifications

For detailed specifications on how each combination of position and size should be rendered, see the [Form Position & Size Specifications](./form-position-size-specifications.md) document. This provides a comprehensive guide on layout, styling, and behavior for each position+size combination.

## Adding New Positions

To add new positions to the schema:

1. Update the schema in `src/lib/overridesSchemas-multipage.ts`:
   ```typescript
   bookingForm: z.object({
     position: z.enum(['top', 'bottom', 'center', 'top-left', 'top-right']), // Add new positions
     size: z.enum(['small', 'medium', 'large']),
   }).optional(),
   ```

2. Ensure the new positions are handled in `hero-helper.ts`

## Modular Architecture

The form positioning system has been refactored to use a modular approach that separates concerns and makes the code more maintainable. This is now the implemented approach rather than a proposal.

### Position Handler Pattern

The core of the new architecture is the position handler pattern:

```typescript
// Position style handlers - each function applies styles for a specific position+size combination
const positionStyleHandlers = {
  // BOTTOM POSITION STYLES
  'bottom-compressed': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile, isTablet, isDesktop } = params;
    
    // Set max width based on size and breakpoint
    if (isMobile) {
      formWrapperElement.style.maxWidth = '440px';
    } else if (isTablet) {
      formWrapperElement.style.maxWidth = '470px';
    } else if (isDesktop) {
      formWrapperElement.style.maxWidth = '500px';
    } else {
      formWrapperElement.style.maxWidth = '520px';
    }
    
    // Standard padding for compressed
    formWrapperElement.style.padding = isMobile ? '1rem' : '1.5rem';
    
    return formWrapperElement;
  },
  
  'bottom-large': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile, isTablet, isDesktop } = params;
    
    // Set max width based on size and breakpoint - wider for horizontal layout
    if (isMobile) {
      formWrapperElement.style.maxWidth = '480px';
    } else if (isTablet) {
      // Wider to accommodate horizontal layout with ALL form elements
      formWrapperElement.style.maxWidth = '850px';
    } else if (isDesktop) {
      // Even wider for more comfortable spacing
      formWrapperElement.style.maxWidth = '950px';
    } else {
      // Maximum width for large screens
      formWrapperElement.style.maxWidth = '1000px';
    }
    
    // Adjusted padding - less on the sides to maximize horizontal space
    formWrapperElement.style.padding = isMobile 
      ? '1.25rem' 
      : isTablet 
        ? '1.75rem 2.5rem' // More generous horizontal padding on tablet
        : '2rem 3rem'; // Generous padding on desktop for a premium feel
    
    return formWrapperElement;
  },
  
  // Additional handlers for other positions and sizes
  
  // Default handler as fallback
  'default': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile } = params;
    
    // Default max-width
    formWrapperElement.style.maxWidth = '480px';
    // Default padding
    formWrapperElement.style.padding = isMobile ? '1rem' : '1.5rem';
    // Default shadow
    formWrapperElement.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.15)';
    
    return formWrapperElement;
  }
};
```

### Handler Selection Logic

In the main positioning function, handlers are selected based on the position and size combination:

```typescript
// Get the handler key for this position+size combination
const handlerKey = `${positionAttribute}-${sizeAttribute}`;

// Create parameters object for the handler functions
const handlerParams = {
  isMobile,
  isTablet,
  isDesktop,
  isLargeDesktop,
  viewportHeight,
  viewportWidth,
  headerHeight,
  heroHeight,
  titleHeight,
  formHeight,
  availableSpace
};

// Apply styling based on the position+size combination
if (handlerKey in positionStyleHandlers) {
  // Use the specific handler for this position+size
  positionStyleHandlers[handlerKey](formWrapperElement, handlerParams);
  console.log(`[HeroHelper] Applied styling via handler for "${handlerKey}"`);
} else {
  // If specific handler not found, try to find a default for the position
  const positionHandler = `${positionAttribute}-default`;
  if (positionHandler in positionStyleHandlers) {
    positionStyleHandlers[positionHandler](formWrapperElement, handlerParams);
    console.log(`[HeroHelper] Applied default styling for position "${positionAttribute}"`);
  } else {
    // Fallback to the default handler
    positionStyleHandlers['default'](formWrapperElement, handlerParams);
    console.log(`[HeroHelper] Applied default styling (no specific handler for "${handlerKey}")`);
  }
}
```

### Special Horizontal Layout for Bottom-Large

The bottom position with large size uses a dedicated function to enforce horizontal layout:

```typescript
// Create a function to apply horizontal layout based on the position-size combination
const applyHorizontalLayout = (positionAttribute: string, sizeAttribute: string, formWrapperElement: HTMLElement) => {
  if (positionAttribute === 'bottom' && sizeAttribute === 'large' && !isMobile) {
    console.log('[HeroHelper] Bottom position with large size detected - applying horizontal layout');
    
    // Apply horizontal layout after the component renders with direct styles
    setTimeout(() => {
      const formContainer = formWrapperElement.querySelector('.space-y-4');
      if (formContainer) {
        // Add classes
        formContainer.classList.add('md:flex', 'md:flex-row', 'md:items-center',
                                  'md:space-y-0', 'md:space-x-6', 'md:justify-between');
        
        // Also apply direct styles to force horizontal layout
        (formContainer as HTMLElement).style.display = 'flex';
        (formContainer as HTMLElement).style.flexDirection = 'row';
        (formContainer as HTMLElement).style.alignItems = 'center';
        (formContainer as HTMLElement).style.justifyContent = 'space-between';
        (formContainer as HTMLElement).style.gap = '1.5rem';
        
        // Apply styles to child elements for perfect alignment
        const datePickerContainer = formContainer.querySelector('div:first-child');
        const buttonContainer = formContainer.querySelector('div:last-child');
        
        if (datePickerContainer && buttonContainer) {
          (datePickerContainer as HTMLElement).style.marginBottom = '0';
          (datePickerContainer as HTMLElement).style.flexGrow = '1';
          (buttonContainer as HTMLElement).style.width = 'auto';
          (buttonContainer as HTMLElement).style.marginTop = '0';
        }
        
        console.log('[HeroHelper] Applied horizontal layout classes for bottom + large form');
      }
    }, 300);
  }
};

// Apply horizontal layout based on position and size
applyHorizontalLayout(positionAttribute, sizeAttribute, formWrapperElement);
```

### Benefits of the Implemented Modular Approach

1. **Separation of Concerns**: Each position+size combination has its own handler function, making the code more organized.
2. **Easier Maintenance**: Adding a new position or size is as simple as adding a new handler, without modifying the core logic.
3. **Better Debugging**: Issues with specific positions can be isolated to their handler, with detailed logging.
4. **Improved Readability**: The main function is cleaner with most styling logic moved to individual handlers.
5. **Scalability**: The system can easily grow to support many more position and size combinations without becoming unwieldy.
6. **Consistency**: Common patterns for styling are consistently applied across different position handlers.

### Full Implementation

The complete modular implementation is in `src/components/homepage/hero-helper.ts`. It includes:

1. A dictionary of position handler functions
2. Vertical margin calculations based on position type
3. Handler selection logic for styling based on position+size
4. Special case handling for horizontal layout in bottom-large
5. Style application with appropriate fallbacks