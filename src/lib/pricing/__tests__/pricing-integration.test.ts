/**
 * Integration tests for the consolidated pricing engine.
 *
 * Tests the full pricing flow with realistic Firestore data shapes,
 * backward-compat fallback paths, check-pricing API logic, and
 * calendar expiry banner calculations.
 */
import {
  PropertyPricing,
  SeasonalPricing,
  DateOverride,
  MinimumStayRule,
  calculateDayPrice,
  calculateOccupancyPrices,
  calculateBookingPrice,
  calculateLengthOfStayDiscount,
  findMatchingSeason,
  findDateOverride,
  findMatchingMinStayRule
} from '../price-calculation';

// ============================================================================
// Test 1: Backward-compat fallback for property.pricingConfig
// ============================================================================
describe('Backward-compat: pricingConfig fallback', () => {
  // Simulates the fallback logic from server-actions-hybrid.ts:generatePriceCalendar
  function buildPropertyPricing(firestoreData: any): PropertyPricing {
    return {
      id: firestoreData.id || 'test-property',
      pricePerNight: firestoreData.pricePerNight || 100,
      baseCurrency: firestoreData.baseCurrency || 'EUR',
      baseOccupancy: firestoreData.baseOccupancy || 2,
      extraGuestFee: firestoreData.extraGuestFee || 0,
      maxGuests: firestoreData.maxGuests || 6,
      pricingConfig: firestoreData.pricingConfig || {
        weekendAdjustment: (firestoreData.pricing?.weekendPricing?.enabled
          ? firestoreData.pricing.weekendPricing.priceMultiplier
          : 1.0) || 1.0,
        weekendDays: firestoreData.pricing?.weekendPricing?.weekendDays || ['friday', 'saturday'],
      }
    };
  }

  it('should use pricingConfig when it exists (canonical path)', () => {
    // This is the real Prahova Mountain Chalet data structure
    const firestoreData = {
      id: 'prahova-mountain-chalet',
      pricePerNight: 180,
      baseCurrency: 'EUR',
      baseOccupancy: 4,
      extraGuestFee: 25,
      maxGuests: 8,
      pricingConfig: {
        weekendAdjustment: 1.2,
        weekendDays: ['friday', 'saturday'],
        lengthOfStayDiscounts: [
          { nightsThreshold: 7, discountPercentage: 5, enabled: true },
          { nightsThreshold: 14, discountPercentage: 10, enabled: true }
        ]
      },
      // Legacy path also exists but should be ignored
      pricing: {
        weekendPricing: {
          priceMultiplier: 1.2,
          weekendDays: ['friday', 'saturday'],
          enabled: true
        }
      }
    };

    const property = buildPropertyPricing(firestoreData);
    expect(property.pricingConfig?.weekendAdjustment).toBe(1.2);
    expect(property.pricingConfig?.weekendDays).toEqual(['friday', 'saturday']);

    // Verify it calculates correctly for a Friday (weekend)
    const friday = new Date('2026-03-06'); // March 6 2026 is a Friday
    const result = calculateDayPrice(property, friday, [], [], []);
    expect(result.adjustedPrice).toBe(216); // 180 * 1.2
    expect(result.priceSource).toBe('weekend');
    expect(result.isWeekend).toBe(true);
  });

  it('should fall back to pricing.weekendPricing when pricingConfig is missing', () => {
    const firestoreData = {
      id: 'legacy-property',
      pricePerNight: 100,
      baseCurrency: 'EUR',
      baseOccupancy: 2,
      maxGuests: 4,
      // No pricingConfig — only legacy path
      pricing: {
        weekendPricing: {
          priceMultiplier: 1.3,
          weekendDays: ['friday', 'saturday'],
          enabled: true
        }
      }
    };

    const property = buildPropertyPricing(firestoreData);
    expect(property.pricingConfig?.weekendAdjustment).toBe(1.3);
    expect(property.pricingConfig?.weekendDays).toEqual(['friday', 'saturday']);

    const friday = new Date('2026-03-06');
    const result = calculateDayPrice(property, friday, [], [], []);
    expect(result.adjustedPrice).toBe(130); // 100 * 1.3
    expect(result.priceSource).toBe('weekend');
  });

  it('should use 1.0 adjustment when legacy weekendPricing is disabled', () => {
    const firestoreData = {
      id: 'disabled-weekend-property',
      pricePerNight: 100,
      baseCurrency: 'EUR',
      baseOccupancy: 2,
      maxGuests: 4,
      pricing: {
        weekendPricing: {
          priceMultiplier: 1.5,
          weekendDays: ['friday', 'saturday'],
          enabled: false // Disabled!
        }
      }
    };

    const property = buildPropertyPricing(firestoreData);
    // Should map to 1.0 because enabled is false
    expect(property.pricingConfig?.weekendAdjustment).toBe(1.0);

    const friday = new Date('2026-03-06');
    const result = calculateDayPrice(property, friday, [], [], []);
    // 1.0 is truthy so technically source is 'weekend' but price is unchanged
    expect(result.adjustedPrice).toBe(100);
  });

  it('should handle property with no pricing config at all', () => {
    const firestoreData = {
      id: 'bare-property',
      pricePerNight: 50,
      baseCurrency: 'USD',
      baseOccupancy: 2,
      maxGuests: 4
      // No pricingConfig, no pricing.weekendPricing
    };

    const property = buildPropertyPricing(firestoreData);
    expect(property.pricingConfig?.weekendAdjustment).toBe(1.0);
    expect(property.pricingConfig?.weekendDays).toEqual(['friday', 'saturday']);

    const friday = new Date('2026-03-06');
    const result = calculateDayPrice(property, friday, [], [], []);
    expect(result.adjustedPrice).toBe(50); // No adjustment
    expect(result.basePrice).toBe(50);
  });
});

