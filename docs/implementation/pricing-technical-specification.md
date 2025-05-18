# Pricing System Technical Specification

This document provides technical details for implementing the new pricing system in RentalSpot-Builder. It serves as a reference for developers working on the implementation.

## System Architecture

### Core Components

1. **Price Calculation Engine**
   - Pure TypeScript module for deterministic pricing calculations
   - Handles all pricing rule applications in the correct order
   - Used by both background jobs and real-time services

2. **Price Calendar Generator**
   - Background service that generates and updates price calendars
   - Runs on a schedule and in response to pricing rule changes
   - Processes property pricing monthly up to 12 months ahead

3. **Availability Service**
   - Handles real-time availability checking
   - Integrates prices with availability status
   - Provides optimized endpoints for booking operations

4. **Admin Management Interface**
   - React components for pricing configuration
   - Visual tools for seasonal pricing and date overrides
   - Price preview and simulation capabilities

## Data Models

### Property Pricing Configuration

This extends the existing property document with pricing configuration:

```typescript
interface PricingConfig {
  weekendAdjustment: number;       // Multiplier for weekend prices (e.g., 1.2 for 20% more)
  weekendDays: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  lengthOfStayDiscounts?: LengthOfStayDiscount[];
}

interface LengthOfStayDiscount {
  nightsThreshold: number;         // Minimum nights to qualify (e.g., 7)
  discountPercentage: number;      // Discount percentage (0-100)
  enabled: boolean;                // Whether this tier is active
}

// Update to Property interface
interface Property {
  // Existing fields...
  pricePerNight: number;
  baseCurrency: CurrencyCode;
  baseOccupancy: number;
  extraGuestFee?: number;
  
  // New field
  pricingConfig?: PricingConfig;
}
```

### Seasonal Pricing

```typescript
interface SeasonalPricing {
  id: string;                      // Auto-generated or property_seasonName
  propertyId: string;              // Reference to property
  name: string;                    // Display name (e.g., "Summer 2023")
  seasonType: 'minimum' | 'low' | 'standard' | 'medium' | 'high';
  startDate: string;               // ISO format "YYYY-MM-DD"
  endDate: string;                 // ISO format "YYYY-MM-DD"
  priceMultiplier: number;         // Price multiplier (e.g., 1.5 for high season)
  minimumStay?: number;            // Minimum nights required
  enabled: boolean;                // Whether this season is active
  notes?: string;                  // Optional notes
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Predefined multipliers by season type
const SEASON_MULTIPLIERS = {
  'minimum': 0.7,
  'low': 0.85,
  'standard': 1.0,
  'medium': 1.2,
  'high': 1.5
};
```

### Date Overrides

```typescript
interface DateOverride {
  id: string;                      // Format: propertyId_YYYY-MM-DD
  propertyId: string;              // Reference to property
  date: string;                    // ISO format "YYYY-MM-DD"
  customPrice: number;             // Absolute price (not a multiplier)
  reason?: string;                 // Reason for override (e.g., "New Year's Eve")
  minimumStay?: number;            // Override minimum stay requirement
  available: boolean;              // Can mark as unavailable
  flatRate: boolean;               // Whether price applies regardless of guests
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Price Calendar

```typescript
interface PriceCalendarDay {
  baseOccupancyPrice: number;      // Price for base occupancy
  prices: Record<string, number>;  // Price for specific occupancies
  available: boolean;              // Whether this date is available
  minimumStay: number;             // Minimum nights required
  priceSource: 'base' | 'weekend' | 'season' | 'override';
  sourceDetails?: any;             // Additional details about price source
}

interface PriceCalendarSummary {
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  unavailableDays: number;
  modifiedDays: number;
  hasCustomPrices: boolean;
  hasSeasonalRates: boolean;
}

interface PriceCalendar {
  id: string;                      // Format: propertyId_YYYY-MM
  propertyId: string;              // Reference to property
  month: string;                   // Format: "YYYY-MM"
  year: number;                    // Year as number
  days: Record<string, PriceCalendarDay>; // Day number to price data
  summary: PriceCalendarSummary;
  generatedAt: Timestamp;
}
```

## Core Functions

### Price Calculation

```typescript
/**
 * Calculates the final price for a specific date based on all pricing rules
 */
