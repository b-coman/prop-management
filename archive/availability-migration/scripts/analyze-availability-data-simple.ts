/**
 * Simplified availability data analysis without complex queries
 * Focuses on comparing availability and priceCalendars collections
 */

import { getFirestoreForPricing } from '../src/lib/firebaseAdminPricing';
import { format, addMonths, isValid } from 'date-fns';
import * as fs from 'fs';
import * as path from 'path';

interface SimplifiedReport {
  timestamp: string;
  properties: PropertyAnalysis[];
  summary: {
    totalProperties: number;
    totalDiscrepancies: number;
    criticalDiscrepancies: number;
    monthsAnalyzed: number;
  };
  recommendations: string[];
}

interface PropertyAnalysis {
  propertyId: string;
  discrepancies: DiscrepancyRecord[];
  monthsAnalyzed: string[];
  healthScore: number;
}

interface DiscrepancyRecord {
  date: string;
  month: string;
  day: number;
  availabilityValue: boolean | null;
  priceCalendarValue: boolean | null;
  holdId?: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

async function analyzeAvailabilitySimple(): Promise<SimplifiedReport> {
  console.log('🔍 Starting Simplified Availability Data Analysis');
  console.log('================================================');
  
  const db = await getFirestoreForPricing();
  if (!db) {
    throw new Error('Failed to connect to Firestore');
  }

  // Get properties
  console.log('📋 Fetching properties...');
  const propertiesSnapshot = await db.collection('properties').get();
  const propertyIds = propertiesSnapshot.docs.map(doc => doc.id);
  console.log(`📊 Found ${propertyIds.length} properties to analyze`);

  // Generate months to analyze (past 6 months + next 6 months)
  const monthsToAnalyze = generateMonthsToAnalyze();
  console.log(`📅 Analyzing ${monthsToAnalyze.length} months: ${monthsToAnalyze[0]} to ${monthsToAnalyze[monthsToAnalyze.length - 1]}`);

  const propertyAnalyses: PropertyAnalysis[] = [];
  let totalDiscrepancies = 0;
  let criticalDiscrepancies = 0;

  // Analyze each property
  for (let i = 0; i < propertyIds.length; i++) {
    const propertyId = propertyIds[i];
    console.log(`\n🏠 Analyzing property ${i + 1}/${propertyIds.length}: ${propertyId}`);
    
    const analysis = await analyzePropertySimple(db, propertyId, monthsToAnalyze);
    propertyAnalyses.push(analysis);
    
    totalDiscrepancies += analysis.discrepancies.length;
    criticalDiscrepancies += analysis.discrepancies.filter(d => d.severity === 'high').length;
    
    console.log(`   ✅ Found ${analysis.discrepancies.length} discrepancies (${analysis.discrepancies.filter(d => d.severity === 'high').length} critical)`);
  }

  const report: SimplifiedReport = {
    timestamp: new Date().toISOString(),
    properties: propertyAnalyses,
    summary: {
      totalProperties: propertyIds.length,
      totalDiscrepancies,
      criticalDiscrepancies,
      monthsAnalyzed: monthsToAnalyze.length
    },
    recommendations: generateSimpleRecommendations(propertyAnalyses)
  };

  // Save report
  const reportPath = await saveSimpleReport(report);
  console.log(`\n📄 Report saved: ${reportPath}`);

  return report;
}

function generateMonthsToAnalyze(): string[] {
  const months: string[] = [];
  const today = new Date();
  
  // Past 6 months
  for (let i = 6; i >= 0; i--) {
    const date = addMonths(today, -i);
    months.push(format(date, 'yyyy-MM'));
  }
  
  // Next 6 months
  for (let i = 1; i <= 6; i++) {
    const date = addMonths(today, i);
    months.push(format(date, 'yyyy-MM'));
  }
  
  return months;
}

async function analyzePropertySimple(
  db: FirebaseFirestore.Firestore,
  propertyId: string,
  months: string[]
): Promise<PropertyAnalysis> {
  const discrepancies: DiscrepancyRecord[] = [];
  const analyzedMonths: string[] = [];

  for (const month of months) {
    try {
      const monthDiscrepancies = await analyzePropertyMonth(db, propertyId, month);
      discrepancies.push(...monthDiscrepancies);
      analyzedMonths.push(month);
    } catch (error) {
      console.warn(`   ⚠️  Warning: Could not analyze ${propertyId} for ${month}:`, error);
    }
  }

  const healthScore = calculateHealthScore(discrepancies, analyzedMonths.length);

  return {
    propertyId,
    discrepancies,
    monthsAnalyzed: analyzedMonths,
    healthScore
  };
}

async function analyzePropertyMonth(
  db: FirebaseFirestore.Firestore,
  propertyId: string,
  month: string
): Promise<DiscrepancyRecord[]> {
  const discrepancies: DiscrepancyRecord[] = [];
  const docId = `${propertyId}_${month}`;

  // Get both documents
  const [availabilityDoc, priceCalendarDoc] = await Promise.all([
    db.collection('availability').doc(docId).get(),
    db.collection('priceCalendars').doc(docId).get()
  ]);

  const availabilityData = availabilityDoc.exists ? availabilityDoc.data() : null;
  const priceCalendarData = priceCalendarDoc.exists ? priceCalendarDoc.data() : null;

  // If neither exists, that's fine
  if (!availabilityData && !priceCalendarData) {
    return discrepancies;
  }

  // Get all days from both collections
  const availabilityDays = availabilityData?.available ? Object.keys(availabilityData.available) : [];
  const priceCalendarDays = priceCalendarData?.days ? Object.keys(priceCalendarData.days) : [];
  const allDays = new Set([...availabilityDays, ...priceCalendarDays]);

  // Check each day
  for (const dayStr of allDays) {
    const day = parseInt(dayStr, 10);
    if (isNaN(day) || day < 1 || day > 31) continue;

    const [year, monthNum] = month.split('-').map(Number);
    const date = new Date(year, monthNum - 1, day);
    
    if (!isValid(date)) continue;

    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Get availability values
    const availabilityValue = availabilityData?.available?.[dayStr];
    const priceCalendarValue = priceCalendarData?.days?.[dayStr]?.available;
    const holdId = availabilityData?.holds?.[dayStr];

    // Check for discrepancies
    if (availabilityValue !== undefined && priceCalendarValue !== undefined) {
      // Both collections have data for this day
      if (availabilityValue !== priceCalendarValue) {
        discrepancies.push({
          date: dateStr,
          month,
          day,
          availabilityValue,
          priceCalendarValue,
          holdId,
          severity: determineSeverity(availabilityValue, priceCalendarValue, date),
          description: `Availability: ${availabilityValue}, PriceCalendars: ${priceCalendarValue}${holdId ? ` (Hold: ${holdId})` : ''}`
        });
      }
    } else if (availabilityValue !== undefined && priceCalendarValue === undefined) {
      // Only in availability collection
      discrepancies.push({
        date: dateStr,
        month,
        day,
        availabilityValue,
        priceCalendarValue: null,
        holdId,
        severity: 'medium',
        description: `Only in availability collection: ${availabilityValue}${holdId ? ` (Hold: ${holdId})` : ''}`
      });
    } else if (availabilityValue === undefined && priceCalendarValue !== undefined) {
      // Only in price calendars collection
      discrepancies.push({
        date: dateStr,
        month,
        day,
        availabilityValue: null,
        priceCalendarValue,
        severity: 'medium',
        description: `Only in priceCalendars collection: ${priceCalendarValue}`
      });
    }
  }

  return discrepancies;
}

function determineSeverity(
  availabilityValue: boolean,
  priceCalendarValue: boolean,
  date: Date
): 'low' | 'medium' | 'high' {
  const now = new Date();
  const isNearFuture = date > now && date < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  // High severity for near future discrepancies
  if (isNearFuture) {
    return 'high';
  }
  
  // Medium severity for past or distant future
  return 'medium';
}

function calculateHealthScore(discrepancies: DiscrepancyRecord[], monthsAnalyzed: number): number {
  if (monthsAnalyzed === 0) return 100;
  
  const maxPossibleIssues = monthsAnalyzed * 31;
  const actualIssues = discrepancies.length;
  
  return Math.max(0, Math.round(100 - (actualIssues / maxPossibleIssues) * 100));
}

function generateSimpleRecommendations(properties: PropertyAnalysis[]): string[] {
  const recommendations: string[] = [];
  const totalDiscrepancies = properties.reduce((sum, p) => sum + p.discrepancies.length, 0);
  const criticalDiscrepancies = properties.reduce((sum, p) => 
    sum + p.discrepancies.filter(d => d.severity === 'high').length, 0);
  
  if (criticalDiscrepancies > 0) {
    recommendations.push(`🚨 URGENT: ${criticalDiscrepancies} critical discrepancies found in near-future dates. These could impact live bookings.`);
  }
  
  if (totalDiscrepancies > 0) {
    recommendations.push(`🔧 Total cleanup needed: ${totalDiscrepancies} discrepancies across ${properties.length} properties.`);
  }
  
  const unhealthyProperties = properties.filter(p => p.healthScore < 80);
  if (unhealthyProperties.length > 0) {
    recommendations.push(`⚠️  Properties needing attention: ${unhealthyProperties.map(p => `${p.propertyId} (${p.healthScore}%)`).join(', ')}`);
  }
  
  if (totalDiscrepancies === 0) {
    recommendations.push(`✅ Excellent! No discrepancies found. Safe to proceed with migration.`);
  }
  
  return recommendations;
}

async function saveSimpleReport(report: SimplifiedReport): Promise<string> {
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  const filename = `availability-analysis-simple-${timestamp}.json`;
  const logsDir = path.join(process.cwd(), 'logs');
  
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  const filepath = path.join(logsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  
  // Also save human-readable summary
  const summaryPath = path.join(logsDir, `availability-summary-${timestamp}.txt`);
  const summary = generateReadableSummary(report);
  fs.writeFileSync(summaryPath, summary);
  
  return filepath;
}

function generateReadableSummary(report: SimplifiedReport): string {
  const { summary } = report;
  
  return `
AVAILABILITY DATA ANALYSIS - SIMPLIFIED REPORT
Generated: ${report.timestamp}
===============================================

📊 OVERVIEW
- Properties Analyzed: ${summary.totalProperties}
- Months Analyzed: ${summary.monthsAnalyzed}
- Total Discrepancies: ${summary.totalDiscrepancies}
- Critical Discrepancies: ${summary.criticalDiscrepancies}

📋 RECOMMENDATIONS
${report.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

📈 PROPERTY HEALTH SCORES
${report.properties
  .sort((a, b) => a.healthScore - b.healthScore)
  .map(p => `- ${p.propertyId}: ${p.healthScore}% (${p.discrepancies.length} discrepancies)`)
  .join('\n')}

🔍 SAMPLE DISCREPANCIES (First 10)
${report.properties
  .flatMap(p => p.discrepancies.map(d => ({ ...d, propertyId: p.propertyId })))
  .slice(0, 10)
  .map(d => `- ${d.propertyId} ${d.date}: ${d.description} [${d.severity}]`)
  .join('\n')}

===============================================
For detailed analysis, see the corresponding JSON report.
`;
}

// Main execution
async function main() {
  try {
    const report = await analyzeAvailabilitySimple();
    
    console.log('\n📊 ANALYSIS SUMMARY');
    console.log('==================');
    console.log(`Properties: ${report.summary.totalProperties}`);
    console.log(`Total discrepancies: ${report.summary.totalDiscrepancies}`);
    console.log(`Critical discrepancies: ${report.summary.criticalDiscrepancies}`);
    
    console.log('\n💡 RECOMMENDATIONS');
    console.log('==================');
    report.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { analyzeAvailabilitySimple };