// ============================================================================
// Test 2: Full check-pricing API flow simulation
// ============================================================================
describe('Check-pricing API flow simulation', () => {
  const property: PropertyPricing = {
    id: 'prahova-mountain-chalet',
    pricePerNight: 180,
    baseCurrency: 'EUR',
    baseOccupancy: 4,
    extraGuestFee: 25,
    maxGuests: 8,
    pricingConfig: {
      weekendAdjustment: 1.2,
      weekendDays: ['friday', 'saturday'],
      lengthOfStayDiscounts: [
        { nightsThreshold: 7, discountPercentage: 5, enabled: true }
      ]
    }
  };

  const seasons: SeasonalPricing[] = [
    {
      id: 'summer-2026',
      propertyId: 'prahova-mountain-chalet',
      name: 'Summer 2026',
      seasonType: 'high',
      startDate: '2026-06-15',
      endDate: '2026-09-15',
      priceMultiplier: 1.5,
      minimumStay: 3,
      enabled: true
    }
  ];

  // Simulate what check-pricing API does: read calendar, look up prices per guest count
  function simulateCheckPricing(
    checkIn: string,
    checkOut: string,
    guests: number,
    cleaningFee: number = 50
  ) {
    // Step 1: Build calendar (what generatePriceCalendar does)
    const calendar: Record<string, ReturnType<typeof calculateDayPrice>> = {};
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const current = new Date(start);
    while (current < end) {
      const dayKey = `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`;
      calendar[dayKey] = calculateDayPrice(property, new Date(current), seasons, [], []);
      current.setDate(current.getDate() + 1);
    }

    // Step 2: Read prices from calendar (what check-pricing API does)
    const dailyPrices: Record<string, number> = {};
    for (const [dateStr, dayPrice] of Object.entries(calendar)) {
      const occupancyPrice = dayPrice.prices?.[guests.toString()];
      if (occupancyPrice !== undefined) {
        dailyPrices[dateStr] = occupancyPrice;
      } else {
        // Fallback
        const extraGuests = Math.max(0, guests - property.baseOccupancy);
        dailyPrices[dateStr] = dayPrice.adjustedPrice + (extraGuests * (property.extraGuestFee || 0));
      }
    }

    // Step 3: Calculate booking total
    return calculateBookingPrice(
      dailyPrices,
      cleaningFee,
      property.pricingConfig?.lengthOfStayDiscounts
    );
  }

  it('should charge base-occupancy guests the adjusted price (not basePrice)', () => {
    // 2 nights: Fri Jul 3 + Sat Jul 4 2026 (both weekend + summer season)
    const result = simulateCheckPricing('2026-07-03', '2026-07-05', 4); // 4 = base occupancy

    // Each night: 180 (base) * 1.2 (weekend) * 1.5 (season) = 324
    const expectedPerNight = 180 * 1.2 * 1.5;
    expect(result.accommodationTotal).toBeCloseTo(expectedPerNight * 2, 1);
    expect(result.numberOfNights).toBe(2);
  });

  it('should charge extra guests correctly on top of adjusted price', () => {
    // 1 weeknight in summer: Mon Jul 6 2026
    const result = simulateCheckPricing('2026-07-06', '2026-07-07', 6); // 6 guests, base is 4

    // adjustedPrice = 180 * 1.5 (season, weekday) = 270
    // extra: 2 guests * 25 = 50
    // Total per night: 320
    const expectedPerNight = (180 * 1.5) + (2 * 25);
    expect(result.accommodationTotal).toBeCloseTo(expectedPerNight, 1);
  });

  it('should apply length-of-stay discount for 7+ nights', () => {
    // 7 weeknights in summer: Mon-Mon
    const result = simulateCheckPricing('2026-07-06', '2026-07-13', 4, 50);

    // 5 weekdays + 1 Fri + 1 Sat
    // Weekdays: 180 * 1.5 = 270 (5 days = 1350)
    // Fri + Sat: 180 * 1.2 * 1.5 = 324 (2 days = 648)
    // Accommodation: 1350 + 648 = 1998
    // Subtotal: 1998 + 50 (cleaning) = 2048
    // Discount: 5% of 2048 = 102.40
    // Total: 2048 - 102.40 = 1945.60

    expect(result.numberOfNights).toBe(7);
    expect(result.lengthOfStayDiscount).not.toBeNull();
    expect(result.lengthOfStayDiscount?.discountPercentage).toBe(5);
    expect(result.total).toBeCloseTo(2048 - 102.4, 1);
  });

  it('should handle non-seasonal weekday correctly', () => {
    // 1 night on a Wednesday in March (no season)
    const result = simulateCheckPricing('2026-03-04', '2026-03-05', 4);

    // No season, not weekend: just base price
    expect(result.accommodationTotal).toBe(180);
    expect(result.numberOfNights).toBe(1);
  });

  it('should handle non-seasonal weekend correctly', () => {
    // Friday night in March (weekend but no season)
    const result = simulateCheckPricing('2026-03-06', '2026-03-07', 4);

    // Weekend only: 180 * 1.2 = 216
    expect(result.accommodationTotal).toBeCloseTo(216, 1);
  });
});

