'use server';

import { getAdminDb, Timestamp } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import {
  requireAdmin,
  filterBookingsForUser,
  filterPropertiesForUser,
  AuthorizationError,
} from '@/lib/authorization';
import { getDaysInMonth, addDays, startOfDay, differenceInDays } from 'date-fns';
import type { SerializableTimestamp } from '@/types';

const logger = loggers.admin;

// ============================================================================
// Types
// ============================================================================

export interface MonthlyData {
  month: number;
  monthLabel: string;
  revenue: number;
  accommodationRevenue: number;
  nights: number;
  bookings: number;
  adr: number;
  occupancy: number;
  prevYearRevenue: number;
  prevYearNights: number;
  prevYearAdr: number;
  prevYearOccupancy: number;
  revenueChangePercent: number | null;
}

export interface YearKPIs {
  totalRevenue: number;
  totalNights: number;
  totalBookings: number;
  adr: number;
  occupancyRate: number;
  revpar: number;
  prevYearRevenue: number;
  prevYearNights: number;
  prevYearBookings: number;
  prevYearAdr: number;
  prevYearOccupancy: number;
  prevYearRevpar: number;
  revenueChangePercent: number | null;
  nightsChangePercent: number | null;
  adrChangePercent: number | null;
  occupancyChangePercent: number | null;
  currency: string;
}

export interface ChartDataPoint {
  month: string;
  revenue: number;
  prevRevenue: number;
  nights: number;
  adr: number;
}

export interface Insight {
  type: 'positive' | 'negative' | 'neutral' | 'forward';
  title: string;
  description: string;
}

export interface SourceBreakdown {
  source: string;
  revenue: number;
  nights: number;
  bookings: number;
  percentage: number;
}

export interface ExtendedMetrics {
  avgLengthOfStay: number;
  prevAvgLengthOfStay: number;
  avgLeadTimeDays: number;
  prevAvgLeadTimeDays: number;
  cancellationRate: number;
  prevCancellationRate: number;
  weekendRevenuePercent: number;
  weekdayRevenuePercent: number;
}

export interface RevenueData {
  selectedYear: number;
  availableYears: number[];
  kpis: YearKPIs;
  monthlyData: MonthlyData[];
  chartData: ChartDataPoint[];
  insights: Insight[];
  sourceBreakdown: SourceBreakdown[];
  extendedMetrics: ExtendedMetrics;
  propertyCount: number;
  currency: string;
}

// All-years comparison types
export interface AllYearsYearSummary {
  year: number;
  revenue: number;
  nights: number;
  bookings: number;
  adr: number;
  occupancy: number;
  revpar: number;
}

export interface AllYearsMonthRow {
  month: number;
  monthLabel: string;
  years: Record<number, { revenue: number; nights: number }>;
}

export interface AllYearsData {
  availableYears: number[];
  yearlySummaries: AllYearsYearSummary[];
  monthlyGrid: AllYearsMonthRow[];
  insights: Insight[];
  currency: string;
  propertyCount: number;
}

// ============================================================================
// Helpers
// ============================================================================

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseTimestampToDate(ts: SerializableTimestamp | undefined | null): Date | null {
  if (!ts) return null;
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string') return new Date(ts);
  if (typeof ts === 'number') return new Date(ts);
  if (typeof ts === 'object' && '_seconds' in ts) {
    return new Date((ts as { _seconds: number })._seconds * 1000);
  }
  return null;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : null;
  return Math.round(((current - previous) / previous) * 100);
}

function formatCurrencyShort(amount: number, currency: string): string {
  if (amount >= 1000) {
    return `${Math.round(amount / 1000)}K ${currency}`;
  }
  return `${Math.round(amount)} ${currency}`;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 5 || day === 6; // Friday + Saturday nights
}

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  direct: 'Direct',
  airbnb: 'Airbnb',
  'booking.com': 'Booking.com',
  vrbo: 'VRBO',
  simulation: 'Simulation',
};

// ============================================================================
// Parsed booking type used internally
// ============================================================================

interface ParsedBooking {
  id: string;
  propertyId: string;
  status: string;
  source: string;
  checkInDate: Date | null;
  checkOutDate: Date | null;
  createdAt: Date | null;
  pricing: {
    total: number;
    accommodationTotal: number;
    numberOfNights: number;
    currency: string;
  };
}

// ============================================================================
// Shared data fetching
// ============================================================================

