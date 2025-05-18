import * as fs from 'fs';
import * as path from 'path';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { dbAdmin } from '../src/lib/firebaseAdmin';

// Load environment variables from .env and .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Use the centralized Firebase Admin instance
function getFirestoreDb() {
  if (!dbAdmin) {
    console.error('Firebase Admin SDK is not properly initialized from centralized implementation');
    throw new Error('Firebase Admin SDK is not properly initialized');
  }

  console.log('✅ Using centralized Firebase Admin SDK implementation');
  return dbAdmin;
}

// Format a date to YYYY-MM-DD string
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Check if a date is a weekend day
function isWeekend(date: Date, weekendDays: string[]): boolean {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()];
  return weekendDays.includes(dayName);
}

// Type definitions
interface Property {
  id: string;
  slug: string;
  pricePerNight: number;
  pricing: {
    pricingTemplateId: string;
    useDynamicPricing: boolean;
    occupancyPricing: {
      enabled: boolean;
      baseOccupancy: number;
      extraGuestFeePerNight: number;
    };
    lengthOfStayDiscounts: Array<{
      nights: number;
      discountPercentage: number;
    }>;
    weekendPricing: {
      enabled: boolean;
      weekendDays: string[];
      priceMultiplier: number;
    };
  };
}

interface PricingTemplate {
  id: string;
  defaultPricing: {
    weekendAdjustment: number;
    weekendDays: string[];
  };
  seasons: Array<{
    name: string;
    seasonType: string;
    startMonth: number;
    startDay: number;
    endMonth: number;
    endDay: number;
    priceMultiplier: number;
    minimumStay: number;
  }>;
}

interface SeasonalPricing {
  id: string;
  propertyId: string;
  name: string;
  seasonType: string;
  startDate: string;
  endDate: string;
  priceMultiplier: number;
  minimumStay: number;
  enabled: boolean;
}

interface DateOverride {
  id: string;
  propertyId: string;
  date: string;
  customPrice?: number;
  priceMultiplier?: number;
  reason?: string;
  minimumStay?: number;
  available: boolean;
  flatRate: boolean;
}

interface DailyPrice {
  basePrice: number;
  adjustedPrice: number;
  minimumStay: number;
  available: boolean;
  seasonId?: string;
  isWeekend: boolean;
  reason?: string;
}

interface PriceCalendar {
  id: string;
  propertyId: string;
  year: number;
  lastUpdated: admin.firestore.Timestamp;
  prices: Record<string, DailyPrice>;
}

// Load data from Firestore collections
async function loadData(db: FirebaseFirestore.Firestore) {
  // Load properties
  const propertiesSnapshot = await db.collection('properties').get();
  const properties: Property[] = [];
  
  propertiesSnapshot.forEach(doc => {
    const property = doc.data() as Property;
    property.id = doc.id;
    if (property.pricing?.useDynamicPricing) {
      properties.push(property);
    }
  });
  
  // Load pricing templates
  const templatesSnapshot = await db.collection('pricingTemplates').get();
  const templates: Record<string, PricingTemplate> = {};
  
  templatesSnapshot.forEach(doc => {
    templates[doc.id] = {
      id: doc.id,
      ...doc.data() as PricingTemplate
    };
  });
  
  // Load seasonal pricing
  const seasonalPricingSnapshot = await db.collection('seasonalPricing').get();
  const seasonalPricing: SeasonalPricing[] = [];
  
  seasonalPricingSnapshot.forEach(doc => {
    seasonalPricing.push({
      id: doc.id,
      ...doc.data() as SeasonalPricing
    });
  });
  
  // Load date overrides
  const dateOverridesSnapshot = await db.collection('dateOverrides').get();
  const dateOverrides: DateOverride[] = [];
  
  dateOverridesSnapshot.forEach(doc => {
    dateOverrides.push({
      id: doc.id,
      ...doc.data() as DateOverride
    });
  });
  
  return { properties, templates, seasonalPricing, dateOverrides };
}

