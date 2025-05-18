# Pricing Management Admin UI Design

This document outlines the design for a new admin interface that allows property managers to configure and manage dynamic pricing for their properties.

## Overview

The pricing management UI will be integrated into the existing admin section, providing property owners with tools to:

1. Set base rates for their properties
2. Configure seasonal pricing periods
3. Apply day-of-week adjustments (e.g., weekend pricing)
4. Add special event pricing
5. Visualize pricing across a calendar view

## UI Components

### 1. Pricing Dashboard

**Location**: New tab in property edit page (`/admin/properties/[slug]/edit`)

**Features**:
- Summary of current pricing strategy
- Quick statistics on rate variations
- Overview of upcoming seasonal adjustments
- Quick links to different pricing tools

![Pricing Dashboard Mockup](../assets/pricing-dashboard-mockup.png)

```tsx
// Component structure
<PricingDashboard>
  <BaseRateSummary />
  <SeasonalPricingOverview />
  <SpecialEventsList />
  <WeekendPricingStatus />
  <LengthOfStayDiscountSummary />
</PricingDashboard>
```

### 2. Base Rate Editor

**Purpose**: Set and modify the default nightly rate

**Features**:
- Input for base price per night
- Select base currency
- Set cleaning fee
- Configure base occupancy and extra guest fees

```tsx
// Component structure
<BaseRateEditor
  propertyId={property.id}
  initialBaseRate={property.pricePerNight}
  initialCurrency={property.baseCurrency}
  initialCleaningFee={property.cleaningFee}
  initialBaseOccupancy={property.baseOccupancy}
  initialExtraGuestFee={property.extraGuestFee}
  onSave={handleSaveBaseRates}
/>
```

### 3. Calendar-Based Pricing UI

**Purpose**: Visual interface for setting date-specific prices

**Features**:
- Interactive calendar showing all dates for the next 12 months
- Color-coded indicators for different price levels
- Click or drag to select date ranges
- Set price modifiers for selected dates
- View actual calculated prices based on modifiers

![Calendar Pricing UI Mockup](../assets/calendar-pricing-mockup.png)

```tsx
// Component structure
<PricingCalendar
  propertyId={property.id}
  basePrice={property.pricePerNight}
  existingModifiers={pricingModifiers}
  onModifierChange={handleModifierChange}
/>
```

### 4. Seasonal Pricing Manager

**Purpose**: Define and manage recurring seasonal periods

**Features**:
- Create named seasons (e.g., "Summer High Season")
- Set date ranges for each season
- Apply price multipliers for each season
- Option to copy seasons year to year
- Visualize seasonal overlaps

```tsx
// Component structure
<SeasonalPricingManager
  propertyId={property.id}
  basePrice={property.pricePerNight}
  existingSeasons={seasons}
  onSeasonChange={handleSeasonChange}
  onSeasonDelete={handleSeasonDelete}
/>
```

```typescript
// Season data structure
interface Season {
  id: string;
  name: string;
  startDate: string; // MM-DD format for recurring yearly
  endDate: string;   // MM-DD format
  priceMultiplier: number;
  minimumStay?: number;
  color?: string; // For UI display
}
```

### 5. Day-of-Week Adjustment Panel

**Purpose**: Set different prices for specific days of the week

**Features**:
- Individual controls for each day of the week
- Set percentage or fixed adjustments
- Option to apply only during specific seasons
- Weekend vs. weekday quick presets

```tsx
// Component structure
<DayOfWeekAdjustments
  propertyId={property.id}
  basePrice={property.pricePerNight}
  existingAdjustments={dayAdjustments}
  onAdjustmentChange={handleDayAdjustmentChange}
/>
```

### 6. Special Event Pricing Tool

**Purpose**: Configure one-time pricing for special events

**Features**:
- Create named events (e.g., "New Year's Eve 2023")
- Set specific date ranges
- Apply price multipliers
- Option to increase minimum stay requirements
- Priority settings for overlapping rules

```tsx
// Component structure
<SpecialEventPricing
  propertyId={property.id}
  basePrice={property.pricePerNight}
  existingEvents={specialEvents}
  onEventChange={handleEventChange}
  onEventDelete={handleEventDelete}
/>
```

### 7. Bulk Update Tool

**Purpose**: Make mass updates to pricing

**Features**:
- Select date ranges or full seasons
- Apply percentage or fixed adjustments
- Preview changes before applying
- Reset to base pricing option