async function fetchAndParseBookings(propertyId?: string) {
  const user = await requireAdmin();
  const db = await getAdminDb();

  const [bookingsSnapshot, propertiesSnapshot] = await Promise.all([
    db.collection('bookings').get(),
    db.collection('properties').get(),
  ]);

  const allBookings: ParsedBooking[] = bookingsSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      propertyId: data.propertyId as string,
      status: data.status as string,
      source: (data.source as string) || 'direct',
      checkInDate: parseTimestampToDate(data.checkInDate),
      checkOutDate: parseTimestampToDate(data.checkOutDate),
      createdAt: parseTimestampToDate(data.createdAt),
      pricing: {
        total: (data.pricing?.total ?? 0) as number,
        accommodationTotal: (data.pricing?.accommodationTotal ?? 0) as number,
        numberOfNights: (data.pricing?.numberOfNights ?? 0) as number,
        currency: (data.pricing?.currency ?? 'RON') as string,
      },
    };
  });

  const filteredBookings = filterBookingsForUser(allBookings, user);

  const allProperties = propertiesSnapshot.docs.map(doc => ({
    id: doc.id,
    slug: doc.id,
    name: doc.data().name || doc.id,
    status: doc.data().status || 'active',
  }));
  const userProperties = filterPropertiesForUser(allProperties, user);
  const activeProperties = propertyId
    ? userProperties.filter(p => p.id === propertyId)
    : userProperties;
  const propertyCount = activeProperties.length;

  const propertyBookings = propertyId
    ? filteredBookings.filter(b => b.propertyId === propertyId)
    : filteredBookings;

  // Revenue bookings (confirmed + completed)
  const revenueBookings = propertyBookings.filter(
    b => b.status === 'confirmed' || b.status === 'completed'
  );

  // All bookings including cancelled (for cancellation rate)
  const allStatusBookings = propertyBookings.filter(
    b => b.status !== 'pending' && b.status !== 'payment_failed'
  );

  // Detect available years
  const yearsSet = new Set<number>();
  for (const b of revenueBookings) {
    if (b.checkInDate) yearsSet.add(b.checkInDate.getFullYear());
    if (b.checkOutDate) yearsSet.add(b.checkOutDate.getFullYear());
  }
  const availableYears = Array.from(yearsSet).sort((a, b) => a - b);

  const currency = revenueBookings[0]?.pricing.currency || 'RON';

  return {
    revenueBookings,
    allStatusBookings,
    propertyCount,
    availableYears,
    currency,
  };
}

// ============================================================================
// Night-by-night splitting helper
// ============================================================================

interface MonthBucket {
  revenue: number;
  accommodationRevenue: number;
  nights: number;
  bookings: number;
}

interface NightSplitResult {
  yearMonthBuckets: Map<string, MonthBucket>; // "YYYY-MM" key
  yearTotals: Map<number, { revenue: number; nights: number }>;
  weekendRevenue: number;
  weekdayRevenue: number;
}

function splitBookingsIntoMonths(
  bookings: ParsedBooking[],
  targetYears?: Set<number>,
): NightSplitResult {
  const yearMonthBuckets = new Map<string, MonthBucket>();
  const yearTotals = new Map<number, { revenue: number; nights: number }>();
  let weekendRevenue = 0;
  let weekdayRevenue = 0;

  const getBucket = (key: string): MonthBucket => {
    let bucket = yearMonthBuckets.get(key);
    if (!bucket) {
      bucket = { revenue: 0, accommodationRevenue: 0, nights: 0, bookings: 0 };
      yearMonthBuckets.set(key, bucket);
    }
    return bucket;
  };

  for (const b of bookings) {
    if (!b.checkInDate) continue;
    const totalNightsInBooking = b.pricing.numberOfNights || 1;

    const nightsByYearMonth = new Map<string, number>();
    const checkIn = startOfDay(b.checkInDate);
    const checkOut = b.checkOutDate ? startOfDay(b.checkOutDate) : addDays(checkIn, totalNightsInBooking);

    let cursor = checkIn;
    let nightCount = 0;
    let weekendNights = 0;
    while (cursor < checkOut && nightCount < 365) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth() + 1;
      const key = `${y}-${m}`;
      nightsByYearMonth.set(key, (nightsByYearMonth.get(key) || 0) + 1);
      if (isWeekend(cursor)) weekendNights++;
      cursor = addDays(cursor, 1);
      nightCount++;
    }

    const actualTotalNights = nightCount || 1;
    const revenuePerNight = b.pricing.total / actualTotalNights;

    // Weekend/weekday revenue
    weekendRevenue += revenuePerNight * weekendNights;
    weekdayRevenue += revenuePerNight * (actualTotalNights - weekendNights);

    for (const [key, nights] of nightsByYearMonth) {
      const [yStr, mStr] = key.split('-');
      const bYear = parseInt(yStr);
      const fraction = nights / actualTotalNights;

      // Year totals
      const yt = yearTotals.get(bYear) || { revenue: 0, nights: 0 };
      yt.revenue += b.pricing.total * fraction;
      yt.nights += nights;
      yearTotals.set(bYear, yt);

      // Monthly buckets — skip years we don't care about
      if (targetYears && !targetYears.has(bYear)) continue;

      const bucket = getBucket(key);
      bucket.revenue += b.pricing.total * fraction;
      bucket.accommodationRevenue += b.pricing.accommodationTotal * fraction;
      bucket.nights += nights;
    }

    // Booking count to check-in month
    const checkInYear = b.checkInDate.getFullYear();
    const checkInMonth = b.checkInDate.getMonth() + 1;
    if (!targetYears || targetYears.has(checkInYear)) {
      const bucket = getBucket(`${checkInYear}-${checkInMonth}`);
      bucket.bookings += 1;
    }
  }

  return { yearMonthBuckets, yearTotals, weekendRevenue, weekdayRevenue };
}