function calculateDayPrice(
  property: Property,
  date: Date,
  seasonalPricing: SeasonalPricing[],
  dateOverrides: DateOverride[],
  minimumStayRules: MinimumStayRule[]
): PriceCalendarDay {
  // 1. Start with base price
  let basePrice = property.pricePerNight;
  let priceSource = 'base';
  let sourceDetails = null;
  let minimumStay = 1;

  // 2. Check if it's a weekend
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'lowercase' });
  const isWeekend = property.pricingConfig?.weekendDays.includes(dayOfWeek) || false;
  
  if (isWeekend && property.pricingConfig?.weekendAdjustment) {
    basePrice *= property.pricingConfig.weekendAdjustment;
    priceSource = 'weekend';
  }
  
  // 3. Apply seasonal pricing (if applicable)
  const matchingSeason = findMatchingSeason(date, seasonalPricing);
  if (matchingSeason) {
    basePrice *= matchingSeason.priceMultiplier;
    priceSource = 'season';
    sourceDetails = {
      name: matchingSeason.name,
      id: matchingSeason.id
    };
    
    if (matchingSeason.minimumStay) {
      minimumStay = matchingSeason.minimumStay;
    }
  }
  
  // 4. Apply date override (if exists - highest priority)
  const dateOverride = findDateOverride(date, dateOverrides);
  if (dateOverride) {
    basePrice = dateOverride.customPrice;
    priceSource = 'override';
    sourceDetails = {
      reason: dateOverride.reason,
      id: dateOverride.id
    };
    
    if (dateOverride.minimumStay) {
      minimumStay = dateOverride.minimumStay;
    }
  }
  
  // 5. Apply minimum stay rules
  const matchingMinStayRule = findMatchingMinStayRule(date, minimumStayRules);
  if (matchingMinStayRule) {
    minimumStay = matchingMinStayRule.minimumStay;
  }
  
  // 6. Calculate prices for different occupancy levels
  const occupancyPrices = calculateOccupancyPrices(
    basePrice, 
    property.baseOccupancy, 
    property.extraGuestFee || 0,
    property.maxGuests || 10,
    dateOverride?.flatRate || false
  );
  
  // 7. Return the final price calendar day
  return {
    baseOccupancyPrice: basePrice,
    prices: occupancyPrices,
    available: dateOverride ? dateOverride.available : true,
    minimumStay,
    priceSource,
    sourceDetails
  };
}

/**
 * Calculate prices for different occupancy levels
 */
function calculateOccupancyPrices(
  basePrice: number,
  baseOccupancy: number,
  extraGuestFee: number,
  maxGuests: number,
  flatRate: boolean
): Record<string, number> {
  const result: Record<string, number> = {};
  
  // Start from baseOccupancy + 1 and go up to maxGuests
  for (let guests = baseOccupancy + 1; guests <= maxGuests; guests++) {
    if (flatRate) {
      // Same price for all occupancy levels
      result[guests.toString()] = basePrice;
    } else {
      // Apply extra guest fee
      const extraGuests = guests - baseOccupancy;
      result[guests.toString()] = basePrice + (extraGuests * extraGuestFee);
    }
  }
  
  return result;
}
```

### Calendar Generation

```typescript
/**
 * Generates a price calendar for a specific property and month
 */
async function generatePriceCalendar(
  propertyId: string,
  year: number,
  month: number
): Promise<PriceCalendar> {
  // 1. Fetch all required data
  const property = await getProperty(propertyId);
  const seasonalPricing = await getSeasonalPricing(propertyId);
  const dateOverrides = await getDateOverrides(propertyId, year, month);
  const minimumStayRules = await getMinimumStayRules(propertyId);
  const bookings = await getBookingsForMonth(propertyId, year, month);
  
  // 2. Calculate the calendar days
  const days: Record<string, PriceCalendarDay> = {};
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // Statistics tracking
  let minPrice = Infinity;
  let maxPrice = 0;
  let totalPrice = 0;
  let unavailableDays = 0;
  let modifiedDays = 0;
  let hasCustomPrices = false;
  let hasSeasonalRates = false;
  
  // Process each day in the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    
    // Calculate price based on all rules
    const dayPrice = calculateDayPrice(
      property,
      date,
      seasonalPricing,
      dateOverrides,
      minimumStayRules
    );
    
    // Check booking status
    dayPrice.available = !isDateBooked(date, bookings);
    
    // Update statistics
    if (!dayPrice.available) {
      unavailableDays++;
    }
    
    if (dayPrice.priceSource !== 'base') {
      modifiedDays++;
    }
    
    if (dayPrice.priceSource === 'override') {
      hasCustomPrices = true;
    }
    
    if (dayPrice.priceSource === 'season') {
      hasSeasonalRates = true;
    }
    
    minPrice = Math.min(minPrice, dayPrice.baseOccupancyPrice);
    maxPrice = Math.max(maxPrice, dayPrice.baseOccupancyPrice);
    totalPrice += dayPrice.baseOccupancyPrice;
    
    // Add to days collection
    days[day.toString()] = dayPrice;
  }
  
  // 3. Create summary
  const summary: PriceCalendarSummary = {
    minPrice,
    maxPrice,
    avgPrice: totalPrice / daysInMonth,
    unavailableDays,
    modifiedDays,
    hasCustomPrices,
    hasSeasonalRates
  };
  
  // 4. Create and return the calendar
  const monthStr = month.toString().padStart(2, '0');
  return {
    id: `${propertyId}_${year}-${monthStr}`,
    propertyId,
    month: `${year}-${monthStr}`,
    year,
    days,
    summary,
    generatedAt: Timestamp.now()
  };
}
```

## API Endpoints

### Availability Checking

```typescript
/**
 * Check availability for a date range with pricing
 */
