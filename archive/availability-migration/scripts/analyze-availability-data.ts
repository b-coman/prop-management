/**
 * @fileoverview Production data analysis for availability deduplication
 * 
 * This script analyzes the current state of availability data across both
 * collections to identify discrepancies, expired holds, and inconsistencies
 * before migrating to single source of truth.
 */

import { getFirestoreForPricing } from '../src/lib/firebaseAdminPricing';
import { format, parseISO, isAfter, isBefore, isValid } from 'date-fns';
import * as fs from 'fs';
import * as path from 'path';

interface AnalysisReport {
  timestamp: string;
  properties: PropertyAnalysis[];
  summary: {
    totalProperties: number;
    propertiesWithDiscrepancies: number;
    totalDiscrepancies: number;
    expiredHolds: number;
    orphanedHolds: number;
    affectedDateRanges: number;
    estimatedRevenueLoss: number;
  };
  recommendations: string[];
}

interface PropertyAnalysis {
  propertyId: string;
  discrepancies: AvailabilityDiscrepancy[];
  expiredHolds: ExpiredHold[];
  orphanedHolds: OrphanedHold[];
  monthsAnalyzed: string[];
  healthScore: number; // 0-100, 100 = perfect consistency
}

interface AvailabilityDiscrepancy {
  date: string;
  availabilityCollection: boolean | null; // null if document missing
  priceCalendarsCollection: boolean | null;
  holdId?: string;
  severity: 'low' | 'medium' | 'high';
  recommendedAction: string;
}

interface ExpiredHold {
  bookingId: string;
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  holdUntil: string;
  daysPastExpiration: number;
  affectedDates: string[];
}

interface OrphanedHold {
  propertyId: string;
  month: string;
  date: string;
  holdId: string;
  hasCorrespondingBooking: boolean;
}

const ANALYSIS_CONFIG = {
  // How many months back to analyze
  MONTHS_TO_ANALYZE: 12,
  // How many months forward to analyze
  MONTHS_FORWARD: 6,
  // Average nightly rate for revenue loss estimation
  AVERAGE_NIGHTLY_RATE: 200,
  // Properties to analyze (empty = all)
  SPECIFIC_PROPERTIES: [] as string[]
};

async function analyzeAvailabilityData(): Promise<AnalysisReport> {
  console.log('🔍 Starting Production Availability Data Analysis');
  console.log('================================================');
  
  const startTime = Date.now();
  const db = await getFirestoreForPricing();
  
  if (!db) {
    throw new Error('Failed to connect to Firestore');
  }

  // Get list of properties to analyze
  const properties = await getPropertiesToAnalyze(db);
  console.log(`📊 Analyzing ${properties.length} properties`);

  const propertyAnalyses: PropertyAnalysis[] = [];
  let totalDiscrepancies = 0;
  let totalExpiredHolds = 0;
  let totalOrphanedHolds = 0;

  // Analyze each property
  for (let i = 0; i < properties.length; i++) {
    const propertyId = properties[i];
    console.log(`\n🏠 Analyzing property ${i + 1}/${properties.length}: ${propertyId}`);
    
    try {
      const analysis = await analyzeProperty(db, propertyId);
      propertyAnalyses.push(analysis);
      
      totalDiscrepancies += analysis.discrepancies.length;
      totalExpiredHolds += analysis.expiredHolds.length;
      totalOrphanedHolds += analysis.orphanedHolds.length;
      
      console.log(`   ✅ Completed: ${analysis.discrepancies.length} discrepancies, ${analysis.expiredHolds.length} expired holds`);
    } catch (error) {
      console.error(`   ❌ Error analyzing ${propertyId}:`, error);
      // Continue with other properties
    }
  }

  // Generate expired holds analysis
  console.log('\n📅 Analyzing expired bookings...');
  const expiredBookings = await analyzeExpiredBookings(db);
  console.log(`   Found ${expiredBookings.length} expired holds in bookings collection`);

  // Calculate summary statistics
  const propertiesWithDiscrepancies = propertyAnalyses.filter(p => p.discrepancies.length > 0).length;
  const estimatedRevenueLoss = calculateEstimatedRevenueLoss(propertyAnalyses, expiredBookings);

  const report: AnalysisReport = {
    timestamp: new Date().toISOString(),
    properties: propertyAnalyses,
    summary: {
      totalProperties: properties.length,
      propertiesWithDiscrepancies,
      totalDiscrepancies,
      expiredHolds: totalExpiredHolds + expiredBookings.length,
      orphanedHolds: totalOrphanedHolds,
      affectedDateRanges: calculateAffectedDateRanges(propertyAnalyses),
      estimatedRevenueLoss
    },
    recommendations: generateRecommendations(propertyAnalyses, expiredBookings)
  };

  const duration = (Date.now() - startTime) / 1000;
  console.log(`\n✅ Analysis completed in ${duration.toFixed(2)} seconds`);

  return report;
}

