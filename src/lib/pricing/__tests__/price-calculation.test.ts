import {
  PropertyPricing,
  SeasonalPricing,
  DateOverride,
  MinimumStayRule,
  isDateInRange,
  findMatchingSeason,
  findDateOverride,
  findMatchingMinStayRule,
  calculateOccupancyPrices,
  calculateDayPrice,
  calculateLengthOfStayDiscount,
  calculateBookingPrice
} from '../price-calculation';

describe('Price Calculation Tests', () => {
  // Sample data for tests
  const sampleProperty: PropertyPricing = {
    id: 'test-property',
    pricePerNight: 100,
    baseCurrency: 'USD',
    baseOccupancy: 2,
    extraGuestFee: 25,
    maxGuests: 6,
    pricingConfig: {
      weekendAdjustment: 1.2,
      weekendDays: ['friday', 'saturday'],
      lengthOfStayDiscounts: [
        { nightsThreshold: 7, discountPercentage: 5, enabled: true },
        { nightsThreshold: 14, discountPercentage: 10, enabled: true }
      ]
    }
  };

  const sampleSeasons: SeasonalPricing[] = [
    {
      id: 'summer-2023',
      propertyId: 'test-property',
      name: 'Summer 2023',
      seasonType: 'high',
      startDate: '2023-06-01',
      endDate: '2023-08-31',
      priceMultiplier: 1.5,
      minimumStay: 3,
      enabled: true
    },
    {
      id: 'winter-2023',
      propertyId: 'test-property',
      name: 'Winter 2023',
      seasonType: 'medium',
      startDate: '2023-12-01',
      endDate: '2024-02-29',
      priceMultiplier: 1.3,
      minimumStay: 2,
      enabled: true
    },
    {
      id: 'low-season-2023',
      propertyId: 'test-property',
      name: 'Low Season 2023',
      seasonType: 'low',
      startDate: '2023-10-01',
      endDate: '2023-11-30',
      priceMultiplier: 0.8,
      minimumStay: 1,
      enabled: true
    },
    {
      id: 'disabled-season',
      propertyId: 'test-property',
      name: 'Disabled Season',
      seasonType: 'high',
      startDate: '2023-09-01',
      endDate: '2023-09-30',
      priceMultiplier: 1.4,
      minimumStay: 2,
      enabled: false
    }
  ];

  const sampleDateOverrides: DateOverride[] = [
    {
      id: 'new-years-eve',
      propertyId: 'test-property',
      date: '2023-12-31',
      customPrice: 200,
      reason: "New Year's Eve",
      minimumStay: 3,
      available: true,
      flatRate: true
    },
    {
      id: 'maintenance-day',
      propertyId: 'test-property',
      date: '2023-10-15',
      customPrice: 100,
      reason: 'Maintenance Day',
      available: false,
      flatRate: false
    }
  ];

  const sampleMinStayRules: MinimumStayRule[] = [
    {
      id: 'christmas-week',
      propertyId: 'test-property',
      name: 'Christmas Week',
      startDate: '2023-12-20',
      endDate: '2023-12-26',
      minimumStay: 4,
      enabled: true
    },
    {
      id: 'thanksgiving',
      propertyId: 'test-property',
      name: 'Thanksgiving',
      startDate: '2023-11-20',
      endDate: '2023-11-26',
      minimumStay: 3,
      enabled: true
    },
    {
      id: 'disabled-rule',
      propertyId: 'test-property',
      name: 'Disabled Rule',
      startDate: '2023-09-01',
      endDate: '2023-09-07',
      minimumStay: 5,
      enabled: false
    }
  ];

  describe('isDateInRange', () => {
    it('should return true when date is within range', () => {
      const testDate = new Date('2023-07-15');
      expect(isDateInRange(testDate, '2023-07-01', '2023-07-31')).toBe(true);
    });

    it('should return true when date is at start of range', () => {
      const testDate = new Date('2023-07-01');
      expect(isDateInRange(testDate, '2023-07-01', '2023-07-31')).toBe(true);
    });

    it('should return true when date is at end of range', () => {
      const testDate = new Date('2023-07-31');
      expect(isDateInRange(testDate, '2023-07-01', '2023-07-31')).toBe(true);
    });

    it('should return false when date is before range', () => {
      const testDate = new Date('2023-06-30');
      expect(isDateInRange(testDate, '2023-07-01', '2023-07-31')).toBe(false);
    });

    it('should return false when date is after range', () => {
      const testDate = new Date('2023-08-01');
      expect(isDateInRange(testDate, '2023-07-01', '2023-07-31')).toBe(false);
    });
  });

  describe('findMatchingSeason', () => {
    it('should find high season', () => {
      const summerDate = new Date('2023-07-15');
      const result = findMatchingSeason(summerDate, sampleSeasons);
      expect(result?.id).toBe('summer-2023');
    });

    it('should find medium season', () => {
      const winterDate = new Date('2023-12-15');
      const result = findMatchingSeason(winterDate, sampleSeasons);
      expect(result?.id).toBe('winter-2023');
    });

    it('should find low season', () => {
      const lowSeasonDate = new Date('2023-10-15');
      const result = findMatchingSeason(lowSeasonDate, sampleSeasons);
      expect(result?.id).toBe('low-season-2023');
    });

    it('should not find disabled season', () => {
      const disabledSeasonDate = new Date('2023-09-15');
      const result = findMatchingSeason(disabledSeasonDate, sampleSeasons);
      expect(result).toBeNull();
    });

    it('should return null when no season matches', () => {
      const noSeasonDate = new Date('2023-05-15');
      const result = findMatchingSeason(noSeasonDate, sampleSeasons);
      expect(result).toBeNull();
    });

    it('should return the season with highest multiplier when multiple match', () => {
      const overlappingSeasons = [
        ...sampleSeasons,
        {
          id: 'special-high-season',
          propertyId: 'test-property',
          name: 'Special High Season',
          seasonType: 'high' as const,
          startDate: '2023-07-01',
          endDate: '2023-07-31',
          priceMultiplier: 1.8,
          minimumStay: 4,
          enabled: true
        }
      ];

      const date = new Date('2023-07-15');
      const result = findMatchingSeason(date, overlappingSeasons);
      expect(result?.id).toBe('special-high-season');
      expect(result?.priceMultiplier).toBe(1.8);
    });
  });

  describe('findDateOverride', () => {
    it('should find New Year\'s Eve override', () => {
      const newYearsEve = new Date('2023-12-31');
      const result = findDateOverride(newYearsEve, sampleDateOverrides);
      expect(result?.id).toBe('new-years-eve');
    });

    it('should find maintenance day override', () => {
      const maintenanceDay = new Date('2023-10-15');
      const result = findDateOverride(maintenanceDay, sampleDateOverrides);
      expect(result?.id).toBe('maintenance-day');
    });

    it('should return null when no override exists', () => {
      const regularDay = new Date('2023-11-15');
      const result = findDateOverride(regularDay, sampleDateOverrides);
      expect(result).toBeNull();
    });
  });

  describe('findMatchingMinStayRule', () => {
    it('should find Christmas week rule', () => {
      const christmasDay = new Date('2023-12-25');
      const result = findMatchingMinStayRule(christmasDay, sampleMinStayRules);
      expect(result?.id).toBe('christmas-week');
    });

    it('should find Thanksgiving rule', () => {
      const thanksgiving = new Date('2023-11-23');
      const result = findMatchingMinStayRule(thanksgiving, sampleMinStayRules);
      expect(result?.id).toBe('thanksgiving');
    });

    it('should not find disabled rule', () => {
      const disabledRuleDate = new Date('2023-09-03');
      const result = findMatchingMinStayRule(disabledRuleDate, sampleMinStayRules);
      expect(result).toBeNull();
    });

    it('should return null when no rule matches', () => {
      const noRuleDate = new Date('2023-10-01');
      const result = findMatchingMinStayRule(noRuleDate, sampleMinStayRules);
      expect(result).toBeNull();
    });

    it('should return the rule with highest min stay when multiple match', () => {
      const overlappingRules = [
        ...sampleMinStayRules,
        {
          id: 'christmas-special',
          propertyId: 'test-property',
          name: 'Christmas Special',
          startDate: '2023-12-24',
          endDate: '2023-12-25',
          minimumStay: 5,
          enabled: true
        }
      ];

      const christmasDay = new Date('2023-12-25');
      const result = findMatchingMinStayRule(christmasDay, overlappingRules);
      expect(result?.id).toBe('christmas-special');
      expect(result?.minimumStay).toBe(5);
    });
  });

  describe('calculateOccupancyPrices', () => {
    it('should calculate prices including base occupancy', () => {
      const result = calculateOccupancyPrices(100, 2, 25, 6, false);

      expect(result).toEqual({
        '2': 100, // base occupancy = adjusted price
        '3': 125, // 100 + 1*25
        '4': 150, // 100 + 2*25
        '5': 175, // 100 + 3*25
        '6': 200  // 100 + 4*25
      });
    });

    it('should calculate flat rate prices', () => {
      const result = calculateOccupancyPrices(200, 2, 25, 6, true);

      expect(result).toEqual({
        '2': 200,
        '3': 200,
        '4': 200,
        '5': 200,
        '6': 200
      });
    });

    it('should handle single-occupancy case (baseOccupancy == maxGuests)', () => {
      const result = calculateOccupancyPrices(100, 6, 25, 6, false);

      expect(result).toEqual({
        '6': 100 // Only one entry, no extra guests
      });
    });
  });

  describe('calculateDayPrice', () => {
    it('should calculate base price for regular weekday', () => {
      // Monday, May 15 2023 - no season, no weekend
      const regularDay = new Date('2023-05-15');
      const result = calculateDayPrice(sampleProperty, regularDay, sampleSeasons, sampleDateOverrides, sampleMinStayRules);

      expect(result.basePrice).toBe(100); // Raw property price
      expect(result.adjustedPrice).toBe(100); // No adjustments
      expect(result.priceSource).toBe('base');
      expect(result.minimumStay).toBe(1);
      expect(result.available).toBe(true);

      // Occupancy prices include base occupancy
      expect(result.prices['2']).toBe(100);
      expect(result.prices['3']).toBe(125); // 100 + 25
      expect(result.prices['4']).toBe(150); // 100 + 2*25
    });

    it('should apply weekend adjustment', () => {
      // Friday, May 12 2023 - weekend day, no season
      const weekendDay = new Date('2023-05-12');
      const result = calculateDayPrice(sampleProperty, weekendDay, sampleSeasons, sampleDateOverrides, sampleMinStayRules);

      expect(result.basePrice).toBe(100); // Raw price unchanged
      expect(result.adjustedPrice).toBe(120); // 100 * 1.2
      expect(result.priceSource).toBe('weekend');
      expect(result.isWeekend).toBe(true);

      // Occupancy prices based on adjusted price
      expect(result.prices['2']).toBe(120);
      expect(result.prices['3']).toBe(145); // 120 + 25
    });

    it('should apply seasonal pricing on a weekday', () => {
      // Tuesday, July 11 2023 - summer season, NOT a weekend
      const summerWeekday = new Date('2023-07-11');
      const result = calculateDayPrice(sampleProperty, summerWeekday, sampleSeasons, sampleDateOverrides, sampleMinStayRules);

      expect(result.basePrice).toBe(100); // Raw price unchanged
      expect(result.adjustedPrice).toBe(150); // 100 * 1.5
      expect(result.priceSource).toBe('season');
      expect(result.minimumStay).toBe(3); // From season
      expect(result.seasonName).toBe('Summer 2023');
      expect(result.seasonId).toBe('summer-2023');

      // Occupancy prices based on adjusted price
      expect(result.prices['2']).toBe(150);
      expect(result.prices['3']).toBe(175); // 150 + 25
    });

    it('should compound weekend and seasonal pricing', () => {
      // Saturday, Dec 23 2023 - winter season + weekend
      const winterWeekend = new Date('2023-12-23');
      const result = calculateDayPrice(sampleProperty, winterWeekend, sampleSeasons, sampleDateOverrides, sampleMinStayRules);

      expect(result.basePrice).toBe(100); // Raw price unchanged
      expect(result.adjustedPrice).toBe(156); // 100 * 1.2 (weekend) * 1.3 (winter)
      expect(result.priceSource).toBe('season'); // Season is last applied
      expect(result.isWeekend).toBe(true);
      expect(result.seasonName).toBe('Winter 2023');

      // Min stay: season=2, christmas-week rule=4, Math.max → 4
      expect(result.minimumStay).toBe(4);
    });

    it('should apply date override (replaces all other pricing)', () => {
      const newYearsEve = new Date('2023-12-31');
      const result = calculateDayPrice(sampleProperty, newYearsEve, sampleSeasons, sampleDateOverrides, sampleMinStayRules);

      expect(result.basePrice).toBe(100); // Raw price unchanged
      expect(result.adjustedPrice).toBe(200); // Custom price from override
      expect(result.priceSource).toBe('override');
      expect(result.minimumStay).toBe(3); // From override
      expect(result.reason).toBe("New Year's Eve");
      expect(result.overrideId).toBe('new-years-eve');
      // Override clears season info
      expect(result.seasonId).toBeNull();
      expect(result.seasonName).toBeNull();

      // Flat rate: same price for all occupancy
      expect(result.prices['2']).toBe(200);
      expect(result.prices['3']).toBe(200);
      expect(result.prices['4']).toBe(200);
    });

    it('should handle unavailable date override', () => {
      const maintenanceDay = new Date('2023-10-15');
      const result = calculateDayPrice(sampleProperty, maintenanceDay, sampleSeasons, sampleDateOverrides, sampleMinStayRules);

      expect(result.available).toBe(false);
      expect(result.priceSource).toBe('override');
    });

    it('should apply minimum stay rule with Math.max', () => {
      // Thursday, Nov 23 2023 - in low season (minStay=1) and thanksgiving rule (minStay=3)
      const thanksgivingDay = new Date('2023-11-23');
      const result = calculateDayPrice(sampleProperty, thanksgivingDay, sampleSeasons, sampleDateOverrides, sampleMinStayRules);

      // Math.max(1 from season, 3 from rule) = 3
      expect(result.minimumStay).toBe(3);
      expect(result.adjustedPrice).toBe(80); // 100 * 0.8 (low season)
    });

    it('should use highest minimumStay when season and rule overlap', () => {
      // Dec 25 2023 - winter season (minStay=2) + christmas-week rule (minStay=4)
      const christmasDay = new Date('2023-12-25');
      const result = calculateDayPrice(sampleProperty, christmasDay, sampleSeasons, sampleDateOverrides, sampleMinStayRules);

      // Math.max(2 from season, 4 from rule) = 4
      expect(result.minimumStay).toBe(4);
    });
  });

  describe('calculateLengthOfStayDiscount', () => {
    it('should apply no discount for short stays', () => {
      const result = calculateLengthOfStayDiscount(1000, 5, sampleProperty.pricingConfig?.lengthOfStayDiscounts);

      expect(result.appliedDiscount).toBeNull();
      expect(result.discountAmount).toBe(0);
    });

    it('should apply 5% discount for 7-night stay', () => {
      const result = calculateLengthOfStayDiscount(1000, 7, sampleProperty.pricingConfig?.lengthOfStayDiscounts);

      expect(result.appliedDiscount?.nightsThreshold).toBe(7);
      expect(result.appliedDiscount?.discountPercentage).toBe(5);
      expect(result.discountAmount).toBe(50); // 5% of 1000
    });

    it('should apply 10% discount for 14-night stay', () => {
      const result = calculateLengthOfStayDiscount(1000, 14, sampleProperty.pricingConfig?.lengthOfStayDiscounts);

      expect(result.appliedDiscount?.nightsThreshold).toBe(14);
      expect(result.appliedDiscount?.discountPercentage).toBe(10);
      expect(result.discountAmount).toBe(100); // 10% of 1000
    });

    it('should handle null or empty discounts', () => {
      expect(calculateLengthOfStayDiscount(1000, 7, undefined).discountAmount).toBe(0);
      expect(calculateLengthOfStayDiscount(1000, 7, []).discountAmount).toBe(0);
    });

    it('should handle disabled discounts', () => {
      const disabledDiscounts = [
        { nightsThreshold: 7, discountPercentage: 5, enabled: false }
      ];

      expect(calculateLengthOfStayDiscount(1000, 7, disabledDiscounts).discountAmount).toBe(0);
    });

    it('should apply the highest eligible discount', () => {
      const multipleDiscounts = [
        { nightsThreshold: 7, discountPercentage: 5, enabled: true },
        { nightsThreshold: 10, discountPercentage: 8, enabled: true },
        { nightsThreshold: 14, discountPercentage: 10, enabled: true }
      ];

      const result = calculateLengthOfStayDiscount(1000, 12, multipleDiscounts);

      expect(result.appliedDiscount?.nightsThreshold).toBe(10);
      expect(result.discountAmount).toBe(80); // 8% of 1000
    });
  });

  describe('calculateBookingPrice', () => {
    it('should calculate total booking price with no discounts', () => {
      const dailyPrices = {
        '2023-06-01': 100,
        '2023-06-02': 120,
        '2023-06-03': 120
      };

      const result = calculateBookingPrice(dailyPrices, 50);

      expect(result.numberOfNights).toBe(3);
      expect(result.accommodationTotal).toBe(340);
      expect(result.cleaningFee).toBe(50);
      expect(result.subtotal).toBe(390);
      expect(result.lengthOfStayDiscount).toBeNull();
      expect(result.couponDiscount).toBeNull();
      expect(result.totalDiscountAmount).toBe(0);
      expect(result.total).toBe(390);
    });

    it('should apply length-of-stay discount', () => {
      const dailyPrices: Record<string, number> = {};
      for (let i = 1; i <= 7; i++) {
        dailyPrices[`2023-06-${i.toString().padStart(2, '0')}`] = 100;
      }

      const lengthOfStayDiscounts = [
        { nightsThreshold: 7, discountPercentage: 5, enabled: true }
      ];

      const result = calculateBookingPrice(dailyPrices, 50, lengthOfStayDiscounts);

      expect(result.numberOfNights).toBe(7);
      expect(result.accommodationTotal).toBe(700);
      expect(result.subtotal).toBe(750);
      expect(result.lengthOfStayDiscount).not.toBeNull();
      // The ladder discounts ACCOMMODATION only: 5% of 700, not of the 750 subtotal.
      // The cleaner costs the same on a 3-night stay as on a 7-night one, so
      // discounting the fee gave away a fixed cost as though it scaled.
      expect(result.lengthOfStayDiscount?.discountAmount).toBe(35);
      expect(result.totalDiscountAmount).toBe(35);
      expect(result.total).toBe(715);
    });

    it('should apply coupon discount', () => {
      const dailyPrices = {
        '2023-06-01': 100,
        '2023-06-02': 100,
        '2023-06-03': 100
      };

      const result = calculateBookingPrice(dailyPrices, 50, undefined, 10);

      expect(result.subtotal).toBe(350);
      expect(result.couponDiscount).not.toBeNull();
      expect(result.couponDiscount?.discountAmount).toBe(35);
      expect(result.totalDiscountAmount).toBe(35);
      expect(result.total).toBe(315);
    });

    it('should apply both length-of-stay and coupon discounts', () => {
      const dailyPrices: Record<string, number> = {};
      for (let i = 1; i <= 7; i++) {
        dailyPrices[`2023-06-${i.toString().padStart(2, '0')}`] = 100;
      }

      const lengthOfStayDiscounts = [
        { nightsThreshold: 7, discountPercentage: 5, enabled: true }
      ];

      const result = calculateBookingPrice(dailyPrices, 50, lengthOfStayDiscounts, 10);

      expect(result.subtotal).toBe(750);
      // LoS on accommodation (5% of 700); the coupon still applies to the subtotal.
      expect(result.lengthOfStayDiscount?.discountAmount).toBe(35);
      expect(result.couponDiscount?.discountAmount).toBe(75);
      expect(result.totalDiscountAmount).toBe(110);
      expect(result.total).toBe(640);
    });

    it('should cap combined discounts at subtotal (never go negative)', () => {
      const dailyPrices = { '2023-06-01': 100 };

      const lengthOfStayDiscounts = [
        { nightsThreshold: 1, discountPercentage: 60, enabled: true }
      ];

      // 60% length-of-stay + 60% coupon = 120% total, should cap at 100%
      const result = calculateBookingPrice(dailyPrices, 50, lengthOfStayDiscounts, 60);

      expect(result.subtotal).toBe(150);
      expect(result.totalDiscountAmount).toBe(150); // Capped at subtotal
      expect(result.total).toBe(0); // Never negative
    });
  });
});

