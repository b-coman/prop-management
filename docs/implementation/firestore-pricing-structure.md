# Simplified Firestore Pricing Structure

This document outlines a simplified but flexible Firestore data structure for the RentalSpot-Builder pricing system, based on practical requirements for vacation rental pricing.

## Core Principles

1. **Simplicity First**: Focus on common pricing needs without overwhelming users
2. **Visual Management**: Support a calendar-based interface for easy visualization
3. **Practical Flexibility**: Allow for key customizations that property owners actually use
4. **Future-Proof**: Design to allow for extensions without restructuring
5. **Performance Optimized**: Pre-calculated prices for fast retrieval

## Data Structure

### 1. Property Collection (Enhanced)

The existing `properties` collection will receive minimal extensions.

**Collection**: `properties`
**Document ID**: `{property-slug}`

**New Fields**:
```
{
  // Existing fields remain unchanged
  "id": "prahova-mountain-chalet",
  "pricePerNight": 180,
  "baseCurrency": "EUR",
  
  // New fields for enhanced pricing
  "pricingConfig": {
    "weekendAdjustment": 1.2,       // Multiplier for weekend prices
    "weekendDays": ["friday", "saturday"], // Which days count as weekend
    "lengthOfStayDiscounts": [
      {
        "nightsThreshold": 7,
        "discountPercentage": 5,
        "enabled": true
      },
      {
        "nightsThreshold": 14,
        "discountPercentage": 10,
        "enabled": true
      }
    ]
  }
}
```

### 2. Seasonal Pricing Collection

A new collection for defining seasonal pricing periods with predefined demand levels.

**Collection**: `seasonalPricing`
**Document ID**: `{property-slug}_{auto-id}`

**Structure**:
```
{
  "id": "prahova-mountain-chalet_summer2023",
  "propertyId": "prahova-mountain-chalet",
  "name": "Summer 2023",
  "seasonType": "high", // "minimum", "low", "standard", "medium", "high"
  "startDate": "2023-06-15",
  "endDate": "2023-08-31",
  "priceMultiplier": 1.5, // Predefined based on seasonType
  "minimumStay": 3,       // Minimum nights required
  "enabled": true,
  "notes": "School vacation period",
  "createdAt": {
    "_seconds": 1677721600,
    "_nanoseconds": 0
  },
  "updatedAt": {
    "_seconds": 1677721600,
    "_nanoseconds": 0
  }
}
```

### 3. Date Overrides Collection

A collection for individual date price adjustments that override all other rules.

**Collection**: `dateOverrides`
**Document ID**: `{property-slug}_{YYYY-MM-DD}`

**Structure**:
```
{
  "id": "prahova-mountain-chalet_2023-12-31",
  "propertyId": "prahova-mountain-chalet",
  "date": "2023-12-31",
  "customPrice": 350,     // Absolute price, not a multiplier
  "reason": "New Year's Eve",
  "minimumStay": 3,       // Optional minimum stay override
  "available": true,      // Can also mark as unavailable
  "flatRate": true,       // Whether this price applies for any number of guests
  "createdAt": {
    "_seconds": 1677721600,
    "_nanoseconds": 0
  },
  "updatedAt": {
    "_seconds": 1677721600,
    "_nanoseconds": 0
  }
}
```

### 4. Minimum Stay Rules Collection

A collection for specifying minimum stay requirements for specific periods.

**Collection**: `minimumStayRules`
**Document ID**: `{property-slug}_{auto-id}`

**Structure**:
```
{
  "id": "prahova-mountain-chalet_christmas2023",
  "propertyId": "prahova-mountain-chalet",
  "name": "Christmas 2023",
  "startDate": "2023-12-20",
  "endDate": "2023-12-27",
  "minimumStay": 4,
  "notes": "Christmas period requires longer stays",
  "enabled": true,
  "createdAt": {
    "_seconds": 1677721600,
    "_nanoseconds": 0
  },
  "updatedAt": {
    "_seconds": 1677721600,
    "_nanoseconds": 0
  }
}
```

### 5. Holidays Collection (Admin-Managed)

A collection for system-defined holidays to assist in pricing decisions.

**Collection**: `holidays`
**Document ID**: `{country-code}_{holiday-name}_{year}`

**Structure**:
```
{
  "id": "RO_christmas_2023",
  "name": "Christmas",
  "countryCode": "RO",
  "year": 2023,
  "startDate": "2023-12-25",
  "endDate": "2023-12-26",
  "type": "major", // "major", "minor", "school-break"
  "notes": "Public holiday",
  "createdAt": {
    "_seconds": 1677721600,
    "_nanoseconds": 0
  }
}
```

### 6. Pricing Templates Collection (Admin-Managed)

Predefined pricing templates to help new users get started quickly.

