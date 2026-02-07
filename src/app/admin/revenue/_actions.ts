'use server';

import { getAdminDb, Timestamp } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import {
  requireAdmin,
  filterBookingsForUser,
  filterPropertiesForUser,
  AuthorizationError,
} from '@/lib/authorization';
import { getDaysInMonth, format } from 'date-fns';
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
  prevYearRevenue: number;
  prevYearNights: number;
  prevYearBookings: number;
  prevYearAdr: number;
  prevYearOccupancy: number;
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

export interface RevenueData {
  selectedYear: number;
  availableYears: number[];
  kpis: YearKPIs;
  monthlyData: MonthlyData[];
  chartData: ChartDataPoint[];
  insights: Insight[];
  propertyCount: number;
  currency: string;
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

// ============================================================================
// Insight Generation
// ============================================================================

interface MonthBucket {
  revenue: number;
  accommodationRevenue: number;
  nights: number;
  bookings: number;
}

function generateInsights(
  selectedYear: number,
  currentYearMonths: Map<number, MonthBucket>,
  prevYearMonths: Map<number, MonthBucket>,
  propertyCount: number,
  currency: string,
  allYearBookings: { year: number; revenue: number; nights: number }[],
): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();
  const currentCalendarYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isCurrentYear = selectedYear === currentCalendarYear;

  // Totals for selected year
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
        description: `${selectedYear} total: ${Math.round(totalRevenue).toLocaleString()} ${currency} vs ${selectedYear - 1}: ${Math.round(prevTotalRevenue).toLocaleString()} ${currency}`,
      });
    } else if (growthPct < 0) {
      insights.push({
        type: 'negative',
        title: `Revenue declined ${Math.abs(growthPct)}% year-over-year`,
        description: `${selectedYear} total: ${Math.round(totalRevenue).toLocaleString()} ${currency} vs ${selectedYear - 1}: ${Math.round(prevTotalRevenue).toLocaleString()} ${currency}`,
      });
    }
  }

  // 2. Best performing month (only past months)
  const maxMonth = isCurrentYear ? currentMonth : 12;
  let bestMonth = 0;
  let bestRevenue = 0;
  let worstMonth = 0;
  let worstRevenue = Infinity;

  for (let m = 1; m <= maxMonth; m++) {
    const bucket = currentYearMonths.get(m);
    const rev = bucket?.revenue ?? 0;
    if (rev > bestRevenue) {
      bestRevenue = rev;
      bestMonth = m;
    }
    if (rev < worstRevenue) {
      worstRevenue = rev;
      worstMonth = m;
    }
  }

  if (bestMonth > 0 && bestRevenue > 0) {
    insights.push({
      type: 'positive',
      title: `Best month: ${MONTH_LABELS[bestMonth - 1]}`,
      description: `${formatCurrencyShort(bestRevenue, currency)} revenue with ${currentYearMonths.get(bestMonth)?.nights ?? 0} nights booked`,
    });
  }

  // 3. Occupancy gaps — months below average
  if (maxMonth >= 3) {
    let totalOccupancy = 0;
    let monthsWithData = 0;
    const monthOccupancies: { month: number; occupancy: number; nights: number }[] = [];

    for (let m = 1; m <= maxMonth; m++) {
      const bucket = currentYearMonths.get(m);
      const nights = bucket?.nights ?? 0;
      const daysInMonth = getDaysInMonth(new Date(selectedYear, m - 1));
      const occ = propertyCount > 0 ? (nights / (daysInMonth * propertyCount)) * 100 : 0;
      totalOccupancy += occ;
      monthsWithData++;
      monthOccupancies.push({ month: m, occupancy: occ, nights });
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
        description: `Average ${avgGapOcc}% occupancy in these months — consider promotions or rate adjustments to fill gaps`,
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
        description: `Average daily rate: ${Math.round(currentAdr)} ${currency}/night vs ${Math.round(prevAdr)} ${currency}/night last year`,
      });
    }
  }

  // 5. Forward-looking revenue (future confirmed bookings in selected year)
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

  // 6. Revenue projection (current year only)
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

  // 7. Multi-year growth trajectory
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
        description: `Revenue grew from ${formatCurrencyShort(first.revenue, currency)} (${first.year}) to ${formatCurrencyShort(last.revenue, currency)} (${last.year})`,
      });
    }
  }

  return insights;
}

// ============================================================================
// Main Server Action
// ============================================================================

