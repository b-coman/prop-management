# Property Data Schema

This document provides a comprehensive reference for the property data model used in RentalSpot, including multilingual support and normalized collections.

## Properties Collection

The core property data structure (`properties/{propertyId}`):

```json
// Key pricing fields:
// - pricePerNight: Base nightly rate
// - advertisedRate: Display rate (numeric, in baseCurrency)
// - baseCurrency: Currency for all numeric values
// - Use appConfig/currencyRates.json for currency conversion in components
{
  "propertyId": "unique-property-id",
  "slug": "url-friendly-slug",
  "templateId": "holiday-house",
  "domain": "property.example.com",
  "basePrice": {
    "USD": 120,
    "EUR": 110,
    "RON": 550
  },
  "currency": "USD",
  "name": {
    "en": "Beautiful Mountain Chalet",
    "ro": "Cabană Frumoasă în Munte"
  },
  "location": {
    "en": "Prahova Valley, Romania",
    "ro": "Valea Prahovei, România"
  },
  "coordinates": {
    "lat": 45.3327,
    "lng": 25.5508
  },
  "description": {
    "en": "Charming mountain retreat nestled in the Carpathian Mountains",
    "ro": "Refugiu fermecător în inima Munților Carpați"
  },
  "details": {
    "maxGuests": 8,
    "bedrooms": 3,
    "bathrooms": 2,
    "checkInTime": "15:00",
    "checkOutTime": "11:00"
  },
  "amenityRefs": ["wifi", "kitchen", "parking", "fireplace"],
  "pricePerNight": 180,
  "baseCurrency": "EUR",
  "advertisedRate": 160,
  "advertisedRateType": "starting",
  "cleaningFee": 40,
  "languages": ["en", "ro"],
  "defaultLanguage": "en"
}
```

## Property Overrides Collection

Customizations for specific properties (`propertyOverrides/{propertyId}`):

```json
{
  "propertyId": "unique-property-id",
  "visiblePages": ["homepage", "details", "location", "gallery", "booking"],
  "amenityRefs": [
    "high-speed-wifi",
    "fully-equipped-kitchen",
    "free-parking",
    "air-conditioning"
  ],
  "featureRefs": [
    "pet-friendly",
    "eco-friendly",
    "family-friendly"
  ],
  "hero": {
    "title": {
      "en": "Welcome to Paradise",
      "ro": "Bine ați venit în Paradis"
    },
    "subtitle": {
      "en": "Your mountain escape awaits",
      "ro": "Evadarea ta montană te așteaptă"
    },
    "backgroundImage": "/images/hero-1.jpg",
    "showBookingForm": true
  },
  "experience": {
    "items": [
      {
        "title": {
          "en": "Mountain Views",
          "ro": "Priveliști Montane"
        },
        "description": {
          "en": "Wake up to breathtaking mountain vistas",
          "ro": "Trezește-te cu priveliști montane spectaculoase"
        }
      }
    ]
  }
}
```

## Normalized Collections

### Amenities Collection (`amenities/{amenityId}`)

```json
{
  "id": "high-speed-wifi",
  "name": {
    "en": "High-Speed Wi-Fi",
    "ro": "Wi-Fi de Mare Viteză"
  },
  "category": {
    "en": "Internet",
    "ro": "Internet"
  },
  "icon": "Wifi",
  "order": 1
}
```

### Features Collection (`features/{featureId}`)

```json
{
  "id": "pet-friendly",
  "title": {
    "en": "Pet Friendly",
    "ro": "Acceptăm Animale"
  },
  "description": {
    "en": "We welcome well-behaved pets",
    "ro": "Animalele cuminți sunt binevenite"
  },
  "icon": "PawPrint",
  "order": 1
}
```

## Price Calendars Collection

Dynamic pricing by date (`priceCalendars/{propertyId}-{year}`):

```json
{
  "propertyId": "unique-property-id",
  "year": 2024,
  "months": {
    "1": { // January
      "1": 150,  // Jan 1st
      "2": 120,  // Jan 2nd
      ...
    }
  }
}
```

## Date Overrides Collection

Special pricing for specific date ranges (`dateOverrides/{overrideId}`):

```json
{
  "name": {
    "en": "Christmas Holiday",
    "ro": "Sărbătorile de Crăciun"
  },
  "startDate": "2024-12-23",
  "endDate": "2024-12-31",
  "priceMultiplier": 1.5,
  "minStay": 3,
  "propertyIds": ["unique-property-id"]
}
```

