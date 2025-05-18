# Using Amenities and Features

This guide explains how to work with the normalized amenities and features system in RentalSpot-Builder.

## Overview

The amenities and features system uses a normalized data model where amenities and features are stored in separate collections rather than being embedded in each property. This provides:

- Centralized translation management
- Reusability across properties
- Consistency in naming and icons
- Better scalability
- Support for AI/automated detection

## Data Structure

### Amenities Collection (`/amenities`)

```typescript
interface Amenity {
  id: string;
  name: {
    en: string;
    ro: string;
  };
  icon: string;
  category?: {
    en: string;
    ro: string;
  };
}
```

Example:
```json
{
  "id": "high-speed-wifi",
  "name": {
    "en": "High-Speed WiFi",
    "ro": "WiFi de Mare Viteză"
  },
  "icon": "Wifi",
  "category": {
    "en": "Indoor",
    "ro": "Interior"
  }
}
```

### Features Collection (`/features`)

```typescript
interface Feature {
  id: string;
  title: {
    en: string;
    ro: string;
  };
  description: {
    en: string;
    ro: string;
  };
  icon: string;
  order?: number;
}
```

### Property References

Properties now store amenity IDs instead of the full amenity data:

```json
{
  "amenities": ["wifi", "kitchen", "parking", "fireplace"]
}
```

Property overrides use amenity references in categories:
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

## Using the AmenitiesDisplay Component

### Basic Usage

For simple amenity lists (from property data):

```typescript
import { AmenitiesDisplay } from '@/components/property/amenities-display';

// In your component
<AmenitiesDisplay 
  amenityIds={property.amenities}
  title={{ en: "Amenities", ro: "Facilități" }}
/>
```

### Categorized Display

For categorized amenities (from property overrides):

```typescript
<AmenitiesDisplay 
  categories={propertyOverride.details.amenities.categories}
  title={propertyOverride.details.amenities.title}
/>
```

### Custom Styling

```typescript
<AmenitiesDisplay 
  amenityIds={property.amenities}
  className="grid grid-cols-3 gap-4"
/>
```

## Fetching Amenities

### Batch Fetching

The component automatically batches amenity fetches (Firestore limit is 10 per query):

```typescript
const batchSize = 10;
for (let i = 0; i < amenityIds.length; i += batchSize) {
  const batch = amenityIds.slice(i, i + batchSize);
  const q = query(
    collection(db, 'amenities'),
    where(documentId(), 'in', batch)
  );
  
  const snapshot = await getDocs(q);
  // Process results...
}
```

### Direct Fetching

For single amenity:
```typescript
const amenityDoc = await getDoc(doc(db, 'amenities', amenityId));
const amenity = amenityDoc.data();
```

## Managing Amenities

### Adding New Amenities

1. Create amenity document in Firestore:
```typescript
const newAmenity = {
  id: "swimming-pool",
  name: {
    en: "Swimming Pool",
    ro: "Piscină"
  },
  icon: "Waves",
  category: {
    en: "Outdoor",
    ro: "Exterior"
  }
};

await setDoc(doc(db, 'amenities', newAmenity.id), newAmenity);
```

2. Add to property:
```typescript
const updatedAmenities = [...property.amenities, "swimming-pool"];
await updateDoc(doc(db, 'properties', propertyId), {
  amenities: updatedAmenities
});
```

### Icon System

Icons use Lucide React icon names. Common mappings:
- WiFi → `Wifi`
- Kitchen → `ChefHat`
- Parking → `Car`
- TV → `Tv`
- Fireplace → `Flame`
- Garden → `Trees`
- Mountain View → `Mountain`

## Translations

All amenities and features support multilingual content:

```typescript
const { tc } = useLanguage();

// Display amenity name in current language
<span>{tc(amenity.name)}</span>

// Display category in current language
<h3>{tc(category.name)}</h3>
```

## Migration

If you need to migrate existing embedded amenities:

1. Extract unique amenities from properties
2. Create documents in amenities collection
3. Update properties to use amenity IDs
4. Update property overrides to use amenityRefs

## Best Practices

1. **Consistent Naming**: Use lowercase IDs with hyphens (e.g., `high-speed-wifi`)
2. **Icon Selection**: Choose icons that clearly represent the amenity
3. **Categories**: Group related amenities for better UX
4. **Translations**: Always provide both English and Romanian translations
5. **Reusability**: Check if an amenity exists before creating a new one

## Troubleshooting

### Amenities Not Displaying

1. Check if amenity IDs exist in the collection
2. Verify the component is receiving the correct props
3. Check console for Firestore permission errors

### Missing Icons

If an icon doesn't render:
1. Verify the icon name matches a Lucide React icon
2. Use the default `Home` icon as fallback
3. Check the icon import in the component

### Translation Issues

1. Ensure amenity documents have both `en` and `ro` values
2. Check that the language context is properly set up
3. Verify the `tc` function is working correctly

## Future Enhancements

1. Admin UI for managing amenities
2. Bulk import/export functionality
3. Amenity search and filtering
4. Usage analytics
5. AI-powered amenity detection from property descriptions