interface AvailabilityRequest {
  propertyId: string;
  checkIn: string;  // YYYY-MM-DD format
  checkOut: string; // YYYY-MM-DD format
  guests: number;
}

interface AvailabilityResponse {
  available: boolean;
  minimumStay: number;
  pricing: {
    basePrice: number;
    extraGuestFee: number;
    nightlyRates: Record<string, number>;
    cleaningFee: number;
    subtotal: number;
    total: number;
    currency: string;
  };
  unavailableDates?: string[];
  alternatives?: {
    earlierDates?: { checkIn: string; checkOut: string }[];
    laterDates?: { checkIn: string; checkOut: string }[];
  };
}

/**
 * Implementation (pseudo-code)
 */
async function checkAvailability(req: AvailabilityRequest): Promise<AvailabilityResponse> {
  const { propertyId, checkIn, checkOut, guests } = req;
  
  // 1. Parse dates
  const checkInDate = parseISO(checkIn);
  const checkOutDate = parseISO(checkOut);
  
  // 2. Get months that need to be queried
  const months = getMonthsBetweenDates(checkInDate, checkOutDate);
  
  // 3. Fetch price calendars for all required months
  const priceCalendars = await Promise.all(
    months.map(({ year, month }) => 
      getPriceCalendar(propertyId, year, month)
    )
  );
  
  // 4. Extract day data for the date range
  const days = extractDaysFromCalendars(priceCalendars, checkInDate, checkOutDate);
  
  // 5. Check if all dates are available
  const allAvailable = days.every(day => day.available);
  
  // 6. Check minimum stay requirement
  const firstDay = days[0];
  const minimumStay = firstDay.minimumStay;
  const nightsRequested = differenceInDays(checkOutDate, checkInDate);
  
  // 7. Calculate pricing based on guest count
  const property = await getProperty(propertyId);
  const cleaningFee = property.cleaningFee || 0;
  const currency = property.baseCurrency;
  
  const nightlyRates: Record<string, number> = {};
  let subtotal = 0;
  
  days.forEach((day, index) => {
    const date = addDays(checkInDate, index);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Get price for requested guest count
    let price = day.baseOccupancyPrice;
    if (guests > property.baseOccupancy) {
      const guestPrice = day.prices[guests.toString()];
      if (guestPrice) {
        price = guestPrice;
      }
    }
    
    nightlyRates[dateStr] = price;
    subtotal += price;
  });
  
  const total = subtotal + cleaningFee;
  
  // 8. Create response
  const response: AvailabilityResponse = {
    available: allAvailable && nightsRequested >= minimumStay,
    minimumStay,
    pricing: {
      basePrice: property.pricePerNight,
      extraGuestFee: property.extraGuestFee || 0,
      nightlyRates,
      cleaningFee,
      subtotal,
      total,
      currency
    }
  };
  
  // 9. Add unavailable dates if any
  if (!allAvailable) {
    response.unavailableDates = days
      .filter(day => !day.available)
      .map((_, index) => format(addDays(checkInDate, index), 'yyyy-MM-dd'));
  }
  
  // 10. Add alternative dates if not available
  if (!allAvailable || nightsRequested < minimumStay) {
    response.alternatives = findAlternativeDates(propertyId, checkInDate, checkOutDate, nightsRequested);
  }
  
  return response;
}
```

## Background Jobs

### Price Calendar Generator Cron Job

```typescript
/**
 * Scheduled job that runs nightly to update price calendars
 */
