'use client';

import { useState, useCallback, useTransition } from 'react';
import { format, addMonths, subMonths, getDaysInMonth } from 'date-fns';
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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { MonthAvailabilityData, AvailabilityDayData, DayStatus } from '../_lib/availability-types';
import { fetchAvailabilityCalendarData, toggleDateBlocked, toggleDateRangeBlocked } from '../actions';
import { DayDetailPopover } from './day-detail-popover';

interface AvailabilityCalendarProps {
  propertyId: string;
  initialData: MonthAvailabilityData;
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

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AvailabilityCalendar({ propertyId, initialData }: AvailabilityCalendarProps) {
  const [data, setData] = useState<MonthAvailabilityData>(initialData);
  const [currentDate, setCurrentDate] = useState(() => {
    const [y, m] = initialData.month.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });
  const [isLoading, startTransition] = useTransition();
  const [popoverDay, setPopoverDay] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<{ yearMonth: string; day: number; action: 'block' | 'unblock' } | null>(null);
  const [pendingDays, setPendingDays] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const yearMonth = format(currentDate, 'yyyy-MM');
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-based
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const today = new Date();
  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : null;

  const loadMonth = useCallback((date: Date) => {
    const ym = format(date, 'yyyy-MM');
    startTransition(async () => {
      try {
        const newData = await fetchAvailabilityCalendarData(propertyId, ym);
        setData(newData);
      } catch {
        toast({ title: 'Error', description: 'Failed to load calendar data', variant: 'destructive' });
      }
    });
  }, [propertyId, toast]);

  const navigateMonth = useCallback((direction: -1 | 1) => {
    const newDate = direction === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1);
    setCurrentDate(newDate);
    setAnchor(null);
    setPopoverDay(null);
    loadMonth(newDate);
  }, [currentDate, loadMonth]);

  const isPast = (day: number) => {
    const dayDate = new Date(year, month, day);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dayDate < todayStart;
  };