describe('calculateBookingPrice — the ladder cannot make a longer stay cheaper', () => {
  const LADDER = [
    { nightsThreshold: 4, discountPercentage: 10, enabled: true },
    { nightsThreshold: 5, discountPercentage: 15, enabled: true },
    { nightsThreshold: 7, discountPercentage: 25, enabled: true },
  ];
  const CLEAN = 200;
  /** The real festive curve: Christmas 1051, shoulder 940, the two party nights 2351. */
  const NIGHT: Record<string, number> = {
    '2026-12-25': 1051, '2026-12-26': 1051, '2026-12-27': 1051,
    '2026-12-28': 940, '2026-12-29': 940,
    '2026-12-30': 2351, '2026-12-31': 2351,
  };
  const stay = (from: string, to: string) => {
    const out: Record<string, number> = {};
    for (const d of Object.keys(NIGHT).sort()) if (d >= from && d <= to) out[d] = NIGHT[d];
    return calculateBookingPrice(out, CLEAN, LADDER).total;
  };

  it('never lets an extra night lower the total, across the whole festive week', () => {
    const dates = Object.keys(NIGHT).sort();
    // Same checkout, progressively earlier arrival — the direction that used to break.
    let prev = 0;
    for (let i = dates.length - 1; i >= 0; i--) {
      const t = stay(dates[i], '2026-12-31');
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it('floors the case that was measured live: 7 nights was cheaper than 6', () => {
    const six = stay('2026-12-26', '2026-12-31');
    const seven = stay('2026-12-25', '2026-12-31');
    expect(seven).toBeGreaterThanOrEqual(six);
  });

  it('leaves an ordinary stay untouched — the floor only bites when the ladder misbehaves', () => {
    const flat: Record<string, number> = {};
    for (let i = 1; i <= 7; i++) flat[`2026-03-0${i}`] = 405;
    const r = calculateBookingPrice(flat, CLEAN, LADDER);
    // 7 x 405 = 2835, less 25% of the accommodation = 2126.25, plus cleaning.
    expect(r.total).toBeCloseTo(2835 * 0.75 + CLEAN, 2);
  });

  it('never discounts the cleaning fee', () => {
    const flat: Record<string, number> = {};
    for (let i = 1; i <= 4; i++) flat[`2026-03-0${i}`] = 100;
    const r = calculateBookingPrice(flat, CLEAN, LADDER);
    expect(r.lengthOfStayDiscount?.discountAmount).toBe(40);  // 10% of 400, not of 600
    expect(r.total).toBe(400 - 40 + CLEAN);
  });

  it('does not let the floor cancel a coupon', () => {
    const flat: Record<string, number> = {};
    for (let i = 1; i <= 7; i++) flat[`2026-03-0${i}`] = 100;
    const withCoupon = calculateBookingPrice(flat, CLEAN, LADDER, 10);
    const without = calculateBookingPrice(flat, CLEAN, LADDER);
    expect(withCoupon.total).toBeLessThan(without.total);
  });
});