async function getPropertiesToAnalyze(db: FirebaseFirestore.Firestore): Promise<string[]> {
  if (ANALYSIS_CONFIG.SPECIFIC_PROPERTIES.length > 0) {
    return ANALYSIS_CONFIG.SPECIFIC_PROPERTIES;
  }

  console.log('📋 Fetching all properties...');
  const propertiesSnapshot = await db.collection('properties').get();
  return propertiesSnapshot.docs.map(doc => doc.id);
}

async function analyzeProperty(db: FirebaseFirestore.Firestore, propertyId: string): Promise<PropertyAnalysis> {
  const discrepancies: AvailabilityDiscrepancy[] = [];
  const orphanedHolds: OrphanedHold[] = [];
  const monthsAnalyzed: string[] = [];

  // Generate list of months to analyze
  const today = new Date();
  const monthsToCheck: string[] = [];
  
  // Past months
  for (let i = ANALYSIS_CONFIG.MONTHS_TO_ANALYZE; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthsToCheck.push(format(date, 'yyyy-MM'));
  }
  
  // Future months
  for (let i = 1; i <= ANALYSIS_CONFIG.MONTHS_FORWARD; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
    monthsToCheck.push(format(date, 'yyyy-MM'));
  }

  // Analyze each month
  for (const month of monthsToCheck) {
    try {
      const monthDiscrepancies = await analyzePropertyMonth(db, propertyId, month);
      const monthOrphanedHolds = await findOrphanedHoldsInMonth(db, propertyId, month);
      
      discrepancies.push(...monthDiscrepancies);
      orphanedHolds.push(...monthOrphanedHolds);
      monthsAnalyzed.push(month);
    } catch (error) {
      console.warn(`   ⚠️  Warning: Could not analyze ${propertyId} for ${month}:`, error);
    }
  }

  // Calculate health score
  const healthScore = calculatePropertyHealthScore(discrepancies, orphanedHolds, monthsAnalyzed.length);

  return {
    propertyId,
    discrepancies,
    expiredHolds: [], // Will be filled by separate expired bookings analysis
    orphanedHolds,
    monthsAnalyzed,
    healthScore
  };
}

