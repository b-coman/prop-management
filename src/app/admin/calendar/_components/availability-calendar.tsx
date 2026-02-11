'use client';

import { useState, useCallback, useTransition, useMemo } from 'react';
import { format, addMonths, subMonths, getDaysInMonth } from 'date-fns';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  Globe,
  Ban,
  Loader2,
  DollarSign,
  Settings2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/utils';
import type { MonthAvailabilityData, DayStatus } from '../_lib/availability-types';
import { fetchAvailabilityCalendarData, toggleDateBlocked, toggleDateRangeBlocked } from '../actions';
import { DayDetailPopover } from './day-detail-popover';

interface AvailabilityCalendarProps {
  propertyId: string;
  initialMonths: MonthAvailabilityData[];
}

// Uniform cell tints — subtle background storytelling
const STATUS_CONFIG: Record<DayStatus, { bg: string; icon: React.ReactNode; label: string }> = {
  available: {
    bg: 'bg-white hover:bg-slate-50',
    icon: null,
    label: '',
  },
  booked: {
    bg: 'bg-emerald-50/60',
    icon: <CheckCircle className="h-3 w-3 text-emerald-500" />,
    label: '',
  },
  'on-hold': {
    bg: 'bg-amber-50/60',
    icon: <Clock className="h-3 w-3 text-amber-500" />,
    label: '',
  },
  'external-block': {
    bg: 'bg-blue-50',
    icon: <Globe className="h-3 w-3 text-blue-500" />,
    label: '',
  },
  'manual-block': {
    bg: 'bg-slate-100 hover:bg-slate-200',
    icon: <Ban className="h-3 w-3 text-slate-400" />,
    label: 'Blocked',
  },
};

const WEEKDAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const getPriceColor = (price: number, min: number, max: number): string => {
  if (!min || !max || min === max) return '';
  const ratio = (price - min) / (max - min);
  if (ratio < 0.25) return 'bg-emerald-50/80';
  if (ratio < 0.5) return 'bg-sky-50/80';
  if (ratio < 0.75) return 'bg-amber-50/80';
  return 'bg-rose-50/80';
};

// --- Floating bar overlay computation ---

interface BookingInfo {
  guestName: string;
  source?: string;
  barColor: 'emerald' | 'amber';
  nightDays: number[];
  checkoutDay: number | null;
  checkInDay: number | null;
}

interface BarSegment {
  bookingId: string;
  guestName: string;
  source?: string;
  barColor: 'emerald' | 'amber';
  leftPercent: number;
  rightPercent: number;
}

function collectBookings(mData: MonthAvailabilityData): Map<string, BookingInfo> {
  const bookings = new Map<string, BookingInfo>();

  for (const dayStr of Object.keys(mData.days)) {
    const d = Number(dayStr);
    const dayData = mData.days[d];

    // Booked nights
    if ((dayData.status === 'booked' || dayData.status === 'on-hold') && dayData.bookingId) {
      let booking = bookings.get(dayData.bookingId);
      if (!booking) {
        booking = {
          guestName: dayData.bookingDetails?.guestName || 'Guest',
          source: dayData.bookingDetails?.source,
          barColor: dayData.status === 'on-hold' ? 'amber' : 'emerald',
          nightDays: [],
          checkoutDay: null,
          checkInDay: null,
        };
        bookings.set(dayData.bookingId, booking);
      }
      booking.nightDays.push(d);
      if (dayData.bookingPosition === 'start' || dayData.bookingPosition === 'single') {
        booking.checkInDay = d;
      }
    }

    // Checkout days
    if (dayData.checkoutBooking) {
      const coId = dayData.checkoutBooking.bookingId;
      let booking = bookings.get(coId);
      if (!booking) {
        booking = {
          guestName: dayData.checkoutBooking.guestName,
          source: dayData.checkoutBooking.source,
          barColor: dayData.checkoutBooking.barColor,
          nightDays: [],
          checkoutDay: null,
          checkInDay: null,
        };
        bookings.set(coId, booking);
      }
      booking.checkoutDay = d;
    }
  }

  for (const booking of bookings.values()) {
    booking.nightDays.sort((a, b) => a - b);
  }

  return bookings;
}