## Seasonal Pricing Collection

Base pricing by season (`seasonalPricing/{seasonId}`):

```json
{
  "name": {
    "en": "Summer Season",
    "ro": "Sezonul de Vară"
  },
  "startMonth": 6,
  "endMonth": 8,
  "pricePerNight": {
    "USD": 150,
    "EUR": 140,
    "RON": 700
  },
  "minStay": 2,
  "propertyIds": ["unique-property-id"]
}
```

## Website Templates Collection

Template definitions (`websiteTemplates/{templateId}`):

```json
{
  "templateId": "holiday-house",
  "name": "Holiday House Template",
  "description": "Default template for vacation rental properties",
  "pages": {
    "homepage": {
      "path": "/",
      "title": "Home",
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
    "experience": { /* default content */ }
  }
}
```

## Bookings Collection

Booking records (`bookings/{bookingId}`):

```json
{
  "bookingId": "unique-booking-id",
  "propertyId": "unique-property-id",
  "status": "confirmed",
  "type": "booking",
  "guestInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  },
  "bookingDetails": {
    "checkIn": "2024-06-15",
    "checkOut": "2024-06-20",
    "guests": 4,
    "totalAmount": 600,
    "currency": "USD"
  },
  "createdAt": "2024-05-01T10:00:00Z",
  "updatedAt": "2024-05-01T10:00:00Z"
}
```

## Inquiries Collection

Guest inquiries (`inquiries/{inquiryId}`):

```json
{
  "inquiryId": "unique-inquiry-id",
  "propertyId": "unique-property-id",
  "status": "new",
  "guestInfo": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+1234567890"
  },
  "message": "I'm interested in booking your property for a week in July",
  "preferredDates": {
    "checkIn": "2024-07-15",
    "checkOut": "2024-07-22"
  },
  "replies": [],
  "createdAt": "2024-05-01T10:00:00Z",
  "updatedAt": "2024-05-01T10:00:00Z"
}
```

## Coupons Collection

Discount coupons (`coupons/{couponId}`):

```json
{
  "code": "SUMMER20",
  "description": {
    "en": "20% off summer bookings",
    "ro": "20% reducere pentru rezervări de vară"
  },
  "discountType": "percentage",
  "discountValue": 20,
  "validFrom": "2024-06-01",
  "validTo": "2024-08-31",
  "isActive": true,
  "maxUses": 100,
  "timesUsed": 15,
  "propertyIds": ["unique-property-id"]
}
```

## Schema Best Practices

1. **Always use multilingual objects** for user-facing text:
   ```json
   "title": {
     "en": "English Title",
     "ro": "Titlu în Română"
   }
   ```

2. **Use reference arrays** for normalized data:
   ```json
   "amenityRefs": ["wifi", "parking", "kitchen"]
   ```

3. **Store prices in multiple currencies** when needed:
   ```json
   "price": {
     "USD": 100,
     "EUR": 90,
     "RON": 450
   }
   ```

4. **Use ISO formats** for dates and times:
   - Dates: "YYYY-MM-DD"
   - Times: "HH:MM"
   - Timestamps: ISO 8601 format

5. **Version sensitive data** (like price calendars) by year:
   - Document ID: `{propertyId}-{year}`

## Validation Rules

1. **Required fields**:
   - Properties: `propertyId`, `slug`, `name`, `basePrice`
   - Bookings: `propertyId`, `guestInfo`, `bookingDetails`
   - Amenities: `id`, `name`

2. **Unique constraints**:
   - Property slugs must be unique
   - Amenity/Feature IDs must be unique
   - Coupon codes must be unique

3. **Data consistency**:
   - Languages array must match available translations
   - Referenced IDs must exist in their collections
   - Date ranges must be valid (end after start)

## Migration Considerations

When updating the schema:

1. **Backward compatibility**: Ensure old documents can still be read
2. **Default values**: Provide sensible defaults for new fields
3. **Batch updates**: Use Firestore batch operations for large updates
4. **Validation**: Run validation scripts before deployment
5. **Indexing**: Update Firestore indexes for new query patterns

This schema supports a flexible, multilingual property rental system with dynamic pricing, rich content management, and normalized data relationships.