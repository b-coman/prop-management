'use client';

import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Ban, CheckCircle, Clock, Globe, LogOut, StickyNote, Users } from 'lucide-react';
import type { PublicMonthData, PublicDayData, PublicDayStatus } from '../_lib/fetch-public-calendar';

const RO_MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const WEEKDAY_HEADERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const STATUS_BG: Record<PublicDayStatus, string> = {
  available: 'bg-white',
  booked: 'bg-emerald-50',
  'on-hold': 'bg-amber-50',
  'external-block': 'bg-blue-50',
  'manual-block': 'bg-slate-100',
};

interface BarSegment {
  bookingId: string;
  guestName: string;
  barColor: 'emerald' | 'amber';
  leftPercent: number;
  rightPercent: number;
  isCheckIn: boolean;
  hasCheckout: boolean;
  lastDay: number;
}

interface BookingInWeek {
  guestName: string;
  barColor: 'emerald' | 'amber';
  nightDays: number[];
  checkInDay: number | null;
  checkoutDay: number | null;
}

function collectBookings(days: Record<number, PublicDayData>): Map<string, BookingInWeek> {
  const bookings = new Map<string, BookingInWeek>();
  for (const [dayStr, dayData] of Object.entries(days)) {
    const d = Number(dayStr);
    if ((dayData.status === 'booked' || dayData.status === 'on-hold') && dayData.bookingId) {
      let booking = bookings.get(dayData.bookingId);
      if (!booking) {
        booking = {
          guestName: dayData.bookingDetails?.guestName || 'Guest',
          barColor: dayData.status === 'on-hold' ? 'amber' : 'emerald',
          nightDays: [],
          checkInDay: null,
          checkoutDay: null,
        };
        bookings.set(dayData.bookingId, booking);
      }
      booking.nightDays.push(d);
      if (dayData.bookingPosition === 'start' || dayData.bookingPosition === 'single') {
        booking.checkInDay = d;
      }
    }
    if (dayData.checkoutBooking) {
      const id = dayData.checkoutBooking.bookingId;
      let booking = bookings.get(id);
      if (!booking) {
        booking = {
          guestName: dayData.checkoutBooking.guestName,
          barColor: dayData.checkoutBooking.barColor,
          nightDays: [],
          checkInDay: null,
          checkoutDay: null,
        };
        bookings.set(id, booking);
      }
      booking.checkoutDay = d;
    }
  }
  for (const b of bookings.values()) b.nightDays.sort((a, b) => a - b);
  return bookings;
}

function computeBarSegments(week: (number | null)[], bookings: Map<string, BookingInWeek>): BarSegment[] {
  const segments: BarSegment[] = [];
  const colWidth = 100 / 7;
  for (const [bookingId, booking] of bookings) {
    const colsInRow: { col: number; day: number; isCheckout: boolean }[] = [];
    for (let col = 0; col < 7; col++) {
      const day = week[col];
      if (day === null) continue;
      const isNight = booking.nightDays.includes(day);
      const isCheckout = booking.checkoutDay === day;
      if (isNight || isCheckout) colsInRow.push({ col, day, isCheckout });
    }
    if (colsInRow.length === 0) continue;
    const isCheckIn = booking.checkInDay !== null && colsInRow.some(c => c.day === booking.checkInDay);
    const hasCheckout = colsInRow.some(c => c.isCheckout);
    let leftPercent: number;
    if (isCheckIn) {
      const checkInCol = colsInRow.find(c => c.day === booking.checkInDay)!.col;
      leftPercent = checkInCol * colWidth + 0.5 * colWidth;
    } else {
      leftPercent = colsInRow[0].col * colWidth;
    }
    let rightPercent: number;
    if (hasCheckout) {
      const checkoutCol = colsInRow.find(c => c.isCheckout)!.col;
      rightPercent = (7 - checkoutCol - 0.3) * colWidth;
    } else {
      const lastCol = colsInRow[colsInRow.length - 1].col;
      rightPercent = (7 - lastCol - 1) * colWidth;
    }
    segments.push({
      bookingId,
      guestName: booking.guestName,
      barColor: booking.barColor,
      leftPercent,
      rightPercent,
      isCheckIn,
      hasCheckout,
      lastDay: colsInRow[colsInRow.length - 1].day,
    });
  }
  return segments;
}

export function PublicCalendar({ months }: { months: PublicMonthData[] }) {
  const today = new Date();
  const todayBucharestStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(today);
  const [todayY, todayM, todayD] = todayBucharestStr.split('-').map(Number);

  return (
    <div className="space-y-5">
      {months.map(monthData => (
        <MonthBlock key={monthData.month} monthData={monthData} todayY={todayY} todayM={todayM} todayD={todayD} />
      ))}
    </div>
  );
}

