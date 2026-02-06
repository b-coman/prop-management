'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  CalendarCheck,
  DollarSign,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Building,
  Ticket,
  CalendarDays,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  format,
  formatDistanceToNow,
  addDays,
  addHours,
  startOfMonth,
  endOfMonth,
  subMonths,
  getDaysInMonth,
  differenceInDays,
  startOfDay,
} from 'date-fns';
import type { LucideIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePropertySelector } from '@/contexts/PropertySelectorContext';
import type { DashboardData, DashboardBooking, DashboardInquiry, AdminProperty } from '../_actions';

// ============================================================================
// Helpers
// ============================================================================

function getDisplayName(name: string | { en?: string; ro?: string }): string {
  if (typeof name === 'string') return name;
  return name.en || name.ro || 'Unnamed';
}

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================================================
// Metric computation
// ============================================================================

interface Metrics {
  bookingsThisMonth: number;
  bookingsLastMonth: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  pendingInquiries: number;
  occupancyRate: number;
  currency: string;
}

function computeMetrics(
  bookings: DashboardBooking[],
  inquiries: DashboardInquiry[],
  propertiesCount: number,
  now: Date
): Metrics {
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const isActiveBooking = (status: string) =>
    status === 'confirmed' || status === 'completed';

  // Bookings this month vs last month (by creation date)
  const bookingsThisMonth = bookings.filter(b => {
    if (!isActiveBooking(b.status) || !b.createdAt) return false;
    const d = new Date(b.createdAt);
    return d >= currentMonthStart && d <= currentMonthEnd;
  });

  const bookingsLastMonth = bookings.filter(b => {
    if (!isActiveBooking(b.status) || !b.createdAt) return false;
    const d = new Date(b.createdAt);
    return d >= lastMonthStart && d <= lastMonthEnd;
  });

  // Revenue
  const revenueThisMonth = bookingsThisMonth.reduce((sum, b) => sum + b.total, 0);
  const revenueLastMonth = bookingsLastMonth.reduce((sum, b) => sum + b.total, 0);

  // Most common currency
  const currencies = bookings.map(b => b.currency).filter(Boolean);
  const currency = currencies.length > 0
    ? currencies.sort((a, b) =>
        currencies.filter(c => c === b).length - currencies.filter(c => c === a).length
      )[0]
    : 'EUR';

  // Pending inquiries
  const pendingInquiries = inquiries.filter(i => i.status === 'new').length;

  // Occupancy rate (from booking nights overlapping current month)
  const daysInMonth = getDaysInMonth(now);
  const totalPossibleNights = propertiesCount * daysInMonth;
  let bookedNights = 0;

  if (totalPossibleNights > 0) {
    const activeBookings = bookings.filter(b => isActiveBooking(b.status));
    for (const booking of activeBookings) {
      if (!booking.checkInDate || !booking.checkOutDate) continue;
      const checkIn = new Date(booking.checkInDate);
      const checkOut = new Date(booking.checkOutDate);

      const overlapStart = checkIn < currentMonthStart ? currentMonthStart : checkIn;
      const overlapEnd = checkOut > currentMonthEnd ? currentMonthEnd : checkOut;

      if (overlapStart < overlapEnd) {
        bookedNights += differenceInDays(overlapEnd, overlapStart);
      }
    }
  }

  const occupancyRate = totalPossibleNights > 0
    ? Math.round((bookedNights / totalPossibleNights) * 100)
    : 0;

  return {
    bookingsThisMonth: bookingsThisMonth.length,
    bookingsLastMonth: bookingsLastMonth.length,
    revenueThisMonth,
    revenueLastMonth,
    pendingInquiries,
    occupancyRate,
    currency,
  };
}

// ============================================================================
// Activity lists
// ============================================================================

interface ActivityItem {
  id: string;
  label: string;
  sublabel: string;
  date: string;
  href: string;
}

function getUpcomingCheckIns(
  bookings: DashboardBooking[],
  propertyNameMap: Map<string, string>,
  now: Date
): ActivityItem[] {
  const today = startOfDay(now);
  const futureLimit = addDays(today, 7);

  return bookings
    .filter(b => {
      if (b.status !== 'confirmed' && b.status !== 'on-hold') return false;
      if (!b.checkInDate) return false;
      const checkIn = new Date(b.checkInDate);
      return checkIn >= today && checkIn <= futureLimit;
    })
    .sort((a, b) => new Date(a.checkInDate!).getTime() - new Date(b.checkInDate!).getTime())
    .slice(0, 5)
    .map(b => ({
      id: b.id,
      label: b.guestName,
      sublabel: propertyNameMap.get(b.propertyId) || b.propertyId,
      date: format(new Date(b.checkInDate!), 'MMM d'),
      href: `/admin/bookings/${b.id}`,
    }));
}

function getUpcomingCheckOuts(
  bookings: DashboardBooking[],
  propertyNameMap: Map<string, string>,
  now: Date
): ActivityItem[] {
  const today = startOfDay(now);
  const futureLimit = addDays(today, 7);

  return bookings
    .filter(b => {
      if (b.status !== 'confirmed' && b.status !== 'completed') return false;
      if (!b.checkOutDate) return false;
      const checkOut = new Date(b.checkOutDate);
      return checkOut >= today && checkOut <= futureLimit;
    })
    .sort((a, b) => new Date(a.checkOutDate!).getTime() - new Date(b.checkOutDate!).getTime())
    .slice(0, 5)
    .map(b => ({
      id: b.id,
      label: b.guestName,
      sublabel: propertyNameMap.get(b.propertyId) || b.propertyId,
      date: format(new Date(b.checkOutDate!), 'MMM d'),
      href: `/admin/bookings/${b.id}`,
    }));
}