**Collection**: `pricingTemplates`
**Document ID**: `{template-name}`

**Structure**:
```
{
  "id": "mountain-cabin",
  "name": "Mountain Cabin",
  "description": "Typical pricing for mountain properties",
  "defaultPricing": {
    "weekendAdjustment": 1.25,
    "weekendDays": ["friday", "saturday"]
  },
  "seasons": [
    {
      "name": "Winter High Season",
      "seasonType": "high",
      "startMonth": 12,
      "startDay": 15,
      "endMonth": 3,
      "endDay": 15,
      "priceMultiplier": 1.5,
      "minimumStay": 3
    },
    {
      "name": "Summer Season",
      "seasonType": "medium",
      "startMonth": 6,
      "startDay": 1,
      "endMonth": 8,
      "endDay": 31,
      "priceMultiplier": 1.3,
      "minimumStay": 2
    },
    {
      "name": "Low Season",
      "seasonType": "low",
      "startMonth": 10,
      "startDay": 1,
      "endMonth": 11,
      "endDay": 30,
      "priceMultiplier": 0.8,
      "minimumStay": 1
    }
  ],
  "suggestedLengthOfStayDiscounts": [
    {
      "nightsThreshold": 7,
      "discountPercentage": 5
    },
    {
      "nightsThreshold": 14,
      "discountPercentage": 10
    }
  ],
  "createdAt": {
    "_seconds": 1677721600,
    "_nanoseconds": 0
  },
  "updatedAt": {
    "_seconds": 1677721600,
    "_nanoseconds": 0
  }
}
```

### 7. Price & Availability Calendar (Combined)

A critical collection that serves as the pre-calculated source of both pricing and availability information for each property. Prices are pre-calculated for different occupancy levels to optimize booking-time performance.

**Collection**: `priceCalendar`
**Document ID**: `{property-slug}_{YYYY-MM}`

**Structure**:
```
{
  "id": "prahova-mountain-chalet_2023-06",
  "propertyId": "prahova-mountain-chalet",
  "month": "2023-06",
  "year": 2023,
  
  // Daily price and availability data - one entry per day of the month
  "days": {
    "1": {  // Regular day (base pricing)
      "baseOccupancyPrice": 180,  // Price for the base occupancy (e.g., 4 people)
      "prices": {                 // Pre-calculated prices for specific occupancies
        "5": 205,                 // Price for 5 guests
        "6": 230,                 // Price for 6 guests
        "7": 255                  // Price for 7 guests
      },
      "available": true,          // Whether this date is available for booking
      "minimumStay": 1,           // Minimum nights required if starting on this date
      "priceSource": "base"       // Source of this price ("base", "weekend", "season", "override")
    },
    "2": {  // Weekend day
      "baseOccupancyPrice": 216,  // Weekend price (180 * 1.2)
      "prices": {
        "5": 241,                 // 216 + 25 (extra guest fee)
        "6": 266,
        "7": 291
      },
      "available": true,
      "minimumStay": 1,
      "priceSource": "weekend"
    },
    "15": { // High season day
      "baseOccupancyPrice": 270,  // Season price (180 * 1.5)
      "prices": {
        "5": 295,
        "6": 320,
        "7": 345
      },
      "available": true,
      "minimumStay": 3,           // Higher minimum stay during high season
      "priceSource": "season",
      "sourceDetails": {
        "name": "Summer 2023",
        "id": "prahova-mountain-chalet_summer2023"
      }
    },
    "16": { // Booked date
      "baseOccupancyPrice": 270,
      "prices": {
        "5": 295,
        "6": 320,
        "7": 345
      },
      "available": false,         // This date is already booked
      "minimumStay": 3,
      "priceSource": "season",
      "sourceDetails": {
        "name": "Summer 2023",
        "id": "prahova-mountain-chalet_summer2023"
      }
    },
    "31": { // Special flat-rate date
      "baseOccupancyPrice": 350,  // Custom override price for a special date
      "prices": {                 // Same price for all occupancy levels (flat rate)
        "5": 350,
        "6": 350,
        "7": 350
      },
      "available": true,
      "minimumStay": 3,
      "priceSource": "override",
      "sourceDetails": {
        "reason": "New Year's Eve",
        "id": "prahova-mountain-chalet_2023-12-31"
      }
    }
  },
  
  // Summary statistics for quick display and filtering
  "summary": {
    "minPrice": 180,
    "maxPrice": 350,
    "avgPrice": 240,
    "unavailableDays": 2,     // Count of unavailable/booked days
    "modifiedDays": 20,       // Days with non-base pricing
    "hasCustomPrices": true,  // Has at least one date override
    "hasSeasonalRates": true  // Has at least one seasonal pricing
  },
  
  // Metadata
  "generatedAt": {
    "_seconds": 1677721600,
    "_nanoseconds": 0
  }
}
```

