# Form Position and Size Specifications

This document outlines the specific layout and styling specifications for each combination of form position and size. It serves as an implementation guide and reference for the booking form positioning system.

## Overview

We define specifications for:
- 3 schema positions: top, center, bottom
- 4 extended positions: top-left, top-right, bottom-left, bottom-right
- 2 sizes: compressed, large

Each combination has specific layout characteristics optimized for that context.

## Responsive Breakpoints

These specifications use the following breakpoints:
- **Mobile**: < 768px
- **Tablet**: 768px - 1023px
- **Desktop**: 1024px - 1279px
- **Large Desktop**: >= 1280px

## 1. Schema Positions

### A. Top Position

#### Top + Compressed Size

**Layout:**
- Form has reduced width
  - Mobile: max-width: 420px
  - Desktop: max-width: 480px
- Minimal margin from the top (just enough to clear the header)
  - Calculate: `headerHeight + 16px` (minimum)
- Vertical (stacked) layout on all screen sizes
- Full-width date picker input
- Button below date picker

**Styling:**
- Background: `bg-background/80` (semi-transparent)
- Backdrop blur: `backdrop-blur-sm`
- Text centered within form elements
- Standard border radius: `rounded-xl`
- Moderate shadow: `shadow-md`

**Behavior:**
- Fade in after positioning
- Slight scale transition on load

#### Top + Large Size

**Layout:**
- Wider form
  - Mobile: max-width: 480px
  - Desktop: max-width: 540px
- Same minimal top margin as compressed
- Mobile: Stacked layout (date picker above button)
- Desktop (≥768px): Horizontal layout (date picker beside button)
- More generous padding (p-6 md:p-8)

**Styling:**
- Slightly greater shadow: `shadow-lg`
- More padding and spacing between elements
- Button has slightly larger text

**Behavior:**
- Same as compressed plus
- Smooth layout transition between breakpoints

### B. Center Position

#### Center + Compressed Size

**Layout:**
- Moderate width
  - Mobile: max-width: 400px
  - Desktop: max-width: 460px
- Vertically and horizontally centered in hero section
- Stacked vertical layout on all screens
- Concise elements to minimize vertical space

**Styling:**
- Semi-transparent background: `bg-background/80`
- Enhanced shadow for visibility: `shadow-lg`
- Backdrop blur effect: `backdrop-blur-sm`
- Standard padding: `p-4 sm:p-6 md:p-8`

**Behavior:**
- Slightly enhanced entrance animation
- Appears after title is positioned

#### Center + Large Size

**Layout:**
- Wider form
  - Mobile: max-width: 460px
  - Desktop: max-width: 520px
- Centered position with balanced margins
- Mobile: Stacked layout
- Desktop (≥768px): Horizontal layout (date picker beside button)
- More generous spacing between elements

**Styling:**
- Same as compressed with
- Stronger visual emphasis
- Slightly bolder text elements
- Enhanced shadow: `shadow-xl`

**Behavior:**
- Same as compressed

### C. Bottom Position (Default)

#### Bottom + Compressed Size

**Layout:**
- Standard width
  - Mobile: max-width: 440px
  - Desktop: max-width: 500px
- Positioned near bottom of hero
- Calculate margin from top: ~60-70% of visible area
- Stacked layout on all screen sizes
- Sufficient bottom margin (avoid footer overlap)

**Styling:**
- Clean, minimal design
- Standard shadow: `shadow-md`
- Subtle hover effect on button

**Behavior:**
- Standard fade-in entrance
- Should appear visually balanced in hero

#### Bottom + Large Size

**Layout:**
- Widest layout
  - Mobile: max-width: 500px
  - Tablet: max-width: 520px
  - Desktop: max-width: 560px
- Premium placement at bottom
- Mobile: Stacked layout
- Desktop (≥768px): Horizontal layout
- Enhanced spacing between elements

**Styling:**
- Larger text elements
- More padding: `p-5 sm:p-6 md:p-8 lg:p-10`
- Premium shadow effect: `shadow-lg`
- Higher contrast button

**Behavior:**
- Same as compressed
- With smoother transitions between states

## 2. Extended Positions

### D. Corner Positions

#### Corner + Compressed Size

*Applies to: top-left, top-right, bottom-left, bottom-right*

**Layout:**
- Narrowest width
  - Mobile: max-width: 320px
  - Desktop: max-width: 360px
- Aligned to respective corner with appropriate margins
  - Top positions: `headerHeight + 16px` from top
  - Bottom positions: ~24px from bottom
  - Left positions: ~24px from left
  - Right positions: ~24px from right
- Vertical stacking only (never horizontal)
- Compact elements to fit smaller width

**Styling:**
- Enhanced contrast background: `bg-background/85`
- Stronger shadow for separation: `shadow-lg`
- Sharper corners on the side away from the edge
- Reduced padding: `p-4 sm:p-5 md:p-6`

**Behavior:**
- Entrance animation from nearest corner
- Should respect safe areas on mobile

#### Corner + Large Size

**Layout:**
- Still narrower than center/top/bottom
  - Mobile: max-width: 360px
  - Desktop: max-width: 400px