export async function updatePriceCalendars() {
  // 1. Get all active properties
  const properties = await getAllActiveProperties();
  
  // 2. Get current date for reference
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  // 3. Process each property
  for (const property of properties) {
    // Generate calendars for the next 12 months
    for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
      const targetDate = addMonths(new Date(currentYear, currentMonth - 1, 1), monthOffset);
      const targetYear = targetDate.getFullYear();
      const targetMonth = targetDate.getMonth() + 1;
      
      try {
        const calendar = await generatePriceCalendar(property.id, targetYear, targetMonth);
        await savePriceCalendar(calendar);
        console.log(`Generated calendar for ${property.id} - ${targetYear}-${targetMonth}`);
      } catch (error) {
        console.error(`Failed to generate calendar for ${property.id} - ${targetYear}-${targetMonth}:`, error);
        // Handle error, potentially retry or alert
      }
    }
  }
  
  console.log('Price calendar update completed');
}
```

### Event-Based Updates

```typescript
/**
 * Trigger price calendar updates when pricing rules change
 */
export async function handlePricingRuleChange(
  propertyId: string,
  startDate: Date,
  endDate: Date
) {
  // 1. Identify affected months
  const months = getMonthsBetweenDates(startDate, endDate);
  
  // 2. Update each affected month
  for (const { year, month } of months) {
    try {
      const calendar = await generatePriceCalendar(propertyId, year, month);
      await savePriceCalendar(calendar);
      console.log(`Updated calendar for ${propertyId} - ${year}-${month} due to rule change`);
    } catch (error) {
      console.error(`Failed to update calendar for ${propertyId} - ${year}-${month}:`, error);
      // Handle error
    }
  }
}

/**
 * Update availability when bookings change
 */
export async function handleBookingStatusChange(
  propertyId: string,
  checkInDate: Date,
  checkOutDate: Date,
  isBooked: boolean
) {
  // 1. Identify affected months
  const months = getMonthsBetweenDates(checkInDate, checkOutDate);
  
  // 2. Update each affected month
  for (const { year, month } of months) {
    try {
      // Get existing calendar
      const existingCalendar = await getPriceCalendar(propertyId, year, month);
      
      // Update availability for affected dates
      let updated = false;
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      
      // For each day in the booking
      let currentDate = max([checkInDate, monthStart]);
      const lastDate = min([checkOutDate, monthEnd]);
      
      while (currentDate < lastDate) {
        const day = currentDate.getDate().toString();
        if (existingCalendar.days[day]) {
          existingCalendar.days[day].available = !isBooked;
          updated = true;
        }
        currentDate = addDays(currentDate, 1);
      }
      
      // Update summary if needed
      if (updated) {
        // Recalculate summary
        existingCalendar.summary.unavailableDays = Object.values(existingCalendar.days)
          .filter(day => !day.available).length;
        
        // Save updated calendar
        existingCalendar.generatedAt = Timestamp.now();
        await savePriceCalendar(existingCalendar);
        console.log(`Updated availability for ${propertyId} - ${year}-${month}`);
      }
    } catch (error) {
      console.error(`Failed to update availability for ${propertyId} - ${year}-${month}:`, error);
      // Handle error
    }
  }
}
```

## Database Indexes

To optimize query performance, create the following Firestore indexes:

1. **seasonalPricing**
   - Compound index on `propertyId`, `startDate`, `endDate`
   - Compound index on `propertyId`, `enabled`

2. **dateOverrides**
   - Compound index on `propertyId`, `date`

3. **minimumStayRules**
   - Compound index on `propertyId`, `startDate`, `endDate`
   - Compound index on `propertyId`, `enabled`

4. **priceCalendar**
   - Compound index on `propertyId`, `month`

## Security Considerations

1. **Data Validation**
   - Validate pricing inputs to prevent unrealistic values
   - Ensure date ranges are valid (start before end)
   - Validate currency codes against supported list

2. **Access Control**
   - Restrict pricing rule modifications to property owners and admins
   - Make price calendars read-only for regular users
   - Implement row-level security for multi-tenant operations

3. **Error Handling**
   - Implement robust error handling for pricing calculations
   - Add fallback logic if price calendars are missing
   - Include monitoring and alerting for failed calendar generation

## Frontend Components

### Price Calendar Display

```tsx
interface PriceCalendarProps {
  propertyId: string;
  selectedMonth: Date;
  selectedGuests: number;
  onDateSelect: (date: Date) => void;
}