function getExpiringHolds(
  bookings: DashboardBooking[],
  propertyNameMap: Map<string, string>,
  now: Date
): ActivityItem[] {
  const expiryLimit = addHours(now, 24);

  return bookings
    .filter(b => {
      if (b.status !== 'on-hold' || !b.holdUntil) return false;
      const holdUntil = new Date(b.holdUntil);
      return holdUntil >= now && holdUntil <= expiryLimit;
    })
    .sort((a, b) => new Date(a.holdUntil!).getTime() - new Date(b.holdUntil!).getTime())
    .map(b => ({
      id: b.id,
      label: b.guestName,
      sublabel: propertyNameMap.get(b.propertyId) || b.propertyId,
      date: formatDistanceToNow(new Date(b.holdUntil!), { addSuffix: true }),
      href: `/admin/bookings/${b.id}`,
    }));
}

// ============================================================================
// Sub-components
// ============================================================================

function MetricCard({
  title,
  value,
  change,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  change?: { current: number; previous: number };
  icon: LucideIcon;
}) {
  let changeDisplay: React.ReactNode = null;

  if (change) {
    const { current, previous } = change;
    if (previous === 0 && current > 0) {
      changeDisplay = (
        <span className="text-xs text-green-600 flex items-center gap-0.5">
          <TrendingUp className="h-3 w-3" />
          +{current} new
        </span>
      );
    } else if (previous > 0) {
      const pct = Math.round(((current - previous) / previous) * 100);
      const isUp = pct >= 0;
      changeDisplay = (
        <span className={`text-xs flex items-center gap-0.5 ${isUp ? 'text-green-600' : 'text-red-600'}`}>
          {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isUp ? '+' : ''}{pct}% vs last month
        </span>
      );
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {changeDisplay && <div className="mt-1">{changeDisplay}</div>}
      </CardContent>
    </Card>
  );
}

function ActivityCard({
  title,
  items,
  emptyMessage,
  icon: Icon,
}: {
  title: string;
  items: ActivityItem[];
  emptyMessage: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center justify-between group hover:bg-muted/50 -mx-2 px-2 py-1.5 rounded-md transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>
                </div>
                <Badge variant="outline" className="ml-2 shrink-0 text-xs">
                  {item.date}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const quickActions = [
  { title: 'Properties', description: 'Manage listings', icon: Building, href: '/admin/properties' },
  { title: 'Bookings', description: 'View reservations', icon: CalendarCheck, href: '/admin/bookings' },
  { title: 'Inquiries', description: 'Guest messages', icon: MessageSquare, href: '/admin/inquiries' },
  { title: 'Coupons', description: 'Manage discounts', icon: Ticket, href: '/admin/coupons' },
  { title: 'Calendar', description: 'Availability & sync', icon: CalendarDays, href: '/admin/calendar' },
];

function QuickActions() {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {quickActions.map(action => (
          <Link key={action.href} href={action.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
              <CardContent className="pt-6 text-center">
                <action.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="font-medium text-sm">{action.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

export function DashboardContent({ data }: { data: DashboardData }) {
  const { selectedPropertyId } = usePropertySelector();

  const { bookings, inquiries, properties } = useMemo(() => {
    if (!selectedPropertyId) return data;
    return {
      bookings: data.bookings.filter(b => b.propertyId === selectedPropertyId),
      inquiries: data.inquiries.filter(i => i.propertySlug === selectedPropertyId),
      properties: data.properties.filter(p => p.id === selectedPropertyId),
    };
  }, [data, selectedPropertyId]);

  const propertyNameMap = useMemo(
    () => new Map(data.properties.map(p => [p.id, getDisplayName(p.name)])),
    [data.properties]
  );

  const now = useMemo(() => new Date(), []);

  const metrics = useMemo(
    () => computeMetrics(bookings, inquiries, properties.length, now),
    [bookings, inquiries, properties.length, now]
  );

  const upcomingCheckIns = useMemo(
    () => getUpcomingCheckIns(bookings, propertyNameMap, now),
    [bookings, propertyNameMap, now]
  );

  const upcomingCheckOuts = useMemo(
    () => getUpcomingCheckOuts(bookings, propertyNameMap, now),
    [bookings, propertyNameMap, now]
  );

  const expiringHolds = useMemo(
    () => getExpiringHolds(bookings, propertyNameMap, now),
    [bookings, propertyNameMap, now]
  );

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Bookings This Month"
          value={metrics.bookingsThisMonth}
          change={{ current: metrics.bookingsThisMonth, previous: metrics.bookingsLastMonth }}
          icon={CalendarCheck}
        />
        <MetricCard
          title="Revenue This Month"
          value={formatCurrency(metrics.revenueThisMonth, metrics.currency)}
          change={{ current: metrics.revenueThisMonth, previous: metrics.revenueLastMonth }}
          icon={DollarSign}
        />
        <MetricCard
          title="Pending Inquiries"
          value={metrics.pendingInquiries}
          icon={MessageSquare}
        />
        <MetricCard
          title="Occupancy Rate"
          value={`${metrics.occupancyRate}%`}
          icon={ArrowRight}
        />
      </div>

      {/* Activity section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ActivityCard
          title="Upcoming Check-ins"
          items={upcomingCheckIns}
          emptyMessage="No check-ins in the next 7 days"
          icon={CalendarCheck}
        />
        <ActivityCard
          title="Upcoming Check-outs"
          items={upcomingCheckOuts}
          emptyMessage="No check-outs in the next 7 days"
          icon={CalendarDays}
        />
        <ActivityCard
          title="Expiring Holds"
          items={expiringHolds}
          emptyMessage="No holds expiring soon"
          icon={Clock}
        />
      </div>

      {/* Quick actions */}
      <QuickActions />
    </div>
  );
}
