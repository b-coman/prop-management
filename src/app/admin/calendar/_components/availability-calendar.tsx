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
import type { MonthAvailabilityData, AvailabilityDayData, DayStatus } from '../_lib/availability-types';
import { fetchAvailabilityCalendarData, toggleDateBlocked, toggleDateRangeBlocked } from '../actions';
import { DayDetailPopover } from './day-detail-popover';

interface AvailabilityCalendarProps {
  propertyId: string;
  initialMonths: MonthAvailabilityData[];
}

const STATUS_CONFIG: Record<DayStatus, { bg: string; border: string; icon: React.ReactNode; label: string }> = {
  available: {
    bg: 'bg-white hover:bg-slate-50',
    border: 'border-slate-200',
    icon: null,
    label: '',
  },
  booked: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    icon: <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />,
    label: 'Booked',
  },
  'on-hold': {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    icon: <Clock className="h-3.5 w-3.5 text-amber-600" />,
    label: 'Hold',
  },
  'external-block': {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    icon: <Globe className="h-3.5 w-3.5 text-blue-600" />,
    label: 'External',
  },
  'manual-block': {
    bg: 'bg-slate-200 hover:bg-slate-300',
    border: 'border-slate-400',
    icon: <Ban className="h-3.5 w-3.5 text-slate-500" />,
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

export function AvailabilityCalendar({ propertyId, initialMonths }: AvailabilityCalendarProps) {
  // monthsData is keyed by yearMonth string
  const [monthsData, setMonthsData] = useState<Record<string, MonthAvailabilityData>>(() => {
    const map: Record<string, MonthAvailabilityData> = {};
    for (const m of initialMonths) {
      map[m.month] = m;
    }
    return map;
  });

  // startDate is the first of the 3 visible months
  const [startDate, setStartDate] = useState(() => {
    const [y, m] = initialMonths[0].month.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  const [isLoading, startTransition] = useTransition();
  const [popoverKey, setPopoverKey] = useState<string | null>(null); // "YYYY-MM:day"
  const [anchor, setAnchor] = useState<{ yearMonth: string; day: number; action: 'block' | 'unblock' } | null>(null);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [showPrices, setShowPrices] = useState(false);
  const { toast } = useToast();

  const currency = Object.values(monthsData).find(m => m.currency)?.currency || 'EUR';

  const today = new Date();
  const todayYM = format(today, 'yyyy-MM');
  const todayDay = today.getDate();

  // The 3 visible months
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

  const renderMonthGrid = (yearMonth: string) => {
    const [y, m] = yearMonth.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    const dim = getDaysInMonth(date);
    const firstDow = date.getDay();
    const isCurrentMonth = yearMonth === todayYM;

    const mData = monthsData[yearMonth];

    // Build weeks
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

    return (
      <div key={yearMonth} className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-center mb-2">
          {format(date, 'MMMM yyyy')}
        </h3>
        <table className="w-full border-separate border-spacing-0" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {WEEKDAY_HEADERS.map((d, i) => (
                <th
                  key={d}
                  className={`text-center text-[10px] font-medium py-1 ${
                    i === 0 || i === 6 ? 'text-rose-500' : 'text-muted-foreground'
                  }`}
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((day, di) => {
                  if (day === null) {
                    return <td key={`e-${wi}-${di}`} className="p-0.5"><div className={`${showPrices ? 'h-[64px]' : 'h-[56px]'} transition-all duration-200`} /></td>;
                  }

                  const dayData = mData?.days[day];
                  if (!dayData) {
                    return <td key={`nd-${day}`} className="p-0.5"><div className={`${showPrices ? 'h-[64px]' : 'h-[56px]'} transition-all duration-200`} /></td>;
                  }

                  const config = STATUS_CONFIG[dayData.status];
                  const past = isPast(yearMonth, day);
                  const isTodayCell = isCurrentMonth && day === todayDay;
                  const cellKey = `${yearMonth}:${day}`;
                  const isAnchor = anchor?.day === day && anchor?.yearMonth === yearMonth;
                  const isPending = pendingKeys.has(cellKey);
                  const isClickable = !past;

                  // Bar connectivity: check if adjacent cells in same row belong to same booking
                  const isBarCell = dayData.status === 'booked' || dayData.status === 'on-hold';
                  const prevDay = di > 0 ? week[di - 1] : null;
                  const nextDay = di < 6 ? week[di + 1] : null;

                  const prevDayData = prevDay ? mData?.days[prevDay] : null;
                  const nextDayData = nextDay ? mData?.days[nextDay] : null;

                  const prevSameBooking = isBarCell && prevDayData
                    && dayData.bookingId === prevDayData.bookingId
                    && (prevDayData.status === 'booked' || prevDayData.status === 'on-hold');
                  const nextSameBooking = isBarCell && nextDayData
                    && dayData.bookingId === nextDayData.bookingId
                    && (nextDayData.status === 'booked' || nextDayData.status === 'on-hold');

                  const connectLeft = !!prevSameBooking;
                  const connectRight = !!nextSameBooking;

                  // Checkout tail gap bridging: if this is bar end and next cell is the checkout day
                  const isBarEnd = isBarCell && !connectRight;
                  const nextIsCheckout = isBarEnd && nextDayData?.checkoutBooking?.bookingId === dayData.bookingId;
                  // If the previous cell's bar connects to this checkout cell
                  const prevIsBarEnd = !isBarCell && dayData.checkoutBooking
                    && prevDay && mData?.days[prevDay]
                    && mData.days[prevDay].bookingId === dayData.checkoutBooking.bookingId
                    && (mData.days[prevDay].status === 'booked' || mData.days[prevDay].status === 'on-hold');

                  // Compute td padding
                  let tdPadding = 'p-0.5';
                  if (isBarCell) {
                    if (connectLeft && connectRight) {
                      tdPadding = 'py-0.5 px-0';
                    } else if (connectLeft && !connectRight) {
                      tdPadding = nextIsCheckout ? 'py-0.5 pl-0 pr-0' : 'py-0.5 pl-0 pr-0.5';
                    } else if (!connectLeft && connectRight) {
                      tdPadding = 'py-0.5 pl-0.5 pr-0';
                    } else {
                      tdPadding = nextIsCheckout ? 'py-0.5 pl-0.5 pr-0' : 'p-0.5';
                    }
                  } else if (prevIsBarEnd) {
                    tdPadding = 'py-0.5 pl-0 pr-0.5';
                  }

                  // Compute rounding + borders for inner div
                  let roundingClass = 'rounded';
                  let borderClass = 'border';
                  if (isBarCell) {
                    if (connectLeft && connectRight) {
                      roundingClass = '';
                      borderClass = 'border-t border-b';
                    } else if (connectLeft && !connectRight) {
                      roundingClass = 'rounded-r';
                      borderClass = 'border-t border-b border-r';
                    } else if (!connectLeft && connectRight) {
                      roundingClass = 'rounded-l';
                      borderClass = 'border-t border-b border-l';
                    } else {
                      roundingClass = 'rounded';
                      borderClass = 'border';
                    }
                  }

                  // Source label for booking bars
                  const getSourceLabel = () => {
                    if (!isBarCell || !dayData.bookingDetails) return null;
                    if (dayData.status === 'on-hold') return 'Hold';
                    const src = dayData.bookingDetails.source?.toLowerCase();
                    if (src === 'airbnb') return 'Airbnb';
                    if (src === 'booking.com' || src === 'booking') return 'Booking';
                    if (src === 'vrbo') return 'VRBO';
                    return 'Booked';
                  };

                  // Is this the first bar cell in this row? (for showing label/icon)
                  const isRowBarStart = isBarCell && !connectLeft;

                  const priceOverlayBg = showPrices && dayData.price != null && dayData.status === 'available' && globalPriceRange
                    ? getPriceColor(dayData.price, globalPriceRange.min, globalPriceRange.max)
                    : '';

                  const barBg = isBarCell
                    ? (dayData.status === 'on-hold' ? 'bg-amber-50' : 'bg-emerald-50')
                    : '';
                  const barBorder = isBarCell
                    ? (dayData.status === 'on-hold' ? 'border-amber-300' : 'border-emerald-300')
                    : '';

                  const cellContent = (
                    <div
                      className={`
                        relative
                        ${showPrices ? 'h-[64px]' : 'h-[56px]'} ${roundingClass} ${borderClass} p-1 flex flex-col transition-all duration-200 select-none
                        ${isBarCell ? barBg : (priceOverlayBg || config.bg)}
                        ${isBarCell ? barBorder : config.border}
                        ${past ? 'opacity-40' : ''}
                        ${isTodayCell ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                        ${isAnchor ? 'ring-2 ring-blue-400' : ''}
                        ${isClickable && !past ? 'cursor-pointer' : ''}
                        ${isPending ? 'animate-pulse' : ''}
                      `}
                      onClick={(e) => handleDayClick(yearMonth, day, e)}
                    >
                      {/* Checkout tail accent */}
                      {!isBarCell && dayData.checkoutBooking && (
                        <div className={`
                          absolute left-0 top-0 bottom-0 w-[20%]
                          ${dayData.checkoutBooking.barColor === 'amber' ? 'bg-amber-200/60' : 'bg-emerald-200/60'}
                          ${roundingClass === 'rounded' ? 'rounded-l' : ''}
                          z-0
                        `} />
                      )}
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${isTodayCell ? 'text-blue-700' : 'text-slate-700'}`}>
                            {day}
                          </span>
                          {isRowBarStart && config.icon}
                          {!isBarCell && config.icon}
                        </div>
                        <div className="mt-auto">
                          {/* Bar cells: show source label on row-start, price on others */}
                          {isBarCell && isRowBarStart && (
                            <span className={`text-[9px] font-medium truncate block leading-tight ${
                              dayData.status === 'on-hold' ? 'text-amber-700' : 'text-emerald-700'
                            }`}>
                              {getSourceLabel()}
                            </span>
                          )}
                          {isBarCell && !isRowBarStart && showPrices && dayData.price != null && (
                            <span className="text-[10px] font-semibold leading-tight text-slate-500">
                              {formatPrice(dayData.price, currency)}
                            </span>
                          )}
                          {/* Non-bar cells: original rendering */}
                          {!isBarCell && dayData.status === 'external-block' && dayData.externalFeedName && (
                            <span className="text-[9px] text-blue-600 font-medium truncate block leading-tight">
                              {dayData.externalFeedName}
                            </span>
                          )}
                          {!isBarCell && config.label && dayData.status !== 'external-block' && (
                            <span className="text-[9px] text-muted-foreground leading-tight">{config.label}</span>
                          )}
                          {!isBarCell && showPrices && dayData.price != null && (
                            <span className={`text-[10px] font-semibold leading-tight ${
                              dayData.status === 'available'
                                ? 'text-slate-700'
                                : 'text-slate-500'
                            }`}>
                              {formatPrice(dayData.price, currency)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );

                  // Wrap in popover: booked, on-hold, external, or checkout-tail cells
                  const needsPopover = !past && (
                    dayData.status === 'booked'
                    || dayData.status === 'on-hold'
                    || dayData.status === 'external-block'
                    || dayData.checkoutBooking
                  );

                  if (needsPopover) {
                    return (
                      <td key={`d-${day}`} className={tdPadding}>
                        <DayDetailPopover
                          dayData={dayData}
                          open={popoverKey === cellKey}
                          onOpenChange={(open) => setPopoverKey(open ? cellKey : null)}
                        >
                          {cellContent}
                        </DayDetailPopover>
                      </td>
                    );
                  }

                  return <td key={`d-${day}`} className={tdPadding}>{cellContent}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
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
                <div className="w-6 h-3 rounded-full border border-emerald-300 bg-emerald-50" />
                <span>Booked ({totalSummary.booked})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-3 rounded-full border border-amber-300 bg-amber-50" />
                <span>On Hold ({totalSummary.onHold})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded border border-blue-300 bg-blue-50" />
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