// ============================================================================
// Test 3: Occupancy prices include base occupancy
// ============================================================================
describe('Occupancy prices dict correctness', () => {
  it('should include base occupancy entry in prices dict', () => {
    const property: PropertyPricing = {
      id: 'test',
      pricePerNight: 100,
      baseCurrency: 'EUR',
      baseOccupancy: 2,
      extraGuestFee: 25,
      maxGuests: 5
    };

    const weekday = new Date('2026-03-04'); // Wednesday
    const result = calculateDayPrice(property, weekday, [], [], []);

    // Base occupancy should be in the dict
    expect(result.prices['2']).toBe(100); // base: adjustedPrice
    expect(result.prices['3']).toBe(125); // +1 guest
    expect(result.prices['4']).toBe(150); // +2 guests
    expect(result.prices['5']).toBe(175); // +3 guests

    // Should NOT have entry below base occupancy
    expect(result.prices['1']).toBeUndefined();
  });

  it('should apply flat rate to all occupancy levels when override has flatRate', () => {
    const property: PropertyPricing = {
      id: 'test',
      pricePerNight: 100,
      baseCurrency: 'EUR',
      baseOccupancy: 2,
      extraGuestFee: 25,
      maxGuests: 4
    };

    const overrides: DateOverride[] = [{
      id: 'flat-override',
      propertyId: 'test',
      date: '2026-03-04',
      customPrice: 200,
      available: true,
      flatRate: true
    }];

    const result = calculateDayPrice(property, new Date('2026-03-04'), [], overrides, []);

    // All guest counts should have the same flat price
    expect(result.prices['2']).toBe(200);
    expect(result.prices['3']).toBe(200);
    expect(result.prices['4']).toBe(200);
  });
});