function computeBarSegments(
  week: (number | null)[],
  bookings: Map<string, BookingInfo>
): BarSegment[] {
  const segments: BarSegment[] = [];
  const colWidth = 100 / 7;

  for (const [bookingId, booking] of bookings) {
    const colsInRow: { col: number; day: number; isCheckout: boolean }[] = [];

    for (let col = 0; col < 7; col++) {
      const day = week[col];
      if (day === null) continue;
      const isNight = booking.nightDays.includes(day);
      const isCheckout = booking.checkoutDay === day;
      if (isNight || isCheckout) {
        colsInRow.push({ col, day, isCheckout });
      }
    }

    if (colsInRow.length === 0) continue;

    const isCheckIn = booking.checkInDay !== null
      && colsInRow.some(c => c.day === booking.checkInDay);
    const hasCheckout = colsInRow.some(c => c.isCheckout);

    // Left edge
    let leftPercent: number;
    if (isCheckIn) {
      const checkInCol = colsInRow.find(c => c.day === booking.checkInDay)!.col;
      leftPercent = checkInCol * colWidth + 0.5 * colWidth;
    } else {
      // Continues from previous row/month
      leftPercent = 0;
    }

    // Right edge (distance from right)
    let rightPercent: number;
    if (hasCheckout) {
      const checkoutCol = colsInRow.find(c => c.isCheckout)!.col;
      rightPercent = (7 - checkoutCol - 0.3) * colWidth;
    } else {
      // Continues to next row/month
      rightPercent = 0;
    }

    segments.push({
      bookingId,
      guestName: booking.guestName,
      source: booking.source,
      barColor: booking.barColor,
      leftPercent,
      rightPercent,
    });
  }

  return segments;
}

function getBarLabel(segment: BarSegment): string {
  const colWidth = 100 / 7;
  const widthPercent = 100 - segment.leftPercent - segment.rightPercent;
  const effectiveCols = widthPercent / colWidth;

  if (effectiveCols >= 2.5) {
    return segment.source
      ? `${segment.guestName} \u00b7 ${segment.source}`
      : segment.guestName;
  }
  if (effectiveCols >= 1.3) {
    return segment.guestName;
  }
  return '';
}

// --- Main component ---

