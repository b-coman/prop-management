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
    "amenities": { /* default content */ }
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
  }
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
2. `AmenitiesList`: Property amenities
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

### Page Routes

- Homepage: `/properties/[slug]`
- Subpages: `/properties/[slug]/[...path]`

The `[...path]` catch-all route matches any path pattern and renders the appropriate page based on the template configuration.

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

## Best Practices

1. Keep block IDs unique across all pages to avoid conflicts
2. Use semantic page names (e.g., "details" instead of "page1")
3. Ensure all required blocks have default content
4. Test navigation between pages thoroughly
5. Test custom domain resolution with different path patterns