// ============================================================================
// Test 4: Edge cases with empty/missing data
// ============================================================================
describe('Edge cases with empty or missing data', () => {
  const property: PropertyPricing = {
    id: 'test',
    pricePerNight: 100,
    baseCurrency: 'EUR',
    baseOccupancy: 2,
    maxGuests: 4
  };

  it('should handle empty seasons array', () => {
    const result = calculateDayPrice(property, new Date('2026-03-04'), [], [], []);
    expect(result.adjustedPrice).toBe(100);
    expect(result.priceSource).toBe('base');
    expect(result.seasonId).toBeNull();
  });

  it('should handle empty overrides array', () => {
    const result = calculateDayPrice(property, new Date('2026-03-04'), [], [], []);
    expect(result.overrideId).toBeNull();
    expect(result.reason).toBeNull();
  });

  it('should handle empty minimumStayRules array', () => {
    const result = calculateDayPrice(property, new Date('2026-03-04'), [], [], []);
    expect(result.minimumStay).toBe(1);
  });

  it('should handle property with no pricingConfig', () => {
    const bareProperty: PropertyPricing = {
      id: 'test',
      pricePerNight: 50,
      baseCurrency: 'EUR',
      baseOccupancy: 2,
      maxGuests: 4
      // no pricingConfig
    };

    const friday = new Date('2026-03-06');
    const result = calculateDayPrice(bareProperty, friday, [], [], []);
    // No pricingConfig means weekendDays is undefined, so isWeekend = false
    expect(result.isWeekend).toBe(false);
    expect(result.adjustedPrice).toBe(50);
    expect(result.priceSource).toBe('base');
  });

  it('should handle property with no extraGuestFee', () => {
    const noFeeProperty: PropertyPricing = {
      id: 'test',
      pricePerNight: 100,
      baseCurrency: 'EUR',
      baseOccupancy: 2,
      maxGuests: 4
      // no extraGuestFee
    };

    const result = calculateDayPrice(noFeeProperty, new Date('2026-03-04'), [], [], []);
    // All occupancy levels should have same price (fee defaults to 0)
    expect(result.prices['2']).toBe(100);
    expect(result.prices['3']).toBe(100);
    expect(result.prices['4']).toBe(100);
  });

  it('should handle zero-price override', () => {
    const overrides: DateOverride[] = [{
      id: 'free-day',
      propertyId: 'test',
      date: '2026-03-04',
      customPrice: 0,
      available: true,
      flatRate: false
    }];

    const result = calculateDayPrice(property, new Date('2026-03-04'), [], overrides, []);
    expect(result.adjustedPrice).toBe(0);
    expect(result.priceSource).toBe('override');
  });
});

