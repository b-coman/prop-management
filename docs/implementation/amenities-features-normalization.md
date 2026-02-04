# Amenities and Features Normalization

## Overview

We've restructured the data model to normalize amenities and features into separate collections, enabling:
- Reusability across properties
- Centralized translation management
- Easier automation and AI detection
- Better scalability

## Data Structure

### Before (Denormalized)
```json
// In each property
{
  "amenities": {
    "en": ["WiFi", "Kitchen", "Parking"],
    "ro": ["WiFi", "Bucătărie", "Parcare"]
  }
}

// In property overrides
{
  "details": {
    "amenities": {
      "categories": [
        {
          "name": "Indoor",
          "amenities": [
            {
              "icon": "Wifi",
              "name": "High-Speed WiFi"
            }
          ]
        }
      ]
    }
  }
}
```

### After (Normalized)

**Amenities Collection:**
```json
// /amenities/high-speed-wifi
{
  "id": "high-speed-wifi",
  "icon": "Wifi",
  "name": {
    "en": "High-Speed WiFi",
    "ro": "WiFi de Mare Viteză"
  },
  "category": {
    "en": "Indoor",
    "ro": "Interior"
  }
}
```

**Properties:**
```json
{
  "amenities": ["wifi", "kitchen", "parking", "fireplace"]
}
```

**Property Overrides:**
```json
{
  "details": {
    "amenities": {
      "categories": [
        {
          "name": {
            "en": "Indoor",
            "ro": "Interior"
          },
          "amenityRefs": ["high-speed-wifi", "4k-smart-tv"]
        }
      ]
    }
  }
}
```

## Collections Created

1. **`/amenities`** - Standardized amenities with translations
2. **`/features`** - Property features (like "Mountain Views", "BBQ Area")

## Migration Results

- Created 18 unique amenities
- Created 3 unique features
- Updated all properties to use references
- Updated property overrides to use references
- Kept original data as backup (`amenitiesOld`)

## Component Usage

### Displaying Amenities

The current implementation uses `AmenitiesList` which expects pre-loaded structured data from property overrides:

```typescript
import { AmenitiesList } from '@/components/property/amenities-list';

// Used in property-page-renderer.tsx with AmenitiesListBlock data
<AmenitiesList
  content={amenitiesListBlock}
  language={currentLanguage}
/>
```

The `AmenitiesListBlock` schema (from `lib/overridesSchemas-multipage.ts`) includes:
- `title`: Multilingual title
- `categories`: Array of category objects with names and amenities
- Each amenity has `icon` (Lucide icon name) and `name` (multilingual)

> **Note**: The previous `AmenitiesDisplay` component (which fetched from Firestore at runtime) was removed in Feb 2026 as part of architecture cleanup. The current system uses pre-loaded structured data from property overrides.

### Fetching Amenities

```typescript
// Fetch multiple amenities by IDs
const q = query(
  collection(db, 'amenities'),
  where(documentId(), 'in', amenityIds)
);
```

## Benefits

1. **Centralized Management**: Update translations once, affects all properties
2. **Consistency**: Same amenity has same name/icon everywhere
3. **Scalability**: Easy to add new languages or properties
4. **AI-Ready**: Structured data for automated detection
5. **Performance**: Smaller property documents, cacheable amenities

## Future Enhancements

1. Add amenity categories as separate collection
2. Add amenity metadata (e.g., importance, searchability)
3. Create admin UI for managing amenities
4. Implement amenity search/filtering
5. Add amenity icons management

## Rollback

If needed, the original data is preserved:
- Properties: `amenitiesOld` field
- Property Overrides: `amenitiesOld` in each category

To rollback:
1. Restore `amenities` from `amenitiesOld` in properties
2. Restore category `amenities` from `amenitiesOld` in overrides
3. Delete amenities/features collections