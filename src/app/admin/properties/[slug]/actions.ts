'use server';

import { getAdminDb, Timestamp } from '@/lib/firebaseAdminSafe';
import { convertTimestampsToISOStrings } from '@/lib/utils';
import { loggers } from '@/lib/logger';
import { requirePropertyAccess, AuthorizationError } from '@/lib/authorization';
import type { SerializableTimestamp } from '@/types';
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  getDaysInMonth,
  differenceInDays,
  addDays,
  startOfDay,
  format,
} from 'date-fns';

const logger = loggers.admin;

const serializeTimestamp = (timestamp: SerializableTimestamp | undefined | null): string | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Timestamp) return timestamp.toDate().toISOString();
  if (timestamp instanceof Date) return timestamp.toISOString();
  if (typeof timestamp === 'string') return timestamp;
  if (typeof timestamp === 'number') return new Date(timestamp).toISOString();
  if (typeof timestamp === 'object' && '_seconds' in timestamp) {
    return new Date((timestamp as any)._seconds * 1000).toISOString();
  }
  return null;
};

const toDate = (timestamp: SerializableTimestamp | undefined | null): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (timestamp instanceof Timestamp) return timestamp.toDate();
  if (typeof timestamp === 'string') {
    try { return new Date(timestamp); } catch { return null; }
  }
  if (typeof timestamp === 'number') return new Date(timestamp);
  if (typeof timestamp === 'object' && '_seconds' in timestamp) {
    return new Date((timestamp as any)._seconds * 1000);
  }
  return null;
};

export interface PropertyOverviewData {
  property: {
    slug: string;
    name: string;
    location: string;
    status: string;
    pricePerNight: number;
    baseCurrency: string;
    maxGuests: number;
    baseOccupancy: number;
    bedrooms?: number;
    bathrooms?: number;
    checkInTime?: string;
    checkOutTime?: string;
  };
  metrics: {
    totalBookings: number;
    bookingsThisMonth: number;
    revenueThisMonth: number;
    revenueLastMonth: number;
    occupancyThisMonth: number;
    pendingInquiries: number;
    activeICalFeeds: number;
  };
  recentBookings: {
    id: string;
    guestName: string;
    checkInDate: string | null;
    checkOutDate: string | null;
    status: string;
    total: number;
    currency: string;
  }[];
  upcomingCheckIns: { id: string; guestName: string; date: string }[];
  upcomingCheckOuts: { id: string; guestName: string; date: string }[];
}

function getDisplayName(name: any): string {
  if (typeof name === 'string') return name;
  if (name && typeof name === 'object') return name.en || name.ro || 'Unnamed';
  return 'Unnamed';
}

function getLocationString(location: any): string {
  if (!location) return '';
  if (typeof location === 'string') return location;
  const parts = [location.city, location.country].filter(Boolean);
  return parts.join(', ');
}