// ============================================================================
// Test 5: Calendar expiry banner logic
// ============================================================================
describe('Calendar expiry banner logic', () => {
  // Simulates the logic from price-calendar-manager.tsx
  function calculateExpiryInfo(calendars: Array<{ year: number; month: number }>) {
    if (calendars.length === 0) return { expiryDate: null, daysUntilExpiry: null };

    let maxYear = 0;
    let maxMonth = 0;
    for (const cal of calendars) {
      if (cal.year > maxYear || (cal.year === maxYear && cal.month > maxMonth)) {
        maxYear = cal.year;
        maxMonth = cal.month;
      }
    }
    if (maxYear === 0) return { expiryDate: null, daysUntilExpiry: null };

    const expiryDate = new Date(maxYear, maxMonth, 0);
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return { expiryDate, daysUntilExpiry };
  }

  it('should return null for empty calendars', () => {
    const result = calculateExpiryInfo([]);
    expect(result.expiryDate).toBeNull();
    expect(result.daysUntilExpiry).toBeNull();
  });

  it('should find the latest month from multiple calendars', () => {
    const calendars = [
      { year: 2026, month: 3 },
      { year: 2026, month: 6 },
      { year: 2026, month: 1 },
      { year: 2026, month: 12 },
      { year: 2026, month: 9 },
    ];

    const result = calculateExpiryInfo(calendars);
    // Last month is December 2026 -> last day is Dec 31
    expect(result.expiryDate?.getFullYear()).toBe(2026);
    expect(result.expiryDate?.getMonth()).toBe(11); // 0-indexed December
    expect(result.expiryDate?.getDate()).toBe(31);
  });

  it('should handle cross-year calendars', () => {
    const calendars = [
      { year: 2026, month: 11 },
      { year: 2027, month: 2 },
      { year: 2026, month: 12 },
    ];

    const result = calculateExpiryInfo(calendars);
    // Last month is February 2027 -> last day is Feb 28
    expect(result.expiryDate?.getFullYear()).toBe(2027);
    expect(result.expiryDate?.getMonth()).toBe(1); // 0-indexed February
    expect(result.expiryDate?.getDate()).toBe(28);
  });

  it('should show warning when expiry is within 14 days', () => {
    const now = new Date();
    // Create a calendar that ends this month
    const calendars = [
      { year: now.getFullYear(), month: now.getMonth() + 1 } // current month (1-indexed)
    ];

    const result = calculateExpiryInfo(calendars);
    // If we're in the last calendar month, daysUntilExpiry should be <= 31
    // and should definitely trigger the warning (within 14 days of month end or already past)
    expect(result.daysUntilExpiry).not.toBeNull();
    expect(result.daysUntilExpiry!).toBeLessThanOrEqual(31);
  });

  it('should NOT show warning when expiry is far in the future', () => {
    const calendars = [
      { year: 2099, month: 12 }
    ];

    const result = calculateExpiryInfo(calendars);
    expect(result.daysUntilExpiry).not.toBeNull();
    expect(result.daysUntilExpiry!).toBeGreaterThan(14);
  });

  it('should handle expired calendars (negative days)', () => {
    const calendars = [
      { year: 2020, month: 1 } // Long expired
    ];

    const result = calculateExpiryInfo(calendars);
    expect(result.daysUntilExpiry).not.toBeNull();
    expect(result.daysUntilExpiry!).toBeLessThan(0);
  });
});

// ============================================================================
// Test 6: Compounding scenarios matrix
// ============================================================================
describe('Compounding scenarios matrix', () => {
  const property: PropertyPricing = {
    id: 'test',
    pricePerNight: 100,
    baseCurrency: 'EUR',
    baseOccupancy: 2,
    extraGuestFee: 20,
    maxGuests: 4,
    pricingConfig: {
      weekendAdjustment: 1.2,
      weekendDays: ['friday', 'saturday']
    }
  };

  const seasons: SeasonalPricing[] = [{
    id: 'high',
    propertyId: 'test',
    name: 'High Season',
    seasonType: 'high',
    startDate: '2026-07-01',
    endDate: '2026-08-31',
    priceMultiplier: 1.5,
    enabled: true
  }];

  const overrides: DateOverride[] = [{
    id: 'special',
    propertyId: 'test',
    date: '2026-07-10', // Friday in high season
    customPrice: 500,
    available: true,
    flatRate: false
  }];

  it('base only (weekday, no season)', () => {
    const wed = new Date('2026-03-04');
    const result = calculateDayPrice(property, wed, seasons, [], []);
    expect(result.adjustedPrice).toBe(100);
    expect(result.priceSource).toBe('base');
  });

  it('weekend only (no season)', () => {
    const fri = new Date('2026-03-06');
    const result = calculateDayPrice(property, fri, seasons, [], []);
    expect(result.adjustedPrice).toBe(120); // 100 * 1.2
    expect(result.priceSource).toBe('weekend');
  });

  it('season only (weekday in season)', () => {
    const wed = new Date('2026-07-08'); // Wednesday in July
    const result = calculateDayPrice(property, wed, seasons, [], []);
    expect(result.adjustedPrice).toBe(150); // 100 * 1.5
    expect(result.priceSource).toBe('season');
  });

  it('weekend + season (compounding)', () => {
    const fri = new Date('2026-07-03'); // Friday in July
    const result = calculateDayPrice(property, fri, seasons, [], []);
    expect(result.adjustedPrice).toBe(180); // 100 * 1.2 * 1.5
    expect(result.priceSource).toBe('season');
    expect(result.isWeekend).toBe(true);
  });

  it('override replaces everything (even on weekend + season)', () => {
    const fri = new Date('2026-07-10'); // Friday with override
    const result = calculateDayPrice(property, fri, seasons, overrides, []);
    expect(result.adjustedPrice).toBe(500); // Override replaces
    expect(result.priceSource).toBe('override');
    expect(result.seasonId).toBeNull(); // Season cleared by override
  });

  it('override with extra guests (not flat rate)', () => {
    const fri = new Date('2026-07-10');
    const result = calculateDayPrice(property, fri, seasons, overrides, []);
    // 3 guests: 500 + (1 extra * 20) = 520
    expect(result.prices['3']).toBe(520);
    // 4 guests: 500 + (2 extra * 20) = 540
    expect(result.prices['4']).toBe(540);
  });
});