async function analyzePropertyMonth(
  db: FirebaseFirestore.Firestore, 
  propertyId: string, 
  month: string
): Promise<AvailabilityDiscrepancy[]> {
  const discrepancies: AvailabilityDiscrepancy[] = [];
  
  // Get data from both collections
  const availabilityDocId = `${propertyId}_${month}`;
  
  const [availabilityDoc, priceCalendarDoc] = await Promise.all([
    db.collection('availability').doc(availabilityDocId).get(),
    db.collection('priceCalendars').doc(availabilityDocId).get()
  ]);

  const availabilityData = availabilityDoc.exists ? availabilityDoc.data() : null;
  const priceCalendarData = priceCalendarDoc.exists ? priceCalendarDoc.data() : null;

  if (!availabilityData && !priceCalendarData) {
    // No data in either collection for this month
    return discrepancies;
  }

  // Get all unique days from both collections
  const availabilityDays = availabilityData?.available ? Object.keys(availabilityData.available) : [];
  const priceCalendarDays = priceCalendarData?.days ? Object.keys(priceCalendarData.days) : [];
  const allDays = new Set([...availabilityDays, ...priceCalendarDays]);

  // Compare each day
  for (const day of allDays) {
    const dayNum = parseInt(day, 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) continue;

    const [year, monthNum] = month.split('-').map(Number);
    const date = new Date(year, monthNum - 1, dayNum);
    
    if (!isValid(date)) continue;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Get availability from both sources
    const availabilityValue = availabilityData?.available?.[day];
    const priceCalendarValue = priceCalendarData?.days?.[day]?.available;
    const holdId = availabilityData?.holds?.[day];

    // Check for discrepancies
    if (availabilityValue !== undefined && priceCalendarValue !== undefined) {
      if (availabilityValue !== priceCalendarValue) {
        const severity = determineSeverity(availabilityValue, priceCalendarValue, holdId, date);
        
        discrepancies.push({
          date: dateStr,
          availabilityCollection: availabilityValue,
          priceCalendarsCollection: priceCalendarValue,
          holdId,
          severity,
          recommendedAction: getRecommendedAction(availabilityValue, priceCalendarValue, holdId)
        });
      }
    } else if (availabilityValue !== undefined && priceCalendarValue === undefined) {
      // Available in availability collection but missing from price calendars
      discrepancies.push({
        date: dateStr,
        availabilityCollection: availabilityValue,
        priceCalendarsCollection: null,
        holdId,
        severity: 'medium',
        recommendedAction: 'Add missing date to priceCalendars or determine if availability entry is orphaned'
      });
    } else if (availabilityValue === undefined && priceCalendarValue !== undefined) {
      // Available in price calendars but missing from availability collection
      discrepancies.push({
        date: dateStr,
        availabilityCollection: null,
        priceCalendarsCollection: priceCalendarValue,
        holdId,
        severity: 'medium',
        recommendedAction: 'Add missing date to availability collection or determine if priceCalendars entry is obsolete'
      });
    }
  }

  return discrepancies;
}

async function findOrphanedHoldsInMonth(
  db: FirebaseFirestore.Firestore,
  propertyId: string,
  month: string
): Promise<OrphanedHold[]> {
  const orphanedHolds: OrphanedHold[] = [];
  
  const availabilityDocId = `${propertyId}_${month}`;
  const availabilityDoc = await db.collection('availability').doc(availabilityDocId).get();
  
  if (!availabilityDoc.exists) {
    return orphanedHolds;
  }

  const availabilityData = availabilityDoc.data();
  const holds = availabilityData?.holds || {};

  // Check each hold
  for (const [day, holdId] of Object.entries(holds)) {
    if (!holdId || typeof holdId !== 'string') continue;

    // Check if corresponding booking exists
    try {
      const bookingDoc = await db.collection('bookings').doc(holdId).get();
      const hasCorrespondingBooking = bookingDoc.exists;

      if (!hasCorrespondingBooking) {
        orphanedHolds.push({
          propertyId,
          month,
          date: `${month}-${day.padStart(2, '0')}`,
          holdId,
          hasCorrespondingBooking: false
        });
      }
    } catch (error) {
      console.warn(`Warning: Could not check booking ${holdId}:`, error);
      orphanedHolds.push({
        propertyId,
        month,
        date: `${month}-${day.padStart(2, '0')}`,
        holdId,
        hasCorrespondingBooking: false // Assume orphaned if we can't verify
      });
    }
  }

  return orphanedHolds;
}