**Key benefits of this structure:**

1. **Pre-calculated occupancy pricing**: Prices for different guest counts are pre-calculated and stored
2. **Flat-rate handling**: Special dates use the same price for all occupancy levels
3. **Combined pricing and availability**: A single source of truth for both price and booking status
4. **Organized by month**: Makes it easy to fetch data for date ranges spanning multiple months
5. **Complete day information**: Each day has pre-calculated prices, availability, and minimum stay
6. **Direct lookups**: No calculations needed during booking - just look up the price for selected dates and guest count
7. **Reasonable document size**: Monthly documents prevent hitting Firestore size limits

When a booking spans multiple months, the system retrieves the relevant monthly documents and combines the data. For a 7-night stay from June 28 to July 5, it would fetch both `prahova-mountain-chalet_2023-06` and `prahova-mountain-chalet_2023-07`.

### 8. Enhanced Booking Records

Extend the booking data structure to include more pricing details.

**Collection**: `bookings`
**Document ID**: `{auto-id}`

**Enhanced Fields**:
```
{
  // Existing fields remain unchanged
  
  "pricing": {
    // Enhanced pricing details with full breakdown
    "breakdown": {
      "baseRate": 180,
      "numberOfNights": 5,
      "dailyRates": {
        "2023-06-15": 270, // High season
        "2023-06-16": 270, // High season + weekend
        "2023-06-17": 270, // High season + weekend
        "2023-06-18": 270, // High season
        "2023-06-19": 270  // High season
      },
      "seasonalAdjustments": [
        {
          "name": "Summer 2023",
          "adjustment": 90, // Additional per night due to season
          "nights": 5,
          "total": 450
        }
      ],
      "cleaningFee": 40,
      "extraGuestFee": 75,  // 3 extra guests × 5 nights × €5
      "subtotal": 1265,
      
      // Discounts
      "lengthOfStayDiscount": null,  // Would include details if applied
      "couponDiscount": {
        "code": "SUMMER10",
        "percentage": 10,
        "amount": 126.5
      },
      
      "total": 1138.5,
      "currency": "EUR"
    },
    // Simplified version for backward compatibility
    "baseRate": 180,
    "accommodationTotal": 1350,
    "cleaningFee": 40,
    "extraGuestFee": 75,
    "subtotal": 1265,
    "discountAmount": 126.5,
    "total": 1138.5,
    "currency": "EUR"
  }
}
```

## Price Calendar Generation Process

The `priceCalendar` collection is the heart of the pricing system and is maintained through an automated process:

### 1. Nightly Generation

- A scheduled job runs every night to generate/update price calendars
- Processes all properties and generates calendars for the next 12 months
- Applies all pricing rules in the correct priority order
- Pre-calculates prices for different occupancy levels

### 2. Event-Driven Updates

- When pricing rules or base prices change, targeted updates are triggered
- Only affected properties and date ranges are recalculated
- Changes are immediately reflected in the `priceCalendar`

### 3. Booking Integration

- When a booking is confirmed, the affected dates are marked as unavailable
- When a booking is canceled, dates are restored to available status
- These changes happen in real-time to prevent double bookings

### 4. Generation Process

The price calendar generation follows this sequence:

1. Start with the property's base price
2. Apply weekend adjustments for applicable days
3. Apply seasonal pricing for any matching seasons
4. Apply date-specific overrides (highest priority)
5. Calculate prices for different occupancy levels
   - For regular dates: Apply extra guest fees for occupancies above base
   - For flat-rate dates: Use the same price for all occupancy levels
6. Apply minimum stay requirements
7. Mark unavailable dates based on existing bookings
8. Calculate summary statistics for the month
9. Store the complete calendar document

## Data Relationships and Application Logic

### Price Calculation Flow

1. **Base Price Determination**:
   - Start with the property's `pricePerNight`
   - Apply weekend adjustments if applicable

2. **Seasonal Adjustments**:
   - Check if the date falls within any active seasonal pricing period
   - Apply the appropriate multiplier from the matching season

3. **Custom Price Overrides**:
   - Check if there's a specific override for the date
   - If present, use the custom price regardless of other rules
   - For flat-rate dates, use the same price for all occupancy levels

4. **Occupancy Price Calculation**:
   - For regular dates: Calculate prices for each supported occupancy level
   - For flat-rate dates: Use the same price for all occupancy levels

5. **Minimum Stay Determination**:
   - Check for date-specific minimum stay rules
   - If none, use the season's minimum stay requirement
   - If no season applies, default to property's standard minimum stay

6. **Length-of-Stay Discounts**:
   - Applied at booking time based on the property's configuration

7. **Coupon Application**:
   - Applied at booking time to the pre-discount subtotal