```tsx
// Component structure
<BulkPricingUpdate
  propertyId={property.id}
  basePrice={property.pricePerNight}
  existingModifiers={pricingModifiers}
  onBulkUpdate={handleBulkUpdate}
/>
```

## Data Flow and Architecture

### Component Relationships

```
Property Admin Page
└─ Pricing Tab
   ├─ PricingDashboard (summary and navigation)
   ├─ BaseRateEditor (core pricing settings)
   ├─ PricingCalendar (visual date-based interface)
   │  └─ DateSelector (reusable date range selection)
   ├─ SeasonalPricingManager (recurring seasons)
   │  └─ SeasonEditor (individual season configuration)
   ├─ SpecialEventPricing (one-time events)
   │  └─ EventEditor (individual event configuration)
   └─ BulkPricingUpdate (mass changes)
```

### Data Storage

1. **Base Property Data**:
   - Continue storing in Firestore `properties` collection
   - No schema changes needed

2. **Pricing Modifiers**:
   - Store in `availability` documents as currently designed
   - Create efficient storage pattern for potentially sparse data

3. **Seasons and Events**:
   - New `pricingConfigs` subcollection under each property
   - Separate documents for different configuration types

```typescript
// Example pricing configuration structure
interface PropertyPricingConfig {
  propertyId: string;
  type: 'season' | 'event' | 'dayOfWeek' | 'lengthOfStay';
  name: string;
  config: any; // Type-specific configuration
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### API Endpoints

1. **Base Rate Management**:
   - `PUT /api/admin/properties/:propertyId/pricing/base`

2. **Date-Specific Pricing**:
   - `GET /api/admin/properties/:propertyId/pricing/modifiers`
   - `PUT /api/admin/properties/:propertyId/pricing/modifiers`

3. **Seasonal Configuration**:
   - `GET /api/admin/properties/:propertyId/pricing/seasons`
   - `POST /api/admin/properties/:propertyId/pricing/seasons`
   - `PUT /api/admin/properties/:propertyId/pricing/seasons/:seasonId`
   - `DELETE /api/admin/properties/:propertyId/pricing/seasons/:seasonId`

4. **Events Management**:
   - `GET /api/admin/properties/:propertyId/pricing/events`
   - `POST /api/admin/properties/:propertyId/pricing/events`
   - `PUT /api/admin/properties/:propertyId/pricing/events/:eventId`
   - `DELETE /api/admin/properties/:propertyId/pricing/events/:eventId`

5. **Batch Operations**:
   - `POST /api/admin/properties/:propertyId/pricing/batch`

## User Experience

### Workflow Examples

**1. Setting up Seasonal Pricing**:
1. Navigate to property pricing tab
2. Click "Add Season" in seasonal pricing section
3. Enter season name, dates, and price multiplier
4. Save season configuration
5. View calendar to confirm seasonal prices

**2. Adjusting Weekend Rates**:
1. Navigate to day-of-week adjustment panel
2. Set Friday and Saturday to 1.2x multiplier
3. Preview changes in calendar view
4. Save configuration
5. Confirm weekend dates show higher prices

**3. Creating a Holiday Special**:
1. Navigate to special events section
2. Click "Add Special Event"
3. Enter "Christmas 2023", dates Dec 20-27, 1.5x multiplier
4. Set minimum stay to 3 nights
5. Save event
6. Confirm Christmas period shows higher prices and minimum stay

## Implementation Phases

### Phase 1: Core Pricing UI
- Base rate editor
- Simple calendar view with manual modifier setting
- API endpoints for updating property base rates

### Phase 2: Seasonal Pricing
- Season definition UI
- Integration with calendar view
- Season calculation and application logic

### Phase 3: Advanced Features
- Day-of-week adjustments
- Special events
- Bulk update tools
- Analytics integration

## Technical Considerations

1. **Performance**:
   - Calendar view could potentially render thousands of dates
   - Need efficient data structure for sparse pricing data
   - Consider virtualized rendering for large calendars

2. **Concurrency**:
   - Multiple pricing rules may apply to the same dates
   - Need clear priority system for overlapping rules
   - Validation to prevent contradictory configurations

3. **User Experience**:
   - Real-time feedback on price changes
   - Clear visual indicators of different pricing rules
   - Undo/redo functionality for pricing changes

## Wireframes

(Placeholder for wireframe images that would be included in an actual documentation)