export async function fetchPropertyOverview(slug: string): Promise<PropertyOverviewData | null> {
  try {
    await requirePropertyAccess(slug);
    const db = await getAdminDb();

    // Parallel queries
    const [propertyDoc, bookingsSnap, inquiriesSnap, feedsSnap] = await Promise.all([
      db.collection('properties').doc(slug).get(),
      db.collection('bookings').where('propertyId', '==', slug).get(),
      db.collection('inquiries').where('propertySlug', '==', slug).get(),
      db.collection('icalFeeds').where('propertyId', '==', slug).get(),
    ]);

    if (!propertyDoc.exists) return null;

    const propData = convertTimestampsToISOStrings(propertyDoc.data());

    // Build property summary
    const property = {
      slug: propertyDoc.id,
      name: getDisplayName(propData.name),
      location: getLocationString(propData.location),
      status: propData.status || 'active',
      pricePerNight: propData.pricePerNight || 0,
      baseCurrency: propData.baseCurrency || 'EUR',
      maxGuests: propData.maxGuests || 0,
      baseOccupancy: propData.baseOccupancy || 0,
      bedrooms: propData.bedrooms,
      bathrooms: propData.bathrooms,
      checkInTime: propData.checkInTime,
      checkOutTime: propData.checkOutTime,
    };

    // Process bookings
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));
    const today = startOfDay(now);
    const weekAhead = addDays(today, 7);

    const isActive = (status: string) => status === 'confirmed' || status === 'completed';

    interface BookingRow {
      id: string;
      guestName: string;
      checkInDate: string | null;
      checkOutDate: string | null;
      status: string;
      total: number;
      currency: string;
      createdAt: Date | null;
      checkInDateObj: Date | null;
      checkOutDateObj: Date | null;
    }

    const bookings: BookingRow[] = bookingsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        guestName: `${d.guestInfo?.firstName || ''} ${d.guestInfo?.lastName || ''}`.trim() || 'Unknown Guest',
        checkInDate: serializeTimestamp(d.checkInDate),
        checkOutDate: serializeTimestamp(d.checkOutDate),
        status: d.status || 'unknown',
        total: d.pricing?.total || 0,
        currency: d.pricing?.currency || property.baseCurrency,
        createdAt: toDate(d.createdAt),
        checkInDateObj: toDate(d.checkInDate),
        checkOutDateObj: toDate(d.checkOutDate),
      };
    });

    // Metrics
    const totalBookings = bookings.filter(b => isActive(b.status)).length;

    const bookingsThisMonth = bookings.filter(b => {
      if (!isActive(b.status) || !b.createdAt) return false;
      return b.createdAt >= currentMonthStart && b.createdAt <= currentMonthEnd;
    });

    const bookingsLastMonth = bookings.filter(b => {
      if (!isActive(b.status) || !b.createdAt) return false;
      return b.createdAt >= lastMonthStart && b.createdAt <= lastMonthEnd;
    });

    const revenueThisMonth = bookingsThisMonth.reduce((sum, b) => sum + b.total, 0);
    const revenueLastMonth = bookingsLastMonth.reduce((sum, b) => sum + b.total, 0);

    // Occupancy
    const daysInMonth = getDaysInMonth(now);
    let bookedNights = 0;
    for (const b of bookings.filter(b => isActive(b.status))) {
      if (!b.checkInDateObj || !b.checkOutDateObj) continue;
      const overlapStart = b.checkInDateObj < currentMonthStart ? currentMonthStart : b.checkInDateObj;
      const overlapEnd = b.checkOutDateObj > currentMonthEnd ? currentMonthEnd : b.checkOutDateObj;
      if (overlapStart < overlapEnd) {
        bookedNights += differenceInDays(overlapEnd, overlapStart);
      }
    }
    const occupancyThisMonth = daysInMonth > 0 ? Math.round((bookedNights / daysInMonth) * 100) : 0;

    // Inquiries
    const pendingInquiries = inquiriesSnap.docs.filter(doc => doc.data().status === 'new').length;

    // iCal feeds
    const activeICalFeeds = feedsSnap.docs.length;

    // Recent bookings (last 10 by creation date)
    const recentBookings = bookings
      .filter(b => b.createdAt)
      .sort((a, b) => (b.createdAt!.getTime()) - (a.createdAt!.getTime()))
      .slice(0, 10)
      .map(({ id, guestName, checkInDate, checkOutDate, status, total, currency }) => ({
        id, guestName, checkInDate, checkOutDate, status, total, currency,
      }));

    // Upcoming check-ins (next 7 days)
    const upcomingCheckIns = bookings
      .filter(b => {
        if (b.status !== 'confirmed' && b.status !== 'on-hold') return false;
        return b.checkInDateObj && b.checkInDateObj >= today && b.checkInDateObj <= weekAhead;
      })
      .sort((a, b) => a.checkInDateObj!.getTime() - b.checkInDateObj!.getTime())
      .slice(0, 5)
      .map(b => ({
        id: b.id,
        guestName: b.guestName,
        date: format(b.checkInDateObj!, 'MMM d'),
      }));

    // Upcoming check-outs (next 7 days)
    const upcomingCheckOuts = bookings
      .filter(b => {
        if (b.status !== 'confirmed' && b.status !== 'completed') return false;
        return b.checkOutDateObj && b.checkOutDateObj >= today && b.checkOutDateObj <= weekAhead;
      })
      .sort((a, b) => a.checkOutDateObj!.getTime() - b.checkOutDateObj!.getTime())
      .slice(0, 5)
      .map(b => ({
        id: b.id,
        guestName: b.guestName,
        date: format(b.checkOutDateObj!, 'MMM d'),
      }));

    logger.info('Property overview fetched', { slug, totalBookings, pendingInquiries });

    return {
      property,
      metrics: {
        totalBookings,
        bookingsThisMonth: bookingsThisMonth.length,
        revenueThisMonth,
        revenueLastMonth,
        occupancyThisMonth,
        pendingInquiries,
        activeICalFeeds,
      },
      recentBookings,
      upcomingCheckIns,
      upcomingCheckOuts,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for property overview', { slug });
      return null;
    }
    logger.error('Error fetching property overview', error as Error, { slug });
    return null;
  }
}