// ============================================================================
// Extended metrics computation
// ============================================================================

function computeExtendedMetrics(
  revenueBookings: ParsedBooking[],
  allStatusBookings: ParsedBooking[],
  year: number,
  weekendRevenue: number,
  weekdayRevenue: number,
): ExtendedMetrics {
  const prevYear = year - 1;

  // Filter by check-in year
  const currentYearRevBookings = revenueBookings.filter(b => b.checkInDate?.getFullYear() === year);
  const prevYearRevBookings = revenueBookings.filter(b => b.checkInDate?.getFullYear() === prevYear);
  const currentYearAllBookings = allStatusBookings.filter(b => b.checkInDate?.getFullYear() === year);
  const prevYearAllBookings = allStatusBookings.filter(b => b.checkInDate?.getFullYear() === prevYear);

  // Average length of stay
  const avgLOS = currentYearRevBookings.length > 0
    ? currentYearRevBookings.reduce((s, b) => s + b.pricing.numberOfNights, 0) / currentYearRevBookings.length
    : 0;
  const prevAvgLOS = prevYearRevBookings.length > 0
    ? prevYearRevBookings.reduce((s, b) => s + b.pricing.numberOfNights, 0) / prevYearRevBookings.length
    : 0;

  // Average lead time (days between createdAt and checkInDate)
  const leadTimes: number[] = [];
  const prevLeadTimes: number[] = [];
  for (const b of currentYearRevBookings) {
    if (b.createdAt && b.checkInDate) {
      const days = differenceInDays(b.checkInDate, b.createdAt);
      if (days >= 0) leadTimes.push(days);
    }
  }
  for (const b of prevYearRevBookings) {
    if (b.createdAt && b.checkInDate) {
      const days = differenceInDays(b.checkInDate, b.createdAt);
      if (days >= 0) prevLeadTimes.push(days);
    }
  }
  const avgLeadTime = leadTimes.length > 0
    ? Math.round(leadTimes.reduce((s, d) => s + d, 0) / leadTimes.length)
    : 0;
  const prevAvgLeadTime = prevLeadTimes.length > 0
    ? Math.round(prevLeadTimes.reduce((s, d) => s + d, 0) / prevLeadTimes.length)
    : 0;

  // Cancellation rate
  const cancelledCurrent = currentYearAllBookings.filter(b => b.status === 'cancelled').length;
  const cancelledPrev = prevYearAllBookings.filter(b => b.status === 'cancelled').length;
  const cancellationRate = currentYearAllBookings.length > 0
    ? Math.round((cancelledCurrent / currentYearAllBookings.length) * 100)
    : 0;
  const prevCancellationRate = prevYearAllBookings.length > 0
    ? Math.round((cancelledPrev / prevYearAllBookings.length) * 100)
    : 0;

  // Weekend vs weekday revenue
  const totalWkWd = weekendRevenue + weekdayRevenue;
  const weekendPct = totalWkWd > 0 ? Math.round((weekendRevenue / totalWkWd) * 100) : 0;

  return {
    avgLengthOfStay: Math.round(avgLOS * 10) / 10,
    prevAvgLengthOfStay: Math.round(prevAvgLOS * 10) / 10,
    avgLeadTimeDays: avgLeadTime,
    prevAvgLeadTimeDays: prevAvgLeadTime,
    cancellationRate,
    prevCancellationRate,
    weekendRevenuePercent: weekendPct,
    weekdayRevenuePercent: 100 - weekendPct,
  };
}

// ============================================================================
// Source breakdown computation
// ============================================================================

