# Header Positioning System

## Overview

The header positioning system implements a modern fixed header with transparent overlay effects. This creates an immersive experience where content slides under the header, which becomes opaque when scrolled.

## Architecture

### CSS Structure

The system uses a layered approach with specific z-index values:

```css
/* Z-index layers */
Header: z-index 50 (top layer)
Main content: z-index 40
Hero background: z-index -10
Overlays: z-index -10
```

### Core Classes

1. **Fixed Header Positioning**
   ```css
   #site-header {
     z-index: 50;
   }
   ```

2. **Content Spacing**
   ```css
   #main-content {
     padding-top: 4rem; /* Space for fixed header */
   }
   ```

3. **Slide Under Effect**
   ```css
   .slides-under-header {
     margin-top: -4rem;
   }
   ```

## Components

### Header Component

- Fixed positioning: `fixed top-0 left-0 right-0 z-50`
- Height: 64px (4rem)
- Transparent initially, becomes opaque on scroll
- Transitions smoothly with `transition-all duration-300`

### Hero Section

- Uses `.has-transparent-header` and `.slides-under-header` classes
- Heights: 70vh mobile / 80vh desktop
- Dynamic content positioning via `hero-helper.ts`
- Fade-in animations for smooth loading

### Page Header

- Similar structure to Hero but smaller (24vh mobile / 32vh desktop)
- Uses same `.slides-under-header` class
- Dynamic positioning via `page-header-helper.ts`
- Centered content within visible area

## Dynamic Positioning System

### Hero Helper (`hero-helper.ts`)

The hero helper provides sophisticated positioning:

1. **Initial Calculation**
   - Measures header height
   - Calculates available vertical space
   - Positions content accounting for header overlay

2. **Responsive Updates**
   - Monitors window resize
   - Handles font loading
   - Updates on booking form changes

3. **Position Handlers**
   - Different handlers for each position+size combination
   - Supports: center, top, bottom, corners
   - Special handling for horizontal layouts

### Page Header Helper (`page-header-helper.ts`)

Similar to hero helper but simpler:

1. **Vertical Centering**
   - Calculates visible area below header
   - Centers title/subtitle in available space
   - Adds appropriate margins

2. **Event Handling**
   - Window resize
   - Font loading
   - Element size changes

## Implementation Details

### 1. Header Structure

```jsx
<Header 
  className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
  // Becomes opaque when scrolled
/>
```

### 2. Hero Section

```jsx
<section 
  className="... has-transparent-header slides-under-header"
  style={{ position: 'relative', overflow: 'visible' }}
>
  {/* Content positioned dynamically */}
</section>
```

### 3. Page Header

```jsx
<section 
  className="... has-transparent-header slides-under-header page-header"
>
  {/* Content with dynamic vertical centering */}
</section>
```

## Usage Guidelines

### Adding Slide-Under Behavior

To make any element slide under the header:

```jsx
<div className="slides-under-header">
  {/* Your content */}
</div>
```

### Creating New Components with Header Overlay

1. Add necessary classes:
   ```jsx
   className="has-transparent-header slides-under-header"
   ```

2. Implement dynamic positioning if needed:
   ```jsx
   useEffect(() => {
     const cleanup = setupYourPositioning();
     return cleanup;
   }, []);
   ```

3. Add fade-in for smooth loading:
   ```jsx
   <div className="opacity-0 transition-opacity" ref={(el) => {
     if (el) setTimeout(() => el.classList.remove('opacity-0'), 350);
   }}>
   ```

## Debugging

### Common Issues

1. **Content not sliding under header**
   - Check if `.slides-under-header` class is applied
   - Verify element is first child of `#main-content`

2. **Positioning jumps**
   - Ensure initial opacity is 0
   - Add transition delays
   - Check dynamic positioning calculations

3. **Z-index conflicts**
   - Follow established layer hierarchy
   - Use proper negative z-index for backgrounds

### Debug Tools

The system includes extensive debugging capabilities:

```javascript
// In hero-helper.ts
console.log('[Hero Positioning] Calculated values:', {
  headerHeight,
  availableSpace,
  contentHeight,
  computedMargin
});
```

## Best Practices

1. **Always use established classes** rather than custom margins
2. **Test on multiple viewports** - positioning is responsive
3. **Use fade-in animations** to hide positioning calculations
4. **Follow z-index hierarchy** to avoid layer conflicts
5. **Account for dynamic content** that might change height

## Migration Notes

When migrating from the old system:

1. Replace custom margin calculations with `.slides-under-header`
2. Update z-index values to match new hierarchy
3. Add dynamic positioning helpers where needed
4. Test header overlay behavior thoroughly