export async function fetchRevenueData(
  year: number,
  propertyId?: string
): Promise<RevenueData> {
  const emptyData: RevenueData = {
    selectedYear: year,
    availableYears: [year],
    kpis: {
      totalRevenue: 0, totalNights: 0, totalBookings: 0,
      adr: 0, occupancyRate: 0,
      prevYearRevenue: 0, prevYearNights: 0, prevYearBookings: 0,
      prevYearAdr: 0, prevYearOccupancy: 0,
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
    propertyCount: 0,
    currency: 'RON',
  };

  try {
    const user = await requireAdmin();
    const db = await getAdminDb();

    // Fetch bookings and properties in parallel
    const [bookingsSnapshot, propertiesSnapshot] = await Promise.all([
      db.collection('bookings').get(),
      db.collection('properties').get(),
    ]);

    // Parse and filter bookings
    const allBookings = bookingsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        propertyId: data.propertyId as string,
        status: data.status as string,
        checkInDate: parseTimestampToDate(data.checkInDate),
        pricing: {
          total: (data.pricing?.total ?? 0) as number,
          accommodationTotal: (data.pricing?.accommodationTotal ?? 0) as number,
          numberOfNights: (data.pricing?.numberOfNights ?? 0) as number,
          currency: (data.pricing?.currency ?? 'RON') as string,
        },
      };
    });

    const filteredBookings = filterBookingsForUser(allBookings, user);

    // Property count
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

    // Filter by property if specified
    const propertyBookings = propertyId
      ? filteredBookings.filter(b => b.propertyId === propertyId)
      : filteredBookings;

    // Only confirmed + completed
    const revenueBookings = propertyBookings.filter(
      b => b.status === 'confirmed' || b.status === 'completed'
    );

    // Detect available years
    const yearsSet = new Set<number>();
    for (const b of revenueBookings) {
      if (b.checkInDate) {
        yearsSet.add(b.checkInDate.getFullYear());
      }
    }
    const availableYears = Array.from(yearsSet).sort((a, b) => a - b);

    if (availableYears.length === 0) {
      return emptyData;
    }

    // Detect currency
    const currency = revenueBookings[0]?.pricing.currency || 'RON';

    // Bucket by month
    const currentYearMonths = new Map<number, MonthBucket>();
    const prevYearMonths = new Map<number, MonthBucket>();
    const prevYear = year - 1;

    // Also collect per-year totals for multi-year insight
    const yearTotals = new Map<number, { revenue: number; nights: number }>();

    for (const b of revenueBookings) {
      if (!b.checkInDate) continue;
      const bYear = b.checkInDate.getFullYear();
      const bMonth = b.checkInDate.getMonth() + 1;

      // Year totals
      const yt = yearTotals.get(bYear) || { revenue: 0, nights: 0 };
      yt.revenue += b.pricing.total;
      yt.nights += b.pricing.numberOfNights;
      yearTotals.set(bYear, yt);

      // Monthly buckets
      const targetMap = bYear === year ? currentYearMonths : bYear === prevYear ? prevYearMonths : null;
      if (!targetMap) continue;

      const existing = targetMap.get(bMonth) || { revenue: 0, accommodationRevenue: 0, nights: 0, bookings: 0 };
      existing.revenue += b.pricing.total;
      existing.accommodationRevenue += b.pricing.accommodationTotal;
      existing.nights += b.pricing.numberOfNights;
      existing.bookings += 1;
      targetMap.set(bMonth, existing);
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
        month: m,
        monthLabel: label,
        revenue: Math.round(current.revenue),
        accommodationRevenue: Math.round(current.accommodationRevenue),
        nights: current.nights,
        bookings: current.bookings,
        adr,
        occupancy,
        prevYearRevenue: Math.round(prev.revenue),
        prevYearNights: prev.nights,
        prevYearAdr: prevAdr,
        prevYearOccupancy: prevOccupancy,
        revenueChangePercent: pctChange(current.revenue, prev.revenue),
      };
    });

    // Chart data
    const chartData: ChartDataPoint[] = monthlyData.map(m => ({
      month: m.monthLabel,
      revenue: m.revenue,
      prevRevenue: m.prevYearRevenue,
      nights: m.nights,
      adr: m.adr,
    }));

    // KPI totals
    const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
    const totalAccom = monthlyData.reduce((s, m) => s + m.accommodationRevenue, 0);
    const totalNights = monthlyData.reduce((s, m) => s + m.nights, 0);
    const totalBookings = monthlyData.reduce((s, m) => s + m.bookings, 0);
    const prevTotalRevenue = monthlyData.reduce((s, m) => s + m.prevYearRevenue, 0);
    const prevTotalAccom = monthlyData.reduce((s, m) => s + (prevYearMonths.get(m.month)?.accommodationRevenue ?? 0), 0);
    const prevTotalNights = monthlyData.reduce((s, m) => s + m.prevYearNights, 0);
    const prevTotalBookings = prevYearMonths.size > 0
      ? Array.from(prevYearMonths.values()).reduce((s, b) => s + b.bookings, 0)
      : 0;

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

    const kpis: YearKPIs = {
      totalRevenue,
      totalNights,
      totalBookings,
      adr: overallAdr,
      occupancyRate,
      prevYearRevenue: prevTotalRevenue,
      prevYearNights: prevTotalNights,
      prevYearBookings: prevTotalBookings,
      prevYearAdr: prevAdr,
      prevYearOccupancy: prevOccupancy,
      revenueChangePercent: pctChange(totalRevenue, prevTotalRevenue),
      nightsChangePercent: pctChange(totalNights, prevTotalNights),
      adrChangePercent: pctChange(overallAdr, prevAdr),
      occupancyChangePercent: pctChange(occupancyRate, prevOccupancy),
      currency,
    };

    // Generate insights
    const allYearBookingsList = Array.from(yearTotals.entries()).map(([y, data]) => ({
      year: y,
      revenue: data.revenue,
      nights: data.nights,
    }));

    const insights = generateInsights(
      year,
      currentYearMonths,
      prevYearMonths,
      propertyCount,
      currency,
      allYearBookingsList,
    );

    logger.info('Revenue data fetched', {
      year,
      propertyId: propertyId || 'all',
      bookings: totalBookings,
      revenue: totalRevenue,
    });

    return {
      selectedYear: year,
      availableYears,
      kpis,
      monthlyData,
      chartData,
      insights,
      propertyCount,
      currency,
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