function computeSourceBreakdown(
  revenueBookings: ParsedBooking[],
  year: number,
): SourceBreakdown[] {
  const yearBookings = revenueBookings.filter(b => b.checkInDate?.getFullYear() === year);
  const sourceMap = new Map<string, { revenue: number; nights: number; bookings: number }>();

  for (const b of yearBookings) {
    const source = b.source || 'direct';
    const existing = sourceMap.get(source) || { revenue: 0, nights: 0, bookings: 0 };
    existing.revenue += b.pricing.total;
    existing.nights += b.pricing.numberOfNights;
    existing.bookings += 1;
    sourceMap.set(source, existing);
  }

  const totalRevenue = yearBookings.reduce((s, b) => s + b.pricing.total, 0);

  return Array.from(sourceMap.entries())
    .map(([source, data]) => ({
      source: SOURCE_LABELS[source] || source,
      revenue: Math.round(data.revenue),
      nights: data.nights,
      bookings: data.bookings,
      percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ============================================================================
// Insight Generation
// ============================================================================

function generateInsights(
  selectedYear: number,
  currentYearMonths: Map<number, MonthBucket>,
  prevYearMonths: Map<number, MonthBucket>,
  propertyCount: number,
  currency: string,
  allYearBookings: { year: number; revenue: number; nights: number }[],
  extendedMetrics: ExtendedMetrics,
): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();
  const currentCalendarYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isCurrentYear = selectedYear === currentCalendarYear;

  let totalRevenue = 0;
  let totalNights = 0;
  let prevTotalRevenue = 0;
  let prevTotalNights = 0;

  for (const [, bucket] of currentYearMonths) {
    totalRevenue += bucket.revenue;
    totalNights += bucket.nights;
  }
  for (const [, bucket] of prevYearMonths) {
    prevTotalRevenue += bucket.revenue;
    prevTotalNights += bucket.nights;
  }

  // 1. YoY Revenue Growth
  if (prevTotalRevenue > 0) {
    const growthPct = Math.round(((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100);
    if (growthPct > 0) {
      insights.push({
        type: 'positive',
        title: `Revenue grew ${growthPct}% year-over-year`,
        description: `${selectedYear}: ${Math.round(totalRevenue).toLocaleString()} ${currency} vs ${selectedYear - 1}: ${Math.round(prevTotalRevenue).toLocaleString()} ${currency}`,
      });
    } else if (growthPct < 0) {
      insights.push({
        type: 'negative',
        title: `Revenue declined ${Math.abs(growthPct)}% year-over-year`,
        description: `${selectedYear}: ${Math.round(totalRevenue).toLocaleString()} ${currency} vs ${selectedYear - 1}: ${Math.round(prevTotalRevenue).toLocaleString()} ${currency}`,
      });
    }
  }

  // 2. Best performing month
  const maxMonth = isCurrentYear ? currentMonth : 12;
  let bestMonth = 0;
  let bestRevenue = 0;

  for (let m = 1; m <= maxMonth; m++) {
    const rev = currentYearMonths.get(m)?.revenue ?? 0;
    if (rev > bestRevenue) {
      bestRevenue = rev;
      bestMonth = m;
    }
  }

  if (bestMonth > 0 && bestRevenue > 0) {
    insights.push({
      type: 'positive',
      title: `Best month: ${MONTH_LABELS[bestMonth - 1]}`,
      description: `${formatCurrencyShort(bestRevenue, currency)} revenue with ${currentYearMonths.get(bestMonth)?.nights ?? 0} nights booked`,
    });
  }

  // 3. Occupancy gaps
  if (maxMonth >= 3) {
    let totalOccupancy = 0;
    let monthsWithData = 0;
    const monthOccupancies: { month: number; occupancy: number }[] = [];

    for (let m = 1; m <= maxMonth; m++) {
      const nights = currentYearMonths.get(m)?.nights ?? 0;
      const daysInMonth = getDaysInMonth(new Date(selectedYear, m - 1));
      const occ = propertyCount > 0 ? (nights / (daysInMonth * propertyCount)) * 100 : 0;
      totalOccupancy += occ;
      monthsWithData++;
      monthOccupancies.push({ month: m, occupancy: occ });
    }

    const avgOccupancy = monthsWithData > 0 ? totalOccupancy / monthsWithData : 0;
    const gapMonths = monthOccupancies
      .filter(m => m.occupancy < avgOccupancy * 0.7 && m.occupancy < 50)
      .sort((a, b) => a.occupancy - b.occupancy);

    if (gapMonths.length > 0 && gapMonths.length <= 4) {
      const names = gapMonths.map(m => MONTH_LABELS[m.month - 1]).join(', ');
      const avgGapOcc = Math.round(gapMonths.reduce((s, m) => s + m.occupancy, 0) / gapMonths.length);
      insights.push({
        type: 'negative',
        title: `Low occupancy: ${names}`,
        description: `Average ${avgGapOcc}% occupancy — consider promotions or rate adjustments to fill gaps`,
      });
    }
  }

  // 4. ADR Trend
  if (prevTotalNights > 0 && totalNights > 0) {
    let currentAccom = 0;
    let prevAccom = 0;
    for (const [, b] of currentYearMonths) currentAccom += b.accommodationRevenue;
    for (const [, b] of prevYearMonths) prevAccom += b.accommodationRevenue;

    const currentAdr = currentAccom / totalNights;
    const prevAdr = prevAccom / prevTotalNights;
    const adrChange = Math.round(((currentAdr - prevAdr) / prevAdr) * 100);

    if (Math.abs(adrChange) >= 3) {
      insights.push({
        type: adrChange > 0 ? 'positive' : 'negative',
        title: `ADR ${adrChange > 0 ? 'increased' : 'decreased'} ${Math.abs(adrChange)}%`,
        description: `${Math.round(currentAdr)} ${currency}/night vs ${Math.round(prevAdr)} ${currency}/night last year`,
      });
    }
  }

  // 5. Weekend vs weekday split
  if (extendedMetrics.weekendRevenuePercent > 0) {
    const wkPct = extendedMetrics.weekendRevenuePercent;
    if (wkPct >= 55) {
      insights.push({
        type: 'neutral',
        title: `${wkPct}% revenue from weekends`,
        description: `Fri-Sat nights drive most income — weekday promotions could boost overall occupancy`,
      });
    } else if (wkPct <= 35) {
      insights.push({
        type: 'positive',
        title: `Balanced weekday/weekend mix`,
        description: `${wkPct}% weekends, ${100 - wkPct}% weekdays — healthy distribution across the week`,
      });
    }
  }

  // 6. Booking lead time insight
  if (extendedMetrics.avgLeadTimeDays > 0) {
    if (extendedMetrics.avgLeadTimeDays <= 7) {
      insights.push({
        type: 'neutral',
        title: `Guests book ${extendedMetrics.avgLeadTimeDays} days ahead`,
        description: `Short lead time suggests last-minute demand — consider dynamic pricing for last-week availability`,
      });
    } else if (extendedMetrics.avgLeadTimeDays >= 30) {
      insights.push({
        type: 'positive',
        title: `Guests book ${extendedMetrics.avgLeadTimeDays} days ahead`,
        description: `Strong forward planning by guests — consider early-bird discounts to lock in bookings even sooner`,
      });
    }
  }

  // 7. Cancellation rate
  if (extendedMetrics.cancellationRate >= 15) {
    insights.push({
      type: 'negative',
      title: `${extendedMetrics.cancellationRate}% cancellation rate`,
      description: `Higher than typical (5-10%) — consider stricter cancellation policies or non-refundable rate options`,
    });
  }

  // 8. Forward-looking revenue
  if (isCurrentYear) {
    let futureRevenue = 0;
    let futureBookings = 0;
    for (let m = currentMonth + 1; m <= 12; m++) {
      const bucket = currentYearMonths.get(m);
      if (bucket) {
        futureRevenue += bucket.revenue;
        futureBookings += bucket.bookings;
      }
    }
    if (futureRevenue > 0) {
      insights.push({
        type: 'forward',
        title: `${formatCurrencyShort(futureRevenue, currency)} confirmed ahead`,
        description: `${futureBookings} booking${futureBookings !== 1 ? 's' : ''} confirmed for the remaining months of ${selectedYear}`,
      });
    }
  }

  // 9. Revenue projection
  if (isCurrentYear && currentMonth >= 2 && totalRevenue > 0 && prevTotalRevenue > 0) {
    const monthsElapsed = currentMonth;
    const projectedAnnual = Math.round((totalRevenue / monthsElapsed) * 12);
    const vsPrev = Math.round(((projectedAnnual - prevTotalRevenue) / prevTotalRevenue) * 100);
    insights.push({
      type: vsPrev >= 0 ? 'forward' : 'neutral',
      title: `Projected ${selectedYear}: ~${formatCurrencyShort(projectedAnnual, currency)}`,
      description: `Based on ${monthsElapsed}-month run rate — ${vsPrev >= 0 ? '+' : ''}${vsPrev}% vs ${selectedYear - 1} total of ${formatCurrencyShort(prevTotalRevenue, currency)}`,
    });
  }

  // 10. Multi-year growth trajectory
  if (allYearBookings.length >= 3) {
    const sorted = [...allYearBookings].sort((a, b) => a.year - b.year);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (first.revenue > 0 && last.revenue > first.revenue) {
      const years = last.year - first.year;
      const totalGrowth = Math.round(((last.revenue - first.revenue) / first.revenue) * 100);
      insights.push({
        type: 'positive',
        title: `${totalGrowth}% growth over ${years} year${years > 1 ? 's' : ''}`,
        description: `From ${formatCurrencyShort(first.revenue, currency)} (${first.year}) to ${formatCurrencyShort(last.revenue, currency)} (${last.year})`,
      });
    }
  }

  return insights;
}

// ============================================================================
// Main Server Action: Single Year
// ============================================================================

const EMPTY_EXTENDED_METRICS: ExtendedMetrics = {
  avgLengthOfStay: 0, prevAvgLengthOfStay: 0,
  avgLeadTimeDays: 0, prevAvgLeadTimeDays: 0,
  cancellationRate: 0, prevCancellationRate: 0,
  weekendRevenuePercent: 0, weekdayRevenuePercent: 0,
};

export async function fetchRevenueData(
  year: number,
  propertyId?: string
): Promise<RevenueData> {
  const emptyData: RevenueData = {
    selectedYear: year,
    availableYears: [year],
    kpis: {
      totalRevenue: 0, totalNights: 0, totalBookings: 0,
      adr: 0, occupancyRate: 0, revpar: 0,
      prevYearRevenue: 0, prevYearNights: 0, prevYearBookings: 0,
      prevYearAdr: 0, prevYearOccupancy: 0, prevYearRevpar: 0,
      revenueChangePercent: null, nightsChangePercent: null,
      adrChangePercent: null, occupancyChangePercent: null,
      currency: 'RON',
    },
    monthlyData: MONTH_LABELS.map((label, i) => ({
      month: i + 1, monthLabel: label,
      revenue: 0, accommodationRevenue: 0, nights: 0, bookings: 0,
      adr: 0, occupancy: 0,
      prevYearRevenue: 0, prevYearNights: 0, prevYearAdr: 0, prevYearOccupancy: 0,
      revenueChangePercent: null,
    })),
    chartData: MONTH_LABELS.map(label => ({
      month: label, revenue: 0, prevRevenue: 0, nights: 0, adr: 0,
    })),
    insights: [],
    sourceBreakdown: [],
    extendedMetrics: EMPTY_EXTENDED_METRICS,
    propertyCount: 0,
    currency: 'RON',
  };

  try {
    const { revenueBookings, allStatusBookings, propertyCount, availableYears, currency } =
      await fetchAndParseBookings(propertyId);

    if (availableYears.length === 0) return emptyData;

    const prevYear = year - 1;
    const targetYears = new Set([year, prevYear]);

    // Night-by-night splitting
    const { yearMonthBuckets, yearTotals, weekendRevenue, weekdayRevenue } =
      splitBookingsIntoMonths(revenueBookings, targetYears);

    // Extract month buckets for current and prev year
    const currentYearMonths = new Map<number, MonthBucket>();
    const prevYearMonths = new Map<number, MonthBucket>();
    for (const [key, bucket] of yearMonthBuckets) {
      const [yStr, mStr] = key.split('-');
      const bYear = parseInt(yStr);
      const bMonth = parseInt(mStr);
      if (bYear === year) currentYearMonths.set(bMonth, bucket);
      else if (bYear === prevYear) prevYearMonths.set(bMonth, bucket);
    }

    // Build monthly data
    const monthlyData: MonthlyData[] = MONTH_LABELS.map((label, i) => {
      const m = i + 1;
      const current = currentYearMonths.get(m) || { revenue: 0, accommodationRevenue: 0, nights: 0, bookings: 0 };
      const prev = prevYearMonths.get(m) || { revenue: 0, accommodationRevenue: 0, nights: 0, bookings: 0 };

      const daysInMonth = getDaysInMonth(new Date(year, i));
      const prevDaysInMonth = getDaysInMonth(new Date(prevYear, i));

      const occupancy = propertyCount > 0 ? Math.round((current.nights / (daysInMonth * propertyCount)) * 100) : 0;
      const prevOccupancy = propertyCount > 0 ? Math.round((prev.nights / (prevDaysInMonth * propertyCount)) * 100) : 0;
      const adr = current.nights > 0 ? Math.round(current.accommodationRevenue / current.nights) : 0;
      const prevAdr = prev.nights > 0 ? Math.round(prev.accommodationRevenue / prev.nights) : 0;

      return {
        month: m, monthLabel: label,
        revenue: Math.round(current.revenue),
        accommodationRevenue: Math.round(current.accommodationRevenue),
        nights: current.nights, bookings: current.bookings,
        adr, occupancy,
        prevYearRevenue: Math.round(prev.revenue), prevYearNights: prev.nights,
        prevYearAdr: prevAdr, prevYearOccupancy: prevOccupancy,
        revenueChangePercent: pctChange(current.revenue, prev.revenue),
      };
    });

    const chartData: ChartDataPoint[] = monthlyData.map(m => ({
      month: m.monthLabel, revenue: m.revenue, prevRevenue: m.prevYearRevenue,
      nights: m.nights, adr: m.adr,
    }));

    // KPI totals
    const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
    const totalAccom = monthlyData.reduce((s, m) => s + m.accommodationRevenue, 0);
    const totalNights = monthlyData.reduce((s, m) => s + m.nights, 0);
    const totalBookings = monthlyData.reduce((s, m) => s + m.bookings, 0);
    const prevTotalRevenue = monthlyData.reduce((s, m) => s + m.prevYearRevenue, 0);
    const prevTotalAccom = monthlyData.reduce((s, m) => s + (prevYearMonths.get(m.month)?.accommodationRevenue ?? 0), 0);
    const prevTotalNights = monthlyData.reduce((s, m) => s + m.prevYearNights, 0);
    const prevTotalBookings = Array.from(prevYearMonths.values()).reduce((s, b) => s + b.bookings, 0);

    const totalAvailableDays = Array.from({ length: 12 }, (_, i) =>
      getDaysInMonth(new Date(year, i))
    ).reduce((s, d) => s + d, 0) * propertyCount;

    const prevTotalAvailableDays = Array.from({ length: 12 }, (_, i) =>
      getDaysInMonth(new Date(prevYear, i))
    ).reduce((s, d) => s + d, 0) * propertyCount;

    const overallAdr = totalNights > 0 ? Math.round(totalAccom / totalNights) : 0;
    const prevAdr = prevTotalNights > 0 ? Math.round(prevTotalAccom / prevTotalNights) : 0;
    const occupancyRate = totalAvailableDays > 0 ? Math.round((totalNights / totalAvailableDays) * 100) : 0;
    const prevOccupancy = prevTotalAvailableDays > 0 ? Math.round((prevTotalNights / prevTotalAvailableDays) * 100) : 0;
    const revpar = totalAvailableDays > 0 ? Math.round(totalRevenue / (totalAvailableDays / propertyCount)) : 0;
    const prevRevpar = prevTotalAvailableDays > 0 ? Math.round(prevTotalRevenue / (prevTotalAvailableDays / propertyCount)) : 0;

    const kpis: YearKPIs = {
      totalRevenue, totalNights, totalBookings,
      adr: overallAdr, occupancyRate, revpar,
      prevYearRevenue: prevTotalRevenue, prevYearNights: prevTotalNights,
      prevYearBookings: prevTotalBookings,
      prevYearAdr: prevAdr, prevYearOccupancy: prevOccupancy, prevYearRevpar: prevRevpar,
      revenueChangePercent: pctChange(totalRevenue, prevTotalRevenue),
      nightsChangePercent: pctChange(totalNights, prevTotalNights),
      adrChangePercent: pctChange(overallAdr, prevAdr),
      occupancyChangePercent: pctChange(occupancyRate, prevOccupancy),
      currency,
    };

    // Source breakdown
    const sourceBreakdown = computeSourceBreakdown(revenueBookings, year);

    // Extended metrics
    const extendedMetrics = computeExtendedMetrics(
      revenueBookings, allStatusBookings, year, weekendRevenue, weekdayRevenue,
    );

    // Insights
    const allYearBookingsList = Array.from(yearTotals.entries()).map(([y, data]) => ({
      year: y, revenue: data.revenue, nights: data.nights,
    }));

    const insights = generateInsights(
      year, currentYearMonths, prevYearMonths,
      propertyCount, currency, allYearBookingsList, extendedMetrics,
    );

    logger.info('Revenue data fetched', {
      year, propertyId: propertyId || 'all',
      bookings: totalBookings, revenue: totalRevenue,
    });

    return {
      selectedYear: year, availableYears, kpis,
      monthlyData, chartData, insights,
      sourceBreakdown, extendedMetrics,
      propertyCount, currency,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchRevenueData');
      return emptyData;
    }
    logger.error('Error fetching revenue data', error as Error);
    return emptyData;
  }
}

// ============================================================================
// All-Years Comparison Server Action
// ============================================================================

export async function fetchAllYearsData(
  propertyId?: string
): Promise<AllYearsData> {
  const emptyData: AllYearsData = {
    availableYears: [],
    yearlySummaries: [],
    monthlyGrid: MONTH_LABELS.map((label, i) => ({
      month: i + 1, monthLabel: label, years: {},
    })),
    insights: [],
    currency: 'RON',
    propertyCount: 0,
  };

  try {
    const { revenueBookings, propertyCount, availableYears, currency } =
      await fetchAndParseBookings(propertyId);

    if (availableYears.length === 0) return emptyData;

    // Split all bookings into all years
    const { yearMonthBuckets, yearTotals } = splitBookingsIntoMonths(revenueBookings);

    // Build yearly summaries
    const yearlySummaries: AllYearsYearSummary[] = availableYears.map(y => {
      const yt = yearTotals.get(y) || { revenue: 0, nights: 0 };
      let accomRevenue = 0;
      let bookings = 0;
      for (let m = 1; m <= 12; m++) {
        const bucket = yearMonthBuckets.get(`${y}-${m}`);
        if (bucket) {
          accomRevenue += bucket.accommodationRevenue;
          bookings += bucket.bookings;
        }
      }
      const totalAvailableDays = Array.from({ length: 12 }, (_, i) =>
        getDaysInMonth(new Date(y, i))
      ).reduce((s, d) => s + d, 0) * propertyCount;

      return {
        year: y,
        revenue: Math.round(yt.revenue),
        nights: yt.nights,
        bookings,
        adr: yt.nights > 0 ? Math.round(accomRevenue / yt.nights) : 0,
        occupancy: totalAvailableDays > 0 ? Math.round((yt.nights / totalAvailableDays) * 100) : 0,
        revpar: totalAvailableDays > 0 ? Math.round(yt.revenue / (totalAvailableDays / propertyCount)) : 0,
      };
    });

    // Build monthly grid
    const monthlyGrid: AllYearsMonthRow[] = MONTH_LABELS.map((label, i) => {
      const m = i + 1;
      const years: Record<number, { revenue: number; nights: number }> = {};
      for (const y of availableYears) {
        const bucket = yearMonthBuckets.get(`${y}-${m}`);
        years[y] = {
          revenue: Math.round(bucket?.revenue ?? 0),
          nights: bucket?.nights ?? 0,
        };
      }
      return { month: m, monthLabel: label, years };
    });

    // All-years insights
    const insights: Insight[] = [];

    // CAGR
    if (yearlySummaries.length >= 2) {
      const first = yearlySummaries[0];
      const last = yearlySummaries[yearlySummaries.length - 1];
      if (first.revenue > 0 && last.revenue > 0) {
        const years = last.year - first.year;
        if (years > 0) {
          const cagr = Math.round((Math.pow(last.revenue / first.revenue, 1 / years) - 1) * 100);
          insights.push({
            type: cagr > 0 ? 'positive' : 'negative',
            title: `${cagr}% compound annual growth rate`,
            description: `From ${formatCurrencyShort(first.revenue, currency)} (${first.year}) to ${formatCurrencyShort(last.revenue, currency)} (${last.year}) over ${years} years`,
          });
        }
      }
    }

    // All-time totals
    const totalRevenue = yearlySummaries.reduce((s, y) => s + y.revenue, 0);
    const totalNights = yearlySummaries.reduce((s, y) => s + y.nights, 0);
    insights.push({
      type: 'neutral',
      title: `All-time: ${formatCurrencyShort(totalRevenue, currency)} revenue`,
      description: `${totalNights} total nights across ${availableYears.length} years of operation`,
    });

    // Best year
    const bestYear = yearlySummaries.reduce((best, y) => y.revenue > best.revenue ? y : best, yearlySummaries[0]);
    if (bestYear) {
      insights.push({
        type: 'positive',
        title: `Best year: ${bestYear.year}`,
        description: `${formatCurrencyShort(bestYear.revenue, currency)} revenue, ${bestYear.nights} nights, ${bestYear.occupancy}% occupancy`,
      });
    }

    // Most consistent month (highest across all years)
    let bestMonthIdx = 0;
    let bestMonthTotal = 0;
    for (let i = 0; i < 12; i++) {
      const total = availableYears.reduce((s, y) => s + (monthlyGrid[i].years[y]?.revenue ?? 0), 0);
      if (total > bestMonthTotal) {
        bestMonthTotal = total;
        bestMonthIdx = i;
      }
    }
    insights.push({
      type: 'positive',
      title: `Strongest month overall: ${MONTH_LABELS[bestMonthIdx]}`,
      description: `${formatCurrencyShort(bestMonthTotal, currency)} cumulative revenue across all years`,
    });

    logger.info('All-years revenue data fetched', {
      propertyId: propertyId || 'all',
      years: availableYears.length,
    });

    return {
      availableYears, yearlySummaries, monthlyGrid, insights, currency, propertyCount,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchAllYearsData');
      return emptyData;
    }
    logger.error('Error fetching all-years data', error as Error);
    return emptyData;
  }
}