  const handleDayClick = useCallback(async (day: number, e: React.MouseEvent) => {
    const dayData = data.days[day];
    if (!dayData || isPast(day)) return;

    const { status } = dayData;

    // For booked/held/external: show popover
    if (status === 'booked' || status === 'on-hold' || status === 'external-block') {
      setPopoverDay(popoverDay === day ? null : day);
      return;
    }

    // Shift+click: range selection
    if (e.shiftKey && anchor && anchor.yearMonth === yearMonth) {
      const from = Math.min(anchor.day, day);
      const to = Math.max(anchor.day, day);
      const dates: { yearMonth: string; day: number }[] = [];
      for (let d = from; d <= to; d++) {
        if (isPast(d)) continue;
        const ds = data.days[d];
        if (!ds) continue;
        if (anchor.action === 'block' && ds.status === 'available') {
          dates.push({ yearMonth, day: d });
        } else if (anchor.action === 'unblock' && ds.status === 'manual-block') {
          dates.push({ yearMonth, day: d });
        }
      }

      if (dates.length === 0) return;

      // Optimistic update
      const block = anchor.action === 'block';
      setData(prev => {
        const updated = { ...prev, days: { ...prev.days }, summary: { ...prev.summary } };
        for (const { day: d } of dates) {
          updated.days[d] = { ...updated.days[d], status: block ? 'manual-block' : 'available' };
          if (block) { updated.summary.available--; updated.summary.manuallyBlocked++; }
          else { updated.summary.manuallyBlocked--; updated.summary.available++; }
        }
        return updated;
      });
      setAnchor(null);

      const result = await toggleDateRangeBlocked(propertyId, dates, block);
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        loadMonth(currentDate); // revert
      } else if (result.skippedCount > 0) {
        toast({ title: 'Partial update', description: `${result.blockedCount} updated, ${result.skippedCount} skipped` });
        loadMonth(currentDate);
      }
      return;
    }

    // Single click: toggle
    const block = status === 'available';
    const action = block ? 'block' : 'unblock';

    // Set anchor for potential shift-click
    setAnchor({ yearMonth, day, action });

    // Optimistic update
    setPendingDays(prev => new Set(prev).add(day));
    setData(prev => {
      const updated = { ...prev, days: { ...prev.days }, summary: { ...prev.summary } };
      updated.days[day] = { ...updated.days[day], status: block ? 'manual-block' : 'available' };
      if (block) { updated.summary.available--; updated.summary.manuallyBlocked++; }
      else { updated.summary.manuallyBlocked--; updated.summary.available++; }
      return updated;
    });

    const result = await toggleDateBlocked(propertyId, yearMonth, day, block);
    setPendingDays(prev => { const s = new Set(prev); s.delete(day); return s; });

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
      loadMonth(currentDate); // revert
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, anchor, yearMonth, propertyId, toast, currentDate, loadMonth]);

  // Build weeks for the grid
  const weeks: (number | null)[][] = [];
  let dayCounter = 1;
  for (let week = 0; week < 6 && dayCounter <= daysInMonth; week++) {
    const row: (number | null)[] = [];
    for (let wd = 0; wd < 7; wd++) {
      if ((week === 0 && wd < firstDayOfWeek) || dayCounter > daysInMonth) {
        row.push(null);
      } else {
        row.push(dayCounter++);
      }
    }
    weeks.push(row);
  }

  const renderDayCell = (day: number | null) => {
    if (day === null) {
      return <td key={`empty-${Math.random()}`} className="p-0.5"><div className="h-[72px]" /></td>;
    }

    const dayData = data.days[day];
    if (!dayData) {
      return <td key={`no-data-${day}`} className="p-0.5"><div className="h-[72px]" /></td>;
    }

    const config = STATUS_CONFIG[dayData.status];
    const past = isPast(day);
    const isToday = day === todayDay;
    const isAnchor = anchor?.day === day && anchor?.yearMonth === yearMonth;
    const isPending = pendingDays.has(day);
    const isClickable = !past && (dayData.status === 'available' || dayData.status === 'manual-block' || dayData.status === 'booked' || dayData.status === 'on-hold' || dayData.status === 'external-block');

    const cellContent = (
      <div
        className={`
          h-[72px] rounded-lg border p-1.5 flex flex-col transition-all select-none
          ${config.bg} ${config.border}
          ${past ? 'opacity-40' : ''}
          ${isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
          ${isAnchor ? 'ring-2 ring-blue-400' : ''}
          ${isClickable && !past ? 'cursor-pointer' : ''}
          ${isPending ? 'animate-pulse' : ''}
        `}
        onClick={(e) => handleDayClick(day, e)}
      >
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>
            {day}
          </span>
          {config.icon}
        </div>
        <div className="mt-auto">
          {dayData.status === 'external-block' && dayData.externalFeedName && (
            <span className="text-[10px] text-blue-600 font-medium truncate block">
              {dayData.externalFeedName}
            </span>
          )}
          {config.label && dayData.status !== 'external-block' && (
            <span className="text-[10px] text-muted-foreground">{config.label}</span>
          )}
        </div>
      </div>
    );

    // Wrap booked/held/external in popover
    if ((dayData.status === 'booked' || dayData.status === 'on-hold' || dayData.status === 'external-block') && !past) {
      return (
        <td key={`day-${day}`} className="p-0.5">
          <DayDetailPopover
            dayData={dayData}
            open={popoverDay === day}
            onOpenChange={(open) => setPopoverDay(open ? day : null)}
          >
            {cellContent}
          </DayDetailPopover>
        </td>
      );
    }

    return <td key={`day-${day}`} className="p-0.5">{cellContent}</td>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Availability Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)} disabled={isLoading}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-36 text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <Button variant="outline" size="icon" onClick={() => navigateMonth(1)} disabled={isLoading}>
              <ChevronRight className="h-4 w-4" />
            </Button>
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
            <div className="overflow-auto">
              <table className="w-full border-separate border-spacing-0" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    {WEEKDAY_HEADERS.map((day, i) => (
                      <th
                        key={day}
                        className={`text-center text-xs font-medium py-2 ${
                          i === 0 || i === 6 ? 'text-rose-500' : 'text-muted-foreground'
                        }`}
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week, wi) => (
                    <tr key={wi}>
                      {week.map((day, di) => renderDayCell(day))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend + summary */}
            <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded border border-slate-200 bg-white" />
                <span>Available ({data.summary.available})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded border border-emerald-300 bg-emerald-50" />
                <span>Booked ({data.summary.booked})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded border border-amber-300 bg-amber-50" />
                <span>On Hold ({data.summary.onHold})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded border border-blue-300 bg-blue-50" />
                <span>External ({data.summary.externallyBlocked})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded border border-slate-400 bg-slate-200" />
                <span>Blocked ({data.summary.manuallyBlocked})</span>
              </div>
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