const PriceCalendar: React.FC<PriceCalendarProps> = ({
  propertyId,
  selectedMonth,
  selectedGuests,
  onDateSelect
}) => {
  const [calendar, setCalendar] = useState<PriceCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchCalendar = async () => {
      setLoading(true);
      try {
        const year = selectedMonth.getFullYear();
        const month = selectedMonth.getMonth() + 1;
        const data = await fetchPriceCalendar(propertyId, year, month);
        setCalendar(data);
      } catch (error) {
        console.error('Error fetching price calendar:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCalendar();
  }, [propertyId, selectedMonth]);
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!calendar) {
    return <ErrorMessage message="Could not load pricing information" />;
  }
  
  // Render calendar grid
  return (
    <div className="price-calendar">
      <div className="calendar-header">
        {/* Weekday headers */}
      </div>
      <div className="calendar-body">
        {Array.from({ length: getWeeksInMonth(selectedMonth) }).map((_, weekIndex) => (
          <div key={`week-${weekIndex}`} className="calendar-week">
            {Array.from({ length: 7 }).map((_, dayIndex) => {
              const date = new Date(
                selectedMonth.getFullYear(),
                selectedMonth.getMonth(),
                1 + weekIndex * 7 + dayIndex - getFirstDayOfMonth(selectedMonth)
              );
              
              // Skip days not in this month
              if (date.getMonth() !== selectedMonth.getMonth()) {
                return <div key={`day-${dayIndex}`} className="calendar-day empty" />;
              }
              
              const day = date.getDate().toString();
              const dayData = calendar.days[day];
              
              if (!dayData) {
                return <div key={`day-${dayIndex}`} className="calendar-day" />;
              }
              
              // Get price for selected guest count or base price
              let price = dayData.baseOccupancyPrice;
              if (selectedGuests > 0) {
                const guestPrice = dayData.prices[selectedGuests.toString()];
                if (guestPrice) {
                  price = guestPrice;
                }
              }
              
              return (
                <div
                  key={`day-${dayIndex}`}
                  className={`calendar-day ${!dayData.available ? 'unavailable' : ''} ${dayData.priceSource !== 'base' ? dayData.priceSource : ''}`}
                  onClick={() => dayData.available && onDateSelect(date)}
                >
                  <div className="day-number">{date.getDate()}</div>
                  <div className="day-price">{formatCurrency(price, calendar.currency)}</div>
                  {dayData.minimumStay > 1 && (
                    <div className="min-stay">{dayData.minimumStay}+ nights</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Testing Strategy

### Unit Tests

1. **Price Calculation**
   - Test base price calculation
   - Test weekend adjustments
   - Test seasonal price application
   - Test date override priority
   - Test occupancy-based pricing
   - Test flat-rate special dates

2. **Calendar Generation**
   - Test calendar generation for various scenarios
   - Test month boundary conditions
   - Test availability updates

### Integration Tests

1. **Availability API**
   - Test availability checking across month boundaries
   - Test minimum stay enforcement
   - Test price aggregation for booking spans

2. **Booking Integration**
   - Test booking creation with price lookup
   - Test availability updates after booking
   - Test length-of-stay discount application

### End-to-End Tests

1. **Admin Operations**
   - Test seasonal pricing creation and updates
   - Test date override management
   - Test pricing preview accuracy

2. **Booking Flow**
   - Test complete booking flow with pricing
   - Test different occupancy scenarios
   - Test special date bookings

## Migration Considerations

1. **Preserve existing price fields** in Property documents for backward compatibility
2. **Generate price calendars in advance** before switching systems
3. **Run parallel pricing calculation** during transition to validate correctness
4. **Provide fallback mechanisms** if the new system encounters errors

## Monitoring and Maintenance

1. **Key Metrics to Monitor**
   - Price calendar generation time and success rate
   - Availability API response time
   - Error rates in pricing calculations
   - Calendar storage size growth

2. **Maintenance Tasks**
   - Regular validation of currency exchange rates
   - Cleanup of old price calendar documents
   - Performance optimization for large property sets
   - Regular audit of pricing rule consistency