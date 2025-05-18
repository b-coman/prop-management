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
      // Create overlapping seasons for this test
      const overlappingSeasons = [
        ...sampleSeasons,
        {
          id: 'special-high-season',
          propertyId: 'test-property',
          name: 'Special High Season',
          seasonType: 'high',
          startDate: '2023-07-01',
          endDate: '2023-07-31',
          priceMultiplier: 1.8, // Higher than summer
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
      // Create overlapping rules for this test
      const overlappingRules = [
        ...sampleMinStayRules,
        {
          id: 'christmas-special',
          propertyId: 'test-property',
          name: 'Christmas Special',
          startDate: '2023-12-24',
          endDate: '2023-12-25',
          minimumStay: 5, // Higher than Christmas week
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
    it('should calculate regular occupancy prices', () => {
      const basePrice = 100;
      const baseOccupancy = 2;
      const extraGuestFee = 25;
      const maxGuests = 6;
      const flatRate = false;
      
      const result = calculateOccupancyPrices(basePrice, baseOccupancy, extraGuestFee, maxGuests, flatRate);
      
      expect(result).toEqual({
        '3': 125, // 100 + 1*25
        '4': 150, // 100 + 2*25
        '5': 175, // 100 + 3*25
        '6': 200  // 100 + 4*25
      });
    });
    
    it('should calculate flat rate prices', () => {
      const basePrice = 200;
      const baseOccupancy = 2;
      const extraGuestFee = 25;
      const maxGuests = 6;
      const flatRate = true;
      
      const result = calculateOccupancyPrices(basePrice, baseOccupancy, extraGuestFee, maxGuests, flatRate);
      
      expect(result).toEqual({
        '3': 200,
        '4': 200,
        '5': 200,
        '6': 200
      });
    });
    
    it('should handle no extra guests case', () => {
      const basePrice = 100;
      const baseOccupancy = 6;
      const extraGuestFee = 25;
      const maxGuests = 6;
      const flatRate = false;
      
      const result = calculateOccupancyPrices(basePrice, baseOccupancy, extraGuestFee, maxGuests, flatRate);
      
      expect(result).toEqual({}); // No prices for occupancy > baseOccupancy
    });
  });
  
  describe('calculateDayPrice', () => {
    it('should calculate base price for regular day', () => {
      const regularDay = new Date('2023-05-15'); // Monday, not in any season
      const result = calculateDayPrice(sampleProperty, regularDay, sampleSeasons, sampleDateOverrides, sampleMinStayRules);
      
      expect(result.baseOccupancyPrice).toBe(100); // Base price
      expect(result.priceSource).toBe('base');
      expect(result.minimumStay).toBe(1);
      expect(result.available).toBe(true);
      
      // Check occupancy prices
      expect(result.prices['3']).toBe(125); // 100 + 25
      expect(result.prices['4']).toBe(150); // 100 + 2*25
    });
    
    it('should apply weekend adjustment', () => {
      const weekendDay = new Date('2023-05-12'); // Friday
      const result = calculateDayPrice(sampleProperty, weekendDay, sampleSeasons, sampleDateOverrides, sampleMinStayRules);
      
      expect(result.baseOccupancyPrice).toBe(120); // 100 * 1.2
      expect(result.priceSource).toBe('weekend');
      
      // Check occupancy prices with weekend adjustment
      expect(result.prices['3']).toBe(145); // 120 + 25
      expect(result.prices['4']).toBe(170); // 120 + 2*25
    });
    
    it('should apply seasonal pricing', () => {
      const summerDay = new Date('2023-07-15');
      const result = calculateDayPrice(sampleProperty, summerDay, sampleSeasons, sampleDateOverrides, sampleMinStayRules);
      
      expect(result.baseOccupancyPrice).toBe(150); // 100 * 1.5
      expect(result.priceSource).toBe('season');
      expect(result.minimumStay).toBe(3); // From season
      expect(result.sourceDetails.name).toBe('Summer 2023');
      
      // Check occupancy prices with season multiplier
      expect(result.prices['3']).toBe(175); // 150 + 25
      expect(result.prices['4']).toBe(200); // 150 + 2*25
    });
    
    it('should apply date override', () => {
      const newYearsEve = new Date('2023-12-31');
      const result = calculateDayPrice(sampleProperty, newYearsEve, sampleSeasons, sampleDateOverrides, sampleMinStayRules);
      
      expect(result.baseOccupancyPrice).toBe(200); // Custom price
      expect(result.priceSource).toBe('override');
      expect(result.minimumStay).toBe(3); // From override
      expect(result.sourceDetails.reason).toBe("New Year's Eve");
      
      // Check occupancy prices with flat rate
      expect(result.prices['3']).toBe(200); // Flat rate
      expect(result.prices['4']).toBe(200); // Flat rate
    });
    
    it('should handle unavailable date override', () => {
      const maintenanceDay = new Date('2023-10-15');
      const result = calculateDayPrice(sampleProperty, maintenanceDay, sampleSeasons, sampleDateOverrides, sampleMinStayRules);
      
      expect(result.available).toBe(false);
      expect(result.priceSource).toBe('override');
    });
    
    it('should apply minimum stay rule', () => {
      const thanksgivingDay = new Date('2023-11-23');
      const result = calculateDayPrice(sampleProperty, thanksgivingDay, sampleSeasons, sampleDateOverrides, sampleMinStayRules);
      
      expect(result.minimumStay).toBe(3); // From min stay rule
      expect(result.baseOccupancyPrice).toBe(80); // 100 * 0.8 (low season)
    });
    
    it('should handle overlapping rules with correct precedence', () => {
      // Create a date with overlap between season, weekend, and min stay
      const overlappingDay = new Date('2023-12-23'); // Saturday in winter season
      
      const result = calculateDayPrice(sampleProperty, overlappingDay, sampleSeasons, sampleDateOverrides, sampleMinStayRules);
      
      // Weekend adjustment should apply to seasonal base
      expect(result.baseOccupancyPrice).toBe(156); // 100 * 1.3 * 1.2
      expect(result.priceSource).toBe('weekend');
      
      // Minimum stay from Christmas week should still apply
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
      expect(calculateLengthOfStayDiscount(1000, 7, null).discountAmount).toBe(0);
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
        '2023-06-02': 120, // Weekend
        '2023-06-03': 120  // Weekend
      };
      
      const result = calculateBookingPrice(dailyPrices, 50);
      
      expect(result.numberOfNights).toBe(3);
      expect(result.accommodationTotal).toBe(340); // 100 + 120 + 120
      expect(result.cleaningFee).toBe(50);
      expect(result.subtotal).toBe(390); // 340 + 50
      expect(result.lengthOfStayDiscount).toBeNull();
      expect(result.couponDiscount).toBeNull();
      expect(result.totalDiscountAmount).toBe(0);
      expect(result.total).toBe(390);
    });
    
    it('should apply length-of-stay discount', () => {
      const dailyPrices = {};
      for (let i = 1; i <= 7; i++) {
        dailyPrices[`2023-06-${i.toString().padStart(2, '0')}`] = 100;
      }
      
      const lengthOfStayDiscounts = [
        { nightsThreshold: 7, discountPercentage: 5, enabled: true }
      ];
      
      const result = calculateBookingPrice(dailyPrices, 50, lengthOfStayDiscounts);
      
      expect(result.numberOfNights).toBe(7);
      expect(result.accommodationTotal).toBe(700);
      expect(result.subtotal).toBe(750); // 700 + 50
      expect(result.lengthOfStayDiscount).not.toBeNull();
      expect(result.lengthOfStayDiscount?.discountAmount).toBe(37.5); // 5% of 750
      expect(result.totalDiscountAmount).toBe(37.5);
      expect(result.total).toBe(712.5); // 750 - 37.5
    });
    
    it('should apply coupon discount', () => {
      const dailyPrices = {
        '2023-06-01': 100,
        '2023-06-02': 100,
        '2023-06-03': 100
      };
      
      const result = calculateBookingPrice(dailyPrices, 50, undefined, 10);
      
      expect(result.subtotal).toBe(350); // 300 + 50
      expect(result.couponDiscount).not.toBeNull();
      expect(result.couponDiscount?.discountAmount).toBe(35); // 10% of 350
      expect(result.totalDiscountAmount).toBe(35);
      expect(result.total).toBe(315); // 350 - 35
    });
    
    it('should apply both length-of-stay and coupon discounts', () => {
      const dailyPrices = {};
      for (let i = 1; i <= 7; i++) {
        dailyPrices[`2023-06-${i.toString().padStart(2, '0')}`] = 100;
      }
      
      const lengthOfStayDiscounts = [
        { nightsThreshold: 7, discountPercentage: 5, enabled: true }
      ];
      
      const result = calculateBookingPrice(dailyPrices, 50, lengthOfStayDiscounts, 10);
      
      expect(result.subtotal).toBe(750); // 700 + 50
      expect(result.lengthOfStayDiscount?.discountAmount).toBe(37.5); // 5% of 750
      expect(result.couponDiscount?.discountAmount).toBe(75); // 10% of 750
      expect(result.totalDiscountAmount).toBe(112.5); // 37.5 + 75
      expect(result.total).toBe(637.5); // 750 - 112.5
    });
  });
});