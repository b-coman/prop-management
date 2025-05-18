# Multi-Page Website Architecture

This document describes the implementation of the multi-page structure for property websites.

## Overview

The multi-page architecture allows each property to have multiple pages instead of a single scrollable page. This provides a more traditional website experience with separate pages for different content types. The architecture supports:

1. Multiple page types (homepage, details, location, gallery, booking)
2. Customizable content blocks for each page
3. Dynamic navigation between pages
4. Control over which pages are visible
5. Custom URL paths for each page
6. Custom domain support with proper routing
7. Multilingual support with language-specific routes
8. Unified page handling through optional catch-all routes

## Route Structure (Updated)

As of May 2024, the routing has been consolidated into a single file using Next.js optional catch-all routes:

### File Structure
```
src/app/properties/[slug]/[[...path]]/page.tsx
```

This single file handles:
- `/properties/property-name` - Homepage
- `/properties/property-name/location` - Location page
- `/properties/property-name/gallery` - Gallery page
- `/properties/property-name/ro` - Romanian homepage
- `/properties/property-name/ro/location` - Romanian location page

### Route Pattern
The `[[...path]]` pattern is an optional catch-all route where:
- `[slug]` - The property identifier
- `[[...path]]` - Optional array of path segments (can be empty, single, or multiple segments)

### Language Support
The system automatically detects language from the URL path:
- First path segment is checked against supported languages (`en`, `ro`)
- If detected, language is extracted and remaining path determines the page
- Default language (`en`) is used when no language segment is present

## Data Structure

### Templates (`websiteTemplates` collection)

Each template now contains:

- `pages`: An object where keys are page names (e.g., "homepage", "details") and values are page objects
- Each page object contains:
  - `path`: The URL path for the page (e.g., "/", "/details")
  - `title`: The page title
  - `blocks`: An array of block references (id and type)
- `defaults`: Default content for all blocks referenced in any page
- `header`: Configuration for the header, including menu items
- `footer`: Configuration for the footer

Example:
```json
{
  "templateId": "holiday-house",
  "name": "Holiday House Template",
  "pages": {
    "homepage": {
      "path": "/",
      "title": "Welcome",
      "blocks": [
        { "id": "hero", "type": "hero" },
        { "id": "experience", "type": "experience" }
      ]
    },
    "details": {
      "path": "/details",
      "title": "Property Details",
      "blocks": [
        { "id": "details-header", "type": "pageHeader" },
        { "id": "amenities", "type": "amenitiesList" }
      ]
    }
  },
  "defaults": {
    "hero": { /* default content */ },
    "experience": { /* default content */ },
    "details-header": { /* default content */ },
    "amenities": { 
      /* Note: amenities now use ID references, see normalized collections section */
    }
  }
}
```

### Property Overrides (`propertyOverrides` collection)

Property overrides have been extended to support:

- `visiblePages`: An array of page names that should be visible
- Page-specific overrides as top-level keys, matching page names from the template
- Each page override can include:
  - `visibleBlocks`: An array of block IDs that should be visible on that page
  - Block-specific overrides, where keys match block IDs

Example:
```json
{
  "visiblePages": ["homepage", "details", "location"],
  "menuItems": [
    { "label": "Home", "url": "/" },
    { "label": "About", "url": "/details" }
  ],
  "homepage": {
    "visibleBlocks": ["hero", "experience"],
    "hero": {
      "title": "Custom Property Title",
      "backgroundImage": "/custom-image.jpg"
    }
  },
  "details": {
    "visibleBlocks": ["details-header", "amenities"],
    "details-header": {
      "title": "About Our Property"
    }
  },
  "amenityRefs": [
    "high-speed-wifi",
    "fully-equipped-kitchen",
    "free-parking",
    "air-conditioning"
  ]
}
```

## Components

### Core Components

1. `PropertyPageRenderer`: 
   - Renders a specific page from the template
   - Maps block types to components
   - Merges template defaults with property overrides
   
2. `Header` (`generic-header-multipage.tsx`):
   - Supports dynamic menu items
   - Handles navigation between pages
   - Adapts styling based on scroll position

### Block Components

New block components for the multi-page structure:

1. `PageHeader`: Headers for subpages
2. `AmenitiesList`: Property amenities (uses normalized amenities collection)
3. `RoomsList`: Rooms and accommodations
4. `SpecificationsList`: Property specifications
5. `PricingTable`: Seasonal pricing
6. `FullMap`: Property location map
7. `AttractionsList`: Nearby attractions
8. `TransportOptions`: Transportation options
9. `DistancesList`: Distances to locations
10. `GalleryGrid`: Full gallery with lightbox
11. `PhotoCategories`: Categorized photo gallery
12. `FullBookingForm`: Complete booking form
13. `PoliciesList`: Booking policies

## Routing

### Page Routes (Updated)

The routing now uses a single optional catch-all route:

```
/properties/[slug]/[[...path]]/page.tsx
```

This handles all property pages:
- Homepage: `/properties/[slug]` (path is empty/undefined)
- Subpages: `/properties/[slug]/[...path]` (path contains segments)
- Multilingual: `/properties/[slug]/[lang]/[...path]` (first segment is language)