function MonthBlock({ monthData, todayY, todayM, todayD }: { monthData: PublicMonthData; todayY: number; todayM: number; todayD: number }) {
  const [year, month] = monthData.month.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const dim = new Date(year, month, 0).getDate();
  const firstDow = (date.getDay() + 6) % 7;
  const isCurrentMonth = year === todayY && month === todayM;

  const weeks: (number | null)[][] = [];
  let dc = 1;
  for (let w = 0; w < 6 && dc <= dim; w++) {
    const row: (number | null)[] = [];
    for (let wd = 0; wd < 7; wd++) {
      if ((w === 0 && wd < firstDow) || dc > dim) row.push(null);
      else row.push(dc++);
    }
    weeks.push(row);
  }

  const bookings = collectBookings(monthData.days);
  const weekSegments = weeks.map(week => computeBarSegments(week, bookings));

  return (
    <section className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
      <h2 className="text-sm font-semibold text-slate-800 text-center mb-2 capitalize">
        {RO_MONTHS[month - 1]} {year}
      </h2>
      <div className="grid grid-cols-7">
        {WEEKDAY_HEADERS.map((d, i) => (
          <div
            key={i}
            className={`text-center text-[10px] font-medium py-1 ${i >= 5 ? 'text-rose-500' : 'text-slate-500'}`}
          >
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="relative grid grid-cols-7">
          {week.map((day, di) => {
            if (day === null) {
              return <div key={`e-${wi}-${di}`} className="p-0.5"><div className="h-12" /></div>;
            }
            const dayData = monthData.days[day];
            const isToday = isCurrentMonth && day === todayD;
            const isPast = isCurrentMonth && day < todayD;
            return <DayCell key={day} dayData={dayData} isToday={isToday} isPast={isPast} />;
          })}
          {weekSegments[wi].map(segment => {
            const roundL = segment.isCheckIn ? 'rounded-l-full' : '';
            const roundR = segment.hasCheckout ? 'rounded-r-full' : '';
            return (
              <div
                key={`bar-${segment.bookingId}-${wi}`}
                className={`absolute z-10 pointer-events-none flex items-center overflow-hidden ${roundL} ${roundR} ${
                  segment.barColor === 'amber' ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
                style={{ left: `${segment.leftPercent}%`, right: `${segment.rightPercent}%`, bottom: '4px', height: '14px' }}
              >
                <span className="text-[10px] font-medium text-white truncate px-1.5 leading-none">
                  {segment.guestName}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}

function DayCell({ dayData, isToday, isPast }: { dayData: PublicDayData; isToday: boolean; isPast: boolean }) {
  const status = dayData.status;
  const config = STATUS_BG[status];
  const hasPopover = dayData.bookingDetails || dayData.checkoutBooking || status === 'external-block';

  const cell = (
    <div
      className={`h-12 rounded border border-slate-200 p-1 pb-5 flex flex-col select-none ${config} ${
        isPast ? 'opacity-40' : ''
      } ${isToday ? 'ring-2 ring-blue-500' : ''} ${hasPopover ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-semibold ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>{dayData.day}</span>
        {status === 'booked' && <CheckCircle className="h-3 w-3 text-emerald-500" />}
        {status === 'on-hold' && <Clock className="h-3 w-3 text-amber-500" />}
        {status === 'external-block' && <Globe className="h-3 w-3 text-blue-500" />}
        {status === 'manual-block' && <Ban className="h-3 w-3 text-slate-400" />}
      </div>
    </div>
  );

  if (!hasPopover) {
    return <div className="p-0.5">{cell}</div>;
  }

  return (
    <div className="p-0.5">
      <Popover>
        <PopoverTrigger asChild>{cell}</PopoverTrigger>
        <PopoverContent className="w-72 text-sm" align="start" side="bottom">
          <PopoverBody dayData={dayData} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function PopoverBody({ dayData }: { dayData: PublicDayData }) {
  const { status, bookingDetails, externalFeedName, checkoutBooking } = dayData;
  return (
    <div className="space-y-3">
      {checkoutBooking && (
        <div className={`flex items-center gap-2 ${
          status === 'booked' || status === 'on-hold' || status === 'external-block' ? 'pb-2 border-b' : ''
        }`}>
          <LogOut className={`h-3.5 w-3.5 ${checkoutBooking.barColor === 'amber' ? 'text-amber-600' : 'text-emerald-600'}`} />
          <span className="text-muted-foreground text-xs">
            Pleacă: <span className="font-medium text-foreground">{checkoutBooking.guestName}</span>
          </span>
        </div>
      )}
      {(status === 'booked' || status === 'on-hold') && bookingDetails && (
        <div className="space-y-2">
          <p className="font-semibold text-slate-900">{bookingDetails.guestName}</p>
          <p className="text-xs text-muted-foreground">
            {bookingDetails.checkIn} → {bookingDetails.checkOut}
            <span className="ml-1">({bookingDetails.nights} {bookingDetails.nights === 1 ? 'noapte' : 'nopți'})</span>
          </p>
          {(bookingDetails.adults || bookingDetails.persons) && (
            <p className="text-xs flex items-center gap-1.5 text-slate-700">
              <Users className="h-3 w-3 text-slate-400" />
              {personsLabel(bookingDetails.adults, bookingDetails.children, bookingDetails.persons)}
            </p>
          )}
          {bookingDetails.notes && (
            <div className="text-xs text-slate-700 bg-amber-50 border border-amber-200 rounded p-2 flex gap-1.5">
              <StickyNote className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap">{bookingDetails.notes}</span>
            </div>
          )}
        </div>
      )}
      {status === 'external-block' && (
        <div className="flex items-center gap-2 text-xs">
          <Globe className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-muted-foreground">Blocat de: <span className="font-medium text-foreground">{externalFeedName}</span></span>
        </div>
      )}
    </div>
  );
}

function personsLabel(adults: number | undefined, children: number | undefined, persons: number | undefined): string {
  const a = adults ?? persons ?? 1;
  const c = children ?? 0;
  const adultWord = a === 1 ? 'adult' : 'adulti';
  if (c === 0) return `${a} ${adultWord}`;
  const childWord = c === 1 ? 'copil' : 'copii';
  return `${a} ${adultWord} + ${c} ${childWord}`;
}