export function AvailabilityCalendar({ propertyId, initialMonths }: AvailabilityCalendarProps) {
  const [monthsData, setMonthsData] = useState<Record<string, MonthAvailabilityData>>(() => {
    const map: Record<string, MonthAvailabilityData> = {};
    for (const m of initialMonths) {
      map[m.month] = m;
    }
    return map;
  });

  const [startDate, setStartDate] = useState(() => {
    const [y, m] = initialMonths[0].month.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  const [isLoading, startTransition] = useTransition();
  const [popoverKey, setPopoverKey] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ yearMonth: string; day: number; action: 'block' | 'unblock' } | null>(null);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [showPrices, setShowPrices] = useState(false);
  const { toast } = useToast();

  const currency = Object.values(monthsData).find(m => m.currency)?.currency || 'EUR';

  const today = new Date();
  const todayYM = format(today, 'yyyy-MM');
  const todayDay = today.getDate();

  const visibleMonths = [0, 1, 2].map(i => {
    const d = addMonths(startDate, i);
    return format(d, 'yyyy-MM');
  });

  const loadVisibleMonths = useCallback((base: Date) => {
    const yms = [0, 1, 2].map(i => format(addMonths(base, i), 'yyyy-MM'));
    startTransition(async () => {
      try {
        const results = await Promise.all(
          yms.map(ym => fetchAvailabilityCalendarData(propertyId, ym))
        );
        setMonthsData(prev => {
          const next = { ...prev };
          for (const r of results) {
            next[r.month] = r;
          }
          return next;
        });
      } catch {
        toast({ title: 'Error', description: 'Failed to load calendar data', variant: 'destructive' });
      }
    });
  }, [propertyId, toast]);

  const navigate = useCallback((direction: -1 | 1) => {
    const newStart = direction === 1 ? addMonths(startDate, 1) : subMonths(startDate, 1);
    setStartDate(newStart);
    setAnchor(null);
    setPopoverKey(null);
    loadVisibleMonths(newStart);
  }, [startDate, loadVisibleMonths]);

  const isPast = (yearMonth: string, day: number) => {
    const [y, m] = yearMonth.split('-').map(Number);
    const dayDate = new Date(y, m - 1, day);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dayDate < todayStart;
  };

  const reloadMonth = useCallback((yearMonth: string) => {
    startTransition(async () => {
      try {
        const result = await fetchAvailabilityCalendarData(propertyId, yearMonth);
        setMonthsData(prev => ({ ...prev, [yearMonth]: result }));
      } catch {
        // silent
      }
    });
  }, [propertyId]);

  const handleDayClick = useCallback(async (yearMonth: string, day: number, e: React.MouseEvent) => {
    const mData = monthsData[yearMonth];
    if (!mData) return;
    const dayData = mData.days[day];
    if (!dayData || isPast(yearMonth, day)) return;

    const key = `${yearMonth}:${day}`;
    const { status } = dayData;

    // For booked/held/external: show popover
    if (status === 'booked' || status === 'on-hold' || status === 'external-block') {
      setPopoverKey(popoverKey === key ? null : key);
      return;
    }

    // Shift+click: range selection (same month only)
    if (e.shiftKey && anchor && anchor.yearMonth === yearMonth) {
      const from = Math.min(anchor.day, day);
      const to = Math.max(anchor.day, day);
      const dates: { yearMonth: string; day: number }[] = [];
      for (let d = from; d <= to; d++) {
        if (isPast(yearMonth, d)) continue;
        const ds = mData.days[d];
        if (!ds) continue;
        if (anchor.action === 'block' && ds.status === 'available') {
          dates.push({ yearMonth, day: d });
        } else if (anchor.action === 'unblock' && ds.status === 'manual-block') {
          dates.push({ yearMonth, day: d });
        }
      }

      if (dates.length === 0) return;

      const block = anchor.action === 'block';
      setMonthsData(prev => {
        const updated = { ...prev };
        const m = { ...updated[yearMonth], days: { ...updated[yearMonth].days }, summary: { ...updated[yearMonth].summary } };
        for (const { day: d } of dates) {
          m.days[d] = { ...m.days[d], status: block ? 'manual-block' : 'available' };
          if (block) { m.summary.available--; m.summary.manuallyBlocked++; }
          else { m.summary.manuallyBlocked--; m.summary.available++; }
        }
        updated[yearMonth] = m;
        return updated;
      });
      setAnchor(null);

      const result = await toggleDateRangeBlocked(propertyId, dates, block);
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        reloadMonth(yearMonth);
      } else if (result.skippedCount > 0) {
        toast({ title: 'Partial update', description: `${result.blockedCount} updated, ${result.skippedCount} skipped` });
        reloadMonth(yearMonth);
      }
      return;
    }

    // Single click: toggle
    const block = status === 'available';
    const action = block ? 'block' : 'unblock';
    setAnchor({ yearMonth, day, action });

    setPendingKeys(prev => new Set(prev).add(key));
    setMonthsData(prev => {
      const updated = { ...prev };
      const m = { ...updated[yearMonth], days: { ...updated[yearMonth].days }, summary: { ...updated[yearMonth].summary } };
      m.days[day] = { ...m.days[day], status: block ? 'manual-block' : 'available' };
      if (block) { m.summary.available--; m.summary.manuallyBlocked++; }
      else { m.summary.manuallyBlocked--; m.summary.available++; }
      updated[yearMonth] = m;
      return updated;
    });

    const result = await toggleDateBlocked(propertyId, yearMonth, day, block);
    setPendingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
      reloadMonth(yearMonth);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthsData, anchor, propertyId, toast, popoverKey, reloadMonth]);

  // Aggregate summary across visible months
  const totalSummary = visibleMonths.reduce(
    (acc, ym) => {
      const m = monthsData[ym];
      if (!m) return acc;
      acc.available += m.summary.available;
      acc.booked += m.summary.booked;
      acc.onHold += m.summary.onHold;
      acc.externallyBlocked += m.summary.externallyBlocked;
      acc.manuallyBlocked += m.summary.manuallyBlocked;
      return acc;
    },
    { available: 0, booked: 0, onHold: 0, externallyBlocked: 0, manuallyBlocked: 0 }
  );

  const globalPriceRange = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const ym of visibleMonths) {
      const m = monthsData[ym];
      if (m?.priceRange) {
        min = Math.min(min, m.priceRange.min);
        max = Math.max(max, m.priceRange.max);
      }
    }
    return min !== Infinity ? { min, max } : null;
  }, [visibleMonths, monthsData]);

  // --- Render month grid with floating bar overlays ---
  const renderMonthGrid = (yearMonth: string) => {
    const [y, m] = yearMonth.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    const dim = getDaysInMonth(date);
    const firstDow = date.getDay();
    const isCurrentMonth = yearMonth === todayYM;
    const mData = monthsData[yearMonth];
    const cellH = showPrices ? 'h-[72px]' : 'h-[64px]';

    // Build weeks array
    const weeks: (number | null)[][] = [];
    let dc = 1;
    for (let w = 0; w < 6 && dc <= dim; w++) {
      const row: (number | null)[] = [];
      for (let wd = 0; wd < 7; wd++) {
        if ((w === 0 && wd < firstDow) || dc > dim) {
          row.push(null);
        } else {
          row.push(dc++);
        }
      }
      weeks.push(row);
    }

    // Collect bookings and compute bar segments per week row
    const bookingsMap = mData ? collectBookings(mData) : new Map<string, BookingInfo>();
    const weekSegments = weeks.map(week => computeBarSegments(week, bookingsMap));

    return (
      <div key={yearMonth} className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-center mb-2">
          {format(date, 'MMMM yyyy')}
        </h3>

        {/* Weekday headers */}
        <div className="grid grid-cols-7">
          {WEEKDAY_HEADERS.map((d, i) => (
            <div
              key={d}
              className={`text-center text-[10px] font-medium py-1 ${
                i === 0 || i === 6 ? 'text-rose-500' : 'text-muted-foreground'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Week rows — each is position:relative for bar overlays */}
        {weeks.map((week, wi) => (
          <div key={wi} className="relative grid grid-cols-7">
            {/* Uniform cells */}
            {week.map((day, di) => {
              if (day === null) {
                return (
                  <div key={`e-${wi}-${di}`} className="p-0.5">
                    <div className={`${cellH} transition-all duration-200`} />
                  </div>
                );
              }

              const dayData = mData?.days[day];
              if (!dayData) {
                return (
                  <div key={`nd-${day}`} className="p-0.5">
                    <div className={`${cellH} transition-all duration-200`} />
                  </div>
                );
              }

              const config = STATUS_CONFIG[dayData.status];
              const past = isPast(yearMonth, day);
              const isTodayCell = isCurrentMonth && day === todayDay;
              const cellKey = `${yearMonth}:${day}`;
              const isAnchorCell = anchor?.day === day && anchor?.yearMonth === yearMonth;
              const isPendingCell = pendingKeys.has(cellKey);
              const isClickable = !past;

              const priceOverlayBg = showPrices && dayData.price != null
                && dayData.status === 'available' && globalPriceRange
                ? getPriceColor(dayData.price, globalPriceRange.min, globalPriceRange.max)
                : '';

              const cellVisual = (
                <div
                  className={`
                    ${cellH} rounded border border-slate-200 p-1 pb-6 flex flex-col
                    transition-all duration-200 select-none
                    ${priceOverlayBg || config.bg}
                    ${past ? 'opacity-40' : ''}
                    ${isTodayCell ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                    ${isAnchorCell ? 'ring-2 ring-blue-400' : ''}
                    ${isClickable ? 'cursor-pointer' : ''}
                    ${isPendingCell ? 'animate-pulse' : ''}
                  `}
                  onClick={(e) => handleDayClick(yearMonth, day, e)}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${
                      isTodayCell ? 'text-blue-700' : 'text-slate-700'
                    }`}>
                      {day}
                    </span>
                    {config.icon}
                  </div>
                  <div className="mt-auto">
                    {dayData.status === 'external-block' && dayData.externalFeedName && (
                      <span className="text-[9px] text-blue-600 font-medium truncate block leading-tight">
                        {dayData.externalFeedName}
                      </span>
                    )}
                    {config.label && (
                      <span className="text-[9px] text-muted-foreground leading-tight">
                        {config.label}
                      </span>
                    )}
                    {showPrices && dayData.price != null && (
                      <span className={`text-[10px] font-semibold leading-tight ${
                        dayData.status === 'available' ? 'text-slate-700' : 'text-slate-500'
                      }`}>
                        {formatPrice(dayData.price, currency)}
                      </span>
                    )}
                  </div>
                </div>
              );

              // Popover for booked/held/external/checkout cells
              const needsPopover = !past && (
                dayData.status === 'booked' || dayData.status === 'on-hold' ||
                dayData.status === 'external-block' || !!dayData.checkoutBooking
              );

              if (needsPopover) {
                return (
                  <div key={`d-${day}`} className="p-0.5">
                    <DayDetailPopover
                      dayData={dayData}
                      open={popoverKey === cellKey}
                      onOpenChange={(open) => setPopoverKey(open ? cellKey : null)}
                    >
                      {cellVisual}
                    </DayDetailPopover>
                  </div>
                );
              }

              return <div key={`d-${day}`} className="p-0.5">{cellVisual}</div>;
            })}

            {/* Floating bar overlays */}
            {weekSegments[wi].map(segment => {
              const label = getBarLabel(segment);
              return (
                <div
                  key={`bar-${segment.bookingId}`}
                  className={`
                    absolute z-10 rounded-full pointer-events-none
                    flex items-center overflow-hidden
                    ${segment.barColor === 'amber' ? 'bg-amber-400' : 'bg-emerald-500'}
                  `}
                  style={{
                    left: `${segment.leftPercent}%`,
                    right: `${segment.rightPercent}%`,
                    bottom: '4px',
                    height: '20px',
                  }}
                >
                  {label && (
                    <span className="text-[11px] font-medium text-white truncate px-2 leading-none">
                      {label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Availability Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={showPrices ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowPrices(p => !p)}
              className="gap-1.5"
            >
              <DollarSign className="h-3.5 w-3.5" />
              Prices
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/admin/pricing?propertyId=${propertyId}`}>
                <Settings2 className="h-3.5 w-3.5 mr-1" />
                Edit Pricing
              </Link>
            </Button>
            <div className="flex items-center gap-1 ml-1 border-l pl-2">
              <Button variant="outline" size="icon" onClick={() => navigate(-1)} disabled={isLoading}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => navigate(1)} disabled={isLoading}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && (
          <>
            <div className="flex gap-4">
              {visibleMonths.map(ym => renderMonthGrid(ym))}
            </div>

            {/* Legend + summary */}
            <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded border border-slate-200 bg-white" />
                <span>Available ({totalSummary.available})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-3 rounded-full bg-emerald-500" />
                <span>Booked ({totalSummary.booked})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-3 rounded-full bg-amber-400" />
                <span>On Hold ({totalSummary.onHold})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded border border-blue-300 bg-blue-50 flex items-center justify-center">
                  <Globe className="h-2.5 w-2.5 text-blue-500" />
                </div>
                <span>External ({totalSummary.externallyBlocked})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded border border-slate-400 bg-slate-200" />
                <span>Blocked ({totalSummary.manuallyBlocked})</span>
              </div>
              {showPrices && globalPriceRange && (
                <div className="flex items-center gap-3 border-l pl-3 ml-3">
                  <span className="text-muted-foreground font-medium">Price:</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-300" />
                    <span>Low</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded bg-sky-100 border border-sky-300" />
                    <span>Mid</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300" />
                    <span>High</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded bg-rose-100 border border-rose-300" />
                    <span>Peak</span>
                  </div>
                </div>
              )}
            </div>

            {anchor && (
              <p className="mt-2 text-xs text-muted-foreground">
                Shift+click another day to {anchor.action} a range
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