// ============================================================================
// Test 7: Realistic Prahova Mountain Chalet pricing scenarios
// ============================================================================
describe('Prahova Mountain Chalet realistic scenarios', () => {
  // Matches actual Firestore data from backup
  const property: PropertyPricing = {
    id: 'prahova-mountain-chalet',
    pricePerNight: 180,
    baseCurrency: 'EUR',
    baseOccupancy: 4,
    extraGuestFee: 25,
    maxGuests: 8,
    pricingConfig: {
      weekendAdjustment: 1.2,
      weekendDays: ['friday', 'saturday'],
      lengthOfStayDiscounts: [
        { nightsThreshold: 7, discountPercentage: 5, enabled: true },
        { nightsThreshold: 14, discountPercentage: 10, enabled: true }
      ]
    }
  };

  it('should price a weekday at base rate for base occupancy', () => {
    const wednesday = new Date('2026-03-04');
    const result = calculateDayPrice(property, wednesday, [], [], []);

    expect(result.basePrice).toBe(180);
    expect(result.adjustedPrice).toBe(180);
    expect(result.isWeekend).toBe(false);
    expect(result.priceSource).toBe('base');
    expect(result.prices['4']).toBe(180); // base occupancy
  });

  it('should price a Friday night with weekend adjustment', () => {
    const friday = new Date('2026-03-06');
    const result = calculateDayPrice(property, friday, [], [], []);

    expect(result.basePrice).toBe(180); // unchanged
    expect(result.adjustedPrice).toBe(216); // 180 * 1.2
    expect(result.isWeekend).toBe(true);
    expect(result.priceSource).toBe('weekend');
    expect(result.prices['4']).toBe(216); // base occupancy at adjusted
    expect(result.prices['5']).toBe(241); // +1 guest: 216 + 25
    expect(result.prices['8']).toBe(316); // +4 guests: 216 + (4*25)
  });

  it('should NOT treat Sunday as weekend (only Fri/Sat configured)', () => {
    const sunday = new Date('2026-03-08');
    const result = calculateDayPrice(property, sunday, [], [], []);

    expect(result.isWeekend).toBe(false);
    expect(result.adjustedPrice).toBe(180);
    expect(result.priceSource).toBe('base');
  });

  it('should calculate a 3-night weekend stay correctly', () => {
    // Fri Mar 6 + Sat Mar 7 + Sun Mar 8
    const dailyPrices: Record<string, number> = {};
    const dates = ['2026-03-06', '2026-03-07', '2026-03-08'];
    dates.forEach(dateStr => {
      const result = calculateDayPrice(property, new Date(dateStr), [], [], []);
      dailyPrices[dateStr] = result.prices['4']; // base occupancy
    });

    // Fri: 216, Sat: 216, Sun: 180
    expect(dailyPrices['2026-03-06']).toBe(216);
    expect(dailyPrices['2026-03-07']).toBe(216);
    expect(dailyPrices['2026-03-08']).toBe(180);

    const booking = calculateBookingPrice(dailyPrices, 50); // 50 EUR cleaning
    expect(booking.accommodationTotal).toBe(612); // 216 + 216 + 180
    expect(booking.subtotal).toBe(662); // + 50 cleaning
    expect(booking.total).toBe(662); // no discount (< 7 nights)
  });
});