// Generate price calendar for a property
async function generatePriceCalendar(
  db: FirebaseFirestore.Firestore,
  property: Property,
  templates: Record<string, PricingTemplate>,
  seasonalPricing: SeasonalPricing[],
  dateOverrides: DateOverride[],
  startDate: Date,
  endDate: Date
) {
  const propertyId = property.slug;
  const pricingTemplateId = property.pricing.pricingTemplateId;
  const template = templates[pricingTemplateId];
  
  if (!template) {
    console.error(`Pricing template ${pricingTemplateId} not found for property ${propertyId}`);
    return;
  }
  
  // Filter seasonal pricing and date overrides for this property
  const propertySeasonal = seasonalPricing.filter(season => season.propertyId === propertyId && season.enabled);
  const propertyOverrides = dateOverrides.filter(override => override.propertyId === propertyId);
  
  // Organize overrides by date for faster lookup
  const overridesByDate: Record<string, DateOverride> = {};
  propertyOverrides.forEach(override => {
    overridesByDate[override.date] = override;
  });
  
  // Prepare the price calendar
  const year = startDate.getFullYear();
  const priceCalendar: PriceCalendar = {
    id: `${propertyId}-${year}`,
    propertyId,
    year,
    lastUpdated: admin.firestore.Timestamp.now(),
    prices: {}
  };
  
  // Generate prices for each day
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate);
    const month = currentDate.getMonth() + 1; // 1-12
    const day = currentDate.getDate();
    
    // Check if there's a date override
    const override = overridesByDate[dateStr];
    
    // Default values
    let basePrice = property.pricePerNight;
    let adjustedPrice = basePrice;
    let minimumStay = 1;
    let available = true;
    let seasonId: string | undefined = undefined;
    let reason: string | undefined = undefined;
    
    // Check for seasonal pricing
    let appliedSeason: SeasonalPricing | undefined;
    
    // First check explicit seasonal pricing with start and end dates
    for (const season of propertySeasonal) {
      const seasonStart = new Date(season.startDate);
      const seasonEnd = new Date(season.endDate);
      
      if (currentDate >= seasonStart && currentDate <= seasonEnd) {
        appliedSeason = season;
        break;
      }
    }
    
    // If no explicit season, check template seasons
    if (!appliedSeason && template.seasons) {
      for (const season of template.seasons) {
        // Season start date in current year
        const seasonStart = new Date(year, season.startMonth - 1, season.startDay);
        // Season end date in current year
        const seasonEnd = new Date(year, season.endMonth - 1, season.endDay);
        
        // Handle seasons that cross year boundary
        if (season.startMonth > season.endMonth) {
          // If month is after or equal to start month, compare with start date
          if (month >= season.startMonth && day >= season.startDay) {
            appliedSeason = {
              id: `template-${season.name}`,
              propertyId,
              name: season.name,
              seasonType: season.seasonType,
              startDate: formatDate(seasonStart),
              endDate: formatDate(new Date(year, 11, 31)), // Dec 31
              priceMultiplier: season.priceMultiplier,
              minimumStay: season.minimumStay,
              enabled: true
            };
            break;
          }
          // If month is before or equal to end month, compare with end date
          else if (month <= season.endMonth && day <= season.endDay) {
            appliedSeason = {
              id: `template-${season.name}`,
              propertyId,
              name: season.name,
              seasonType: season.seasonType,
              startDate: formatDate(new Date(year, 0, 1)), // Jan 1
              endDate: formatDate(seasonEnd),
              priceMultiplier: season.priceMultiplier,
              minimumStay: season.minimumStay,
              enabled: true
            };
            break;
          }
        }
        // Normal date range within same year
        else if (currentDate >= seasonStart && currentDate <= seasonEnd) {
          appliedSeason = {
            id: `template-${season.name}`,
            propertyId,
            name: season.name,
            seasonType: season.seasonType,
            startDate: formatDate(seasonStart),
            endDate: formatDate(seasonEnd),
            priceMultiplier: season.priceMultiplier,
            minimumStay: season.minimumStay,
            enabled: true
          };
          break;
        }
      }
    }
    
    // Apply season pricing if a season was found
    if (appliedSeason) {
      seasonId = appliedSeason.id;
      minimumStay = appliedSeason.minimumStay;
      // Apply the season price multiplier to the base price
      adjustedPrice = basePrice * appliedSeason.priceMultiplier;
    }
    
    // Check if this is a weekend
    const isWeekendDay = isWeekend(
      currentDate, 
      property.pricing.weekendPricing?.weekendDays || template.defaultPricing.weekendDays
    );
    
    // Apply weekend pricing if enabled
    if (isWeekendDay && property.pricing.weekendPricing?.enabled) {
      // Apply the weekend multiplier on top of any seasonal adjustments
      const weekendMultiplier = property.pricing.weekendPricing.priceMultiplier;
      adjustedPrice = adjustedPrice * weekendMultiplier;
    }
    
    // Apply date override if available
    if (override) {
      if (override.customPrice !== undefined) {
        adjustedPrice = override.flatRate ? override.customPrice : basePrice * (override.priceMultiplier || 1);
      }
      
      if (override.minimumStay !== undefined) {
        minimumStay = override.minimumStay;
      }
      
      available = override.available;
      reason = override.reason;
    }
    
    // Round the price to 2 decimal places
    adjustedPrice = Math.round(adjustedPrice * 100) / 100;
    
    // Add the price to the calendar - ensure all fields are defined (no undefined values)
    const priceEntry: DailyPrice = {
      basePrice,
      adjustedPrice,
      minimumStay,
      available,
      isWeekend: isWeekendDay
    };

    // Only add seasonId if it's defined
    if (seasonId) {
      priceEntry.seasonId = seasonId;
    }

    // Only add reason if it's defined
    if (reason) {
      priceEntry.reason = reason;
    }

    // Add to calendar
    priceCalendar.prices[dateStr] = priceEntry;
    
    // Move to the next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Save to Firestore
  await db.collection('priceCalendars').doc(priceCalendar.id).set(priceCalendar);
  console.log(`Generated price calendar for ${propertyId} for year ${year}`);
  
  // Also save as a JSON file for reference/backup
  const outputDir = path.resolve(__dirname, '../firestore/priceCalendars');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const filePath = path.join(outputDir, `${priceCalendar.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(priceCalendar, null, 2));
  console.log(`Saved price calendar to ${filePath}`);
}

// Main function to run the script
async function main() {
  try {
    // Initialize Firestore using the centralized implementation
    const db = getFirestoreDb();

    // Load data
    const { properties, templates, seasonalPricing, dateOverrides } = await loadData(db);
    
    // Define the date range for price generation
    const currentYear = new Date().getFullYear();
    const startDate = new Date(currentYear, 0, 1); // Jan 1 of current year
    const endDate = new Date(currentYear + 1, 11, 31); // Dec 31 of next year
    
    console.log(`Generating price calendars from ${formatDate(startDate)} to ${formatDate(endDate)}`);
    
    // Generate price calendars for each property
    for (const property of properties) {
      await generatePriceCalendar(
        db,
        property,
        templates,
        seasonalPricing,
        dateOverrides,
        startDate,
        endDate
      );
    }
    
    console.log('Successfully generated all price calendars');
  } catch (error) {
    console.error('Failed to generate price calendars:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);