async function analyzeExpiredBookings(db: FirebaseFirestore.Firestore): Promise<ExpiredHold[]> {
  const expiredHolds: ExpiredHold[] = [];
  const now = new Date();

  // Query for expired holds
  const expiredHoldsQuery = db.collection('bookings')
    .where('status', '==', 'on-hold')
    .where('holdUntil', '<=', now);

  const snapshot = await expiredHoldsQuery.get();

  snapshot.forEach(doc => {
    const data = doc.data();
    const holdUntil = data.holdUntil?.toDate?.() || parseISO(data.holdUntil);
    const checkInDate = data.checkInDate?.toDate?.() || parseISO(data.checkInDate);
    const checkOutDate = data.checkOutDate?.toDate?.() || parseISO(data.checkOutDate);

    if (holdUntil && checkInDate && checkOutDate) {
      const daysPastExpiration = Math.floor((now.getTime() - holdUntil.getTime()) / (1000 * 60 * 60 * 24));
      
      // Generate affected dates
      const affectedDates: string[] = [];
      let currentDate = new Date(checkInDate);
      while (currentDate < checkOutDate) {
        affectedDates.push(format(currentDate, 'yyyy-MM-dd'));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      expiredHolds.push({
        bookingId: doc.id,
        propertyId: data.propertyId,
        checkInDate: format(checkInDate, 'yyyy-MM-dd'),
        checkOutDate: format(checkOutDate, 'yyyy-MM-dd'),
        holdUntil: format(holdUntil, 'yyyy-MM-dd HH:mm:ss'),
        daysPastExpiration,
        affectedDates
      });
    }
  });

  return expiredHolds;
}

function determineSeverity(
  availabilityValue: boolean,
  priceCalendarValue: boolean,
  holdId: string | undefined,
  date: Date
): 'low' | 'medium' | 'high' {
  const now = new Date();
  const isNearFuture = date > now && date < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Next 30 days

  // High severity: Could impact bookings in near future
  if (isNearFuture) {
    if (availabilityValue === true && priceCalendarValue === false) {
      return 'high'; // Date appears bookable but is blocked in pricing
    }
    if (availabilityValue === false && priceCalendarValue === true) {
      return 'high'; // Date appears blocked but is bookable in pricing
    }
  }

  // Medium severity: Has holds or affects past/distant future
  if (holdId || !isNearFuture) {
    return 'medium';
  }

  // Low severity: Minor inconsistencies
  return 'low';
}

function getRecommendedAction(
  availabilityValue: boolean,
  priceCalendarValue: boolean,
  holdId: string | undefined
): string {
  if (holdId) {
    return `Verify hold ${holdId} is valid. If expired, release hold and mark date as available in both collections.`;
  }

  if (availabilityValue === false && priceCalendarValue === true) {
    return 'Check if there is a confirmed booking for this date. If yes, update priceCalendars to unavailable. If no, release date in availability collection.';
  }

  if (availabilityValue === true && priceCalendarValue === false) {
    return 'Verify if date should be blocked. If not, update priceCalendars to available. If yes, update availability collection to unavailable.';
  }

  return 'Manual review required to determine correct state.';
}

function calculatePropertyHealthScore(
  discrepancies: AvailabilityDiscrepancy[],
  orphanedHolds: OrphanedHold[],
  monthsAnalyzed: number
): number {
  if (monthsAnalyzed === 0) return 0;

  const totalIssues = discrepancies.length + orphanedHolds.length;
  const maxPossibleIssues = monthsAnalyzed * 31; // Worst case: every day has an issue
  
  const healthScore = Math.max(0, 100 - (totalIssues / maxPossibleIssues) * 100);
  return Math.round(healthScore);
}

function calculateAffectedDateRanges(propertyAnalyses: PropertyAnalysis[]): number {
  const affectedDates = new Set<string>();
  
  propertyAnalyses.forEach(property => {
    property.discrepancies.forEach(discrepancy => {
      affectedDates.add(discrepancy.date);
    });
    property.orphanedHolds.forEach(hold => {
      affectedDates.add(hold.date);
    });
  });
  
  return affectedDates.size;
}

function calculateEstimatedRevenueLoss(
  propertyAnalyses: PropertyAnalysis[],
  expiredBookings: ExpiredHold[]
): number {
  let totalLoss = 0;

  // Calculate loss from discrepancies (dates that appear available but are blocked)
  propertyAnalyses.forEach(property => {
    property.discrepancies.forEach(discrepancy => {
      if (discrepancy.availabilityCollection === true && discrepancy.priceCalendarsCollection === false) {
        // Date appears available but is blocked in pricing system
        totalLoss += ANALYSIS_CONFIG.AVERAGE_NIGHTLY_RATE;
      }
    });
  });

  // Calculate loss from expired holds
  expiredBookings.forEach(expiredHold => {
    totalLoss += expiredHold.affectedDates.length * ANALYSIS_CONFIG.AVERAGE_NIGHTLY_RATE;
  });

  return totalLoss;
}

function generateRecommendations(
  propertyAnalyses: PropertyAnalysis[],
  expiredBookings: ExpiredHold[]
): string[] {
  const recommendations: string[] = [];

  const totalDiscrepancies = propertyAnalyses.reduce((sum, p) => sum + p.discrepancies.length, 0);
  const totalOrphanedHolds = propertyAnalyses.reduce((sum, p) => sum + p.orphanedHolds.length, 0);

  if (expiredBookings.length > 0) {
    recommendations.push(`URGENT: Deploy hold cleanup automation immediately. ${expiredBookings.length} expired holds are blocking dates unnecessarily.`);
  }

  if (totalDiscrepancies > 0) {
    recommendations.push(`Run data cleanup script to resolve ${totalDiscrepancies} availability discrepancies across ${propertyAnalyses.length} properties.`);
  }

  if (totalOrphanedHolds > 0) {
    recommendations.push(`Clean up ${totalOrphanedHolds} orphaned holds that reference non-existent bookings.`);
  }

  const criticalProperties = propertyAnalyses.filter(p => p.healthScore < 70);
  if (criticalProperties.length > 0) {
    recommendations.push(`Priority attention needed for ${criticalProperties.length} properties with health scores below 70%: ${criticalProperties.map(p => p.propertyId).join(', ')}`);
  }

  if (totalDiscrepancies === 0 && totalOrphanedHolds === 0 && expiredBookings.length === 0) {
    recommendations.push('✅ Data is in excellent condition. Safe to proceed with availability deduplication migration.');
  } else {
    recommendations.push('🔧 Complete data cleanup before proceeding with availability deduplication migration.');
  }

  return recommendations;
}

async function saveAnalysisReport(report: AnalysisReport): Promise<string> {
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  const filename = `availability-analysis-${timestamp}.json`;
  const filepath = path.join(process.cwd(), 'logs', filename);

  // Ensure logs directory exists
  const logsDir = path.dirname(filepath);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Save detailed JSON report
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

  // Also save a human-readable summary
  const summaryPath = path.join(logsDir, `availability-analysis-summary-${timestamp}.txt`);
  const summary = generateHumanReadableSummary(report);
  fs.writeFileSync(summaryPath, summary);

  return filepath;
}

function generateHumanReadableSummary(report: AnalysisReport): string {
  const { summary, recommendations } = report;
  
  return `
AVAILABILITY DATA ANALYSIS SUMMARY
Generated: ${report.timestamp}
===============================================

📊 OVERVIEW
- Total Properties Analyzed: ${summary.totalProperties}
- Properties with Issues: ${summary.propertiesWithDiscrepancies}
- Health Score: ${Math.round((1 - summary.propertiesWithDiscrepancies / summary.totalProperties) * 100)}%

🔍 ISSUES FOUND
- Availability Discrepancies: ${summary.totalDiscrepancies}
- Expired Holds: ${summary.expiredHolds}
- Orphaned Holds: ${summary.orphanedHolds}
- Affected Date Ranges: ${summary.affectedDateRanges}

💰 FINANCIAL IMPACT
- Estimated Revenue Loss: $${summary.estimatedRevenueLoss.toLocaleString()}

📋 RECOMMENDATIONS
${recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

📈 PROPERTY HEALTH SCORES
${report.properties
  .sort((a, b) => a.healthScore - b.healthScore)
  .slice(0, 10)
  .map(p => `- ${p.propertyId}: ${p.healthScore}% (${p.discrepancies.length} discrepancies, ${p.orphanedHolds.length} orphaned holds)`)
  .join('\n')}

===============================================
For detailed analysis, see the corresponding JSON report.
`;
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting availability data analysis...');
    
    const report = await analyzeAvailabilityData();
    const reportPath = await saveAnalysisReport(report);
    
    console.log('\n📊 ANALYSIS SUMMARY');
    console.log('==================');
    console.log(`Properties analyzed: ${report.summary.totalProperties}`);
    console.log(`Properties with issues: ${report.summary.propertiesWithDiscrepancies}`);
    console.log(`Total discrepancies: ${report.summary.totalDiscrepancies}`);
    console.log(`Expired holds: ${report.summary.expiredHolds}`);
    console.log(`Orphaned holds: ${report.summary.orphanedHolds}`);
    console.log(`Estimated revenue loss: $${report.summary.estimatedRevenueLoss.toLocaleString()}`);
    
    console.log('\n💡 TOP RECOMMENDATIONS');
    console.log('=====================');
    report.recommendations.slice(0, 3).forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
    
    console.log(`\n📄 Detailed report saved: ${reportPath}`);
    console.log('🎉 Analysis completed successfully!');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { analyzeAvailabilityData, AnalysisReport };