- Same positioning as compressed
- Maintains vertical stacking always
- More generous internal spacing

**Styling:**
- Enhanced visibility with stronger shadows
- More padding than compressed: `p-5 sm:p-6 md:p-7`
- Higher contrast elements for visibility
- Button gets full width

**Behavior:**
- Same as compressed

## 3. Implementation Details

### CSS Classes

Define reusable classes for common patterns:

```css
/* Form width utilities */
.form-width-xs { max-width: 320px; }
.form-width-sm { max-width: 360px; }
.form-width-md { max-width: 420px; }
.form-width-lg { max-width: 480px; }
.form-width-xl { max-width: 540px; }
```

### JavaScript Positioning

Position-based margin calculations:

```javascript
// Top positions need minimal margin
if (positionAttribute.includes('top')) {
  return Math.max(16, availableSpace * 0.05);
}

// Center positions need balanced margin
if (positionAttribute === 'center') {
  return availableSpace * 0.5 - (titleHeight + formHeight) * 0.5;
}

// Bottom positions need larger margin
return Math.max(24, availableSpace * 0.6);
```

### Layout Logic

Position-based layout decisions:

```javascript
// Only allow horizontal layout for specific positions and sizes
const useHorizontalLayout = 
  !position.includes('left') && 
  !position.includes('right') && 
  size === 'large' && 
  window.innerWidth >= 768;
```

## 4. Implementation Architecture

The form position and size specifications above have been implemented using a modular handler-based architecture for better organization and maintainability.

### Position Handler Pattern

Each position+size combination is implemented as a dedicated handler function:

```typescript
// Position style handlers dictionary
const positionStyleHandlers = {
  'bottom-compressed': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile, isTablet, isDesktop } = params;
    
    // Apply position-specific styling according to specifications
    // ...
    
    return formWrapperElement;
  },
  
  'bottom-large': (formWrapperElement: HTMLElement, params: any) => {
    // Different handler for bottom-large
    // ...
  },
  
  // Other position+size handlers...
};
```

### Handler Selection Process

The system dynamically selects the appropriate handler based on the form position and size:

```typescript
// Get the handler key for this position+size combination
const handlerKey = `${positionAttribute}-${sizeAttribute}`;

// Create parameters object with all necessary context
const handlerParams = {
  isMobile, isTablet, isDesktop, isLargeDesktop,
  viewportHeight, viewportWidth, headerHeight, 
  heroHeight, titleHeight, formHeight, availableSpace
};

// Apply styling based on the position+size combination
if (handlerKey in positionStyleHandlers) {
  // Use the specific handler
  positionStyleHandlers[handlerKey](formWrapperElement, handlerParams);
} else {
  // Use fallback handlers if specific one not found
  // ...
}
```

### Special Case: Bottom-Large Horizontal Layout

The bottom position with large size has a special horizontal layout handler that applies additional styling:

```typescript
const applyHorizontalLayout = (positionAttribute, sizeAttribute, formElement) => {
  if (positionAttribute === 'bottom' && sizeAttribute === 'large' && !isMobile) {
    // Apply specialized horizontal layout
    // - Force flex row layout
    // - Adjust child elements spacing
    // - Handle form price, date picker and button alignment
  }
};

// Apply horizontal layout as needed
applyHorizontalLayout(positionAttribute, sizeAttribute, formWrapperElement);
```

### Implementation Steps

1. ✅ Create position handler functions for all position+size combinations
2. ✅ Implement vertical margin calculations based on position type
3. ✅ Develop the handler selection mechanism with fallbacks
4. ✅ Build dedicated horizontal layout handling for bottom-large
5. ✅ Apply transitions and responsive adjustments
6. ✅ Test all combinations with the debug tool

## 5. Testing Matrix

| Position   | Size        | Mobile | Tablet | Desktop | Large Desktop |
|------------|-------------|--------|--------|---------|---------------|
| top        | compressed  | ✓      | ✓      | ✓       | ✓             |
| top        | large       | ✓      | ✓      | ✓       | ✓             |
| center     | compressed  | ✓      | ✓      | ✓       | ✓             |
| center     | large       | ✓      | ✓      | ✓       | ✓             |
| bottom     | compressed  | ✓      | ✓      | ✓       | ✓             |
| bottom     | large       | ✓      | ✓      | ✓       | ✓             |
| top-left   | compressed  | ✓      | ✓      | ✓       | ✓             |
| top-left   | large       | ✓      | ✓      | ✓       | ✓             |
| top-right  | compressed  | ✓      | ✓      | ✓       | ✓             |
| top-right  | large       | ✓      | ✓      | ✓       | ✓             |
| bottom-left| compressed  | ✓      | ✓      | ✓       | ✓             |
| bottom-left| large       | ✓      | ✓      | ✓       | ✓             |
| bottom-right| compressed | ✓      | ✓      | ✓       | ✓             |
| bottom-right| large      | ✓      | ✓      | ✓       | ✓             |

## Notes

- These specifications serve as initial guidelines and may be adjusted based on testing and user feedback
- Pixel values are approximate and should be confirmed with responsive testing
- Specific sizes may need adjustment for visual harmony on different screen sizes
- The implementation should prioritize schema positions over extended positions