'use server';

import { getAdminDb, Timestamp } from '@/lib/firebaseAdminSafe';
import { convertTimestampsToISOStrings } from '@/lib/utils';
import { loggers } from '@/lib/logger';
import {
  requireAdmin,
  filterPropertiesForUser,
  filterBookingsForUser,
  filterInquiriesForUser,
  AuthorizationError,
} from '@/lib/authorization';
import type { Booking, Inquiry, SerializableTimestamp } from '@/types';

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

export interface AdminProperty {
  id: string;
  slug: string;
  name: string | { en?: string; ro?: string };
  location?: string | { city?: string; country?: string };
  status: string;
}

export async function fetchAdminProperties(): Promise<AdminProperty[]> {
  try {
    const user = await requireAdmin();
    const db = await getAdminDb();
    const snapshot = await db.collection('properties').get();

    const allProperties = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const serialized = convertTimestampsToISOStrings(data);
      return {
        id: docSnap.id,
        slug: docSnap.id,
        name: serialized.name || docSnap.id,
        location: serialized.location || '',
        status: serialized.status || 'active',
      };
    });

    return filterPropertiesForUser(allProperties, user);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchAdminProperties');
      return [];
    }
    logger.error('Error fetching admin properties', error as Error);
    return [];
  }
}

// Dashboard types

export interface DashboardBooking {
  id: string;
  propertyId: string;
  status: Booking['status'];
  checkInDate: string | null;
  checkOutDate: string | null;
  guestName: string;
  total: number;
  currency: string;
  holdUntil: string | null;
  createdAt: string | null;
}

export interface DashboardInquiry {
  id: string;
  propertySlug: string;
  status: Inquiry['status'];
  guestName: string;
  createdAt: string | null;
}

export interface DashboardData {
  bookings: DashboardBooking[];
  inquiries: DashboardInquiry[];
  properties: AdminProperty[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
  try {
    const user = await requireAdmin();
    const db = await getAdminDb();

    const [bookingsSnapshot, inquiriesSnapshot, propertiesSnapshot] = await Promise.all([
      db.collection('bookings').orderBy('createdAt', 'desc').get(),
      db.collection('inquiries').orderBy('createdAt', 'desc').get(),
      db.collection('properties').get(),
    ]);

    const allBookings: DashboardBooking[] = bookingsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        propertyId: data.propertyId,
        status: data.status,
        checkInDate: serializeTimestamp(data.checkInDate),
        checkOutDate: serializeTimestamp(data.checkOutDate),
        guestName: `${data.guestInfo?.firstName || ''} ${data.guestInfo?.lastName || ''}`.trim() || 'Unknown Guest',
        total: data.pricing?.total || 0,
        currency: data.pricing?.currency || 'EUR',
        holdUntil: serializeTimestamp(data.holdUntil),
        createdAt: serializeTimestamp(data.createdAt),
      };
    });

    const allInquiries: DashboardInquiry[] = inquiriesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        propertySlug: data.propertySlug,
        status: data.status,
        guestName: `${data.guestInfo?.firstName || ''} ${data.guestInfo?.lastName || ''}`.trim() || 'Unknown Guest',
        createdAt: serializeTimestamp(data.createdAt),
      };
    });

    const allProperties: AdminProperty[] = propertiesSnapshot.docs.map(doc => {
      const data = doc.data();
      const serialized = convertTimestampsToISOStrings(data);
      return {
        id: doc.id,
        slug: doc.id,
        name: serialized.name || doc.id,
        location: serialized.location || '',
        status: serialized.status || 'active',
      };
    });

    const bookings = filterBookingsForUser(allBookings, user);
    const inquiries = filterInquiriesForUser(allInquiries, user);
    const properties = filterPropertiesForUser(allProperties, user);

    logger.info('Dashboard data fetched', {
      bookings: bookings.length,
      inquiries: inquiries.length,
      properties: properties.length,
    });

    return { bookings, inquiries, properties };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchDashboardData');
      return { bookings: [], inquiries: [], properties: [] };
    }
    logger.error('Error fetching dashboard data', error as Error);
    return { bookings: [], inquiries: [], properties: [] };
  }
}