### Implementation Details

The consolidated page component:
1. Extracts language from the path if present
2. Determines the page name from remaining path segments
3. Renders homepage without LanguageProvider for default language
4. Wraps other pages/languages in LanguageProvider
5. Preserves all error handling from the original implementation

### Migration from Dual Files

Previously, the system used two separate files:
- `[slug]/page.tsx` - Homepage only
- `[slug]/[...path]/page.tsx` - All subpages

These have been consolidated into a single file to:
- Reduce code duplication
- Maintain consistent behavior
- Simplify maintenance
- Preserve the critical header positioning from the homepage

### Custom Domain Support

The middleware (`middleware.ts`) has been updated to support the multi-page structure:

- For the root path (`/`), rewrites to the property homepage
- For known page types (e.g., `/details`, `/location`), rewrites to the corresponding property page
- For other paths, maintains the path structure within the property context

## Implementation Process

To implement the multi-page structure:

1. Create a new template in `websiteTemplates` collection with the multi-page structure
2. Create property overrides for each property
3. Update the property's `templateId` to point to the multi-page template
4. Use the `update-multipage-template.ts` script to upload the data

## Adding New Block Types

To add a new block type:

1. Define the schema in `overridesSchemas-multipage.ts`
2. Create the component in `src/components/property/`
3. Add the component to the `blockComponents` map in `PropertyPageRenderer`
4. Add default content to the template

## Normalized Collections

The multi-page architecture integrates with normalized collections for better data management:

### Amenities Collection

Instead of storing amenities directly in property overrides, the system now uses a normalized `amenities` collection:

```json
{
  "id": "fully-equipped-kitchen",
  "name": {
    "en": "Kitchen",
    "ro": "Bucătărie"
  },
  "category": {
    "en": "Essentials",
    "ro": "Esențiale"  
  },
  "icon": "Kitchen"
}
```

Properties reference amenities using IDs:

```json
{
  "propertyId": "example-property",
  "amenityRefs": [
    "fully-equipped-kitchen",
    "high-speed-wifi",
    "free-parking"
  ]
}
```

### Features Collection

Similar to amenities, features are also normalized:

```json
{
  "id": "pet-friendly",
  "title": {
    "en": "Pet-friendly",
    "ro": "Acceptăm animale"
  },
  "description": {
    "en": "We welcome pets",
    "ro": "Animalele sunt binevenite"
  }
}
```

### Components

The `AmenitiesList` and other components fetch data from these normalized collections at runtime, ensuring consistency and enabling easy updates across all properties.

## Best Practices

1. Keep block IDs unique across all pages to avoid conflicts
2. Use semantic page names (e.g., "details" instead of "page1")
3. Ensure all required blocks have default content
4. Use normalized collections for shared data (amenities, features)
5. Reference amenities by ID rather than embedding them directly

## Booking Form Integration in Hero Section

The booking form can be embedded within the hero section using a decoupled architecture:

### Architecture

1. **Hero Section Configuration**: The hero block can include booking form configuration:
   ```json
   {
     "hero": {
       "showBookingForm": true,
       "bookingForm": {
         "position": "bottom",  // or "center", "top", "bottom-left", etc.
         "size": "large"        // or "compressed"
       }
     }
   }
   ```

2. **Component Structure**:
   - The `HeroSection` component accepts a `showBookingForm` prop
   - When true, it renders an embedded `BookingContainer` with `variant="embedded"`
   - The booking form is positioned absolutely within the hero section

3. **Positioning System**:
   - The form position is controlled via absolute positioning
   - The `position` prop determines where the form appears (bottom, center, etc.)
   - The `size` prop controls whether it's in compressed or large (horizontal) layout
   - A helper function (`setupHeroContentAdjustment`) manages dynamic positioning

### Key Implementation Details

1. **Absolute Positioning**: The booking form wrapper uses absolute positioning:
   ```jsx
   style={{ 
     position: 'absolute',
     bottom: '20px',
     left: '50%',
     transform: 'translateX(-50%)',
     width: formSize === 'large' ? '840px' : 'auto'
   }}
   ```

2. **Size-Based Styling**: The `BookingContainer` component adapts its layout based on size:
   - `large`: Horizontal layout with all elements in one row
   - `compressed`: Vertical or compact layout

3. **Header Transparency**: The hero section has class `has-transparent-header` to work with the fixed transparent header

4. **Z-Index Management**: Proper layering ensures the form appears above background elements but below modals

### Configuration in Property Overrides

Properties can customize the booking form behavior in their overrides:

```json
{
  "propertyId": "example-property",
  "hero": {
    "title": "Beautiful Mountain Chalet",
    "showBookingForm": true,
    "bookingForm": {
      "position": "bottom",
      "size": "large"
    }
  }
}
```

### Troubleshooting

If the booking form doesn't appear:
1. Check that `showBookingForm: true` is set in the hero overrides
2. Verify the parent containers have `position: relative` and `overflow: visible`
3. Ensure proper z-index layering
4. Check that the hero section has sufficient height
4. Test navigation between pages thoroughly
5. Test custom domain resolution with different path patterns