### Availability and Booking Flow

1. **Availability Checking**:
   - Queries the `priceCalendar` collection for the date range
   - Checks `available` status for all requested dates
   - Verifies minimum stay requirements are met
   - Returns both availability and pricing in a single operation

2. **Booking Creation**:
   - Retrieves final prices from the `priceCalendar` based on guest count
   - Applies any length-of-stay discounts
   - Applies any coupon discounts
   - Stores the complete price breakdown in the booking record
   - Updates the `priceCalendar` to mark dates as unavailable

3. **Price Display**:
   - Calendar views use the `priceCalendar` for efficient rendering
   - Direct lookups for specific occupancy levels provide instant pricing
   - No calculations needed during booking or display

### Security Rules

Simplified security rules to protect pricing data:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Base property security
    match /properties/{propertyId} {
      // Existing rules...
    }
    
    // Seasonal pricing - property owner and admins only
    match /seasonalPricing/{docId} {
      allow read: if true;
      allow write: if request.auth != null && 
        (resourceData().propertyId == propertyId && 
         get(/databases/$(database)/documents/properties/$(propertyId)).data.ownerId == request.auth.uid) || 
        isAdmin();
    }
    
    // Date overrides - property owner and admins only
    match /dateOverrides/{docId} {
      allow read: if true;
      allow write: if request.auth != null && 
        (resourceData().propertyId == propertyId && 
         get(/databases/$(database)/documents/properties/$(propertyId)).data.ownerId == request.auth.uid) ||
        isAdmin();
    }
    
    // Minimum stay rules - property owner and admins only
    match /minimumStayRules/{docId} {
      allow read: if true;
      allow write: if request.auth != null && 
        (resourceData().propertyId == propertyId && 
         get(/databases/$(database)/documents/properties/$(propertyId)).data.ownerId == request.auth.uid) ||
        isAdmin();
    }
    
    // Holidays - read-only for users, admin-managed
    match /holidays/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // Pricing templates - read-only for users, admin-managed
    match /pricingTemplates/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // Price calendar - generated by system, read-only
    match /priceCalendar/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // Utility functions
    function resourceData() {
      return resource != null ? resource.data : null;
    }
    
    function isAdmin() {
      return request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## Implementation Approach

### Phase 1: Core Structure

1. **Update Property Schema**:
   - Add `pricingConfig` field to property documents
   - Implement backward compatibility layer

2. **Create Basic Collections**:
   - Set up `seasonalPricing` and `dateOverrides` collections
   - Implement basic CRUD operations

3. **Calendar View**:
   - Develop a calendar UI that shows base prices
   - Allow setting custom prices for specific dates

### Phase 2: Price Calendar Generation

1. **Generation Engine**:
   - Implement the core price calculation engine
   - Create the scheduled job for nightly generation
   - Build support for pre-calculating different occupancy prices
   - Handle flat-rate vs. variable pricing elegantly

2. **Availability Integration**:
   - Connect the booking system to the price calendar
   - Ensure availability is updated in real-time
   - Integrate minimum stay validation

3. **Calendar API**:
   - Create efficient API endpoints for retrieving calendar data
   - Implement date-range spanning logic for multi-month bookings
   - Add support for specific occupancy level retrieval

### Phase 3: Advanced Features

1. **Length-of-Stay Discounts**:
   - Add discount tier configuration
   - Integrate with booking workflow
   - Update booking summary to show applicable discounts

2. **Admin Tools**:
   - Develop holiday management interface
   - Create and manage pricing templates
   - Add bulk operations for pricing updates

3. **Analytics**:
   - Track booking patterns in relation to pricing
   - Provide basic reporting on pricing effectiveness

## Migration Path

To transition from the current system:

1. **Schema Preparation**:
   - Create new collections without disrupting existing functionality
   - Add new fields to property documents with defaults

2. **Data Population**:
   - For each property, create basic seasonal periods based on industry standards
   - Generate initial price calendars with base property prices
   - Pre-calculate occupancy-specific pricing for all dates

3. **Feature Rollout**:
   - Incrementally release new pricing features
   - Maintain backward compatibility throughout

## Summary

This simplified Firestore structure provides:

1. **Pre-calculated Performance**: Pre-calculated prices for different occupancy levels for fast retrieval
2. **Efficient Flat-Rate Handling**: Special dates have consistent pricing across all occupancy levels
3. **Combined Price & Availability**: Single source of truth for both pricing and booking status
4. **Practical Flexibility**: Covers the most common pricing needs (seasonal, weekend, special dates)
5. **User-Friendly Design**: Straightforward concepts that match how property owners think
6. **Future-Proofing**: Room to extend with additional features as needed

The design focuses on simplicity and performance while providing the essential flexibility required for vacation rental pricing, without overwhelming users with complexity.