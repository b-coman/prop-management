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

/** A campaign that needs the owner: a draft to review, or approved messages still to send by hand. */
export interface DashboardCampaign {
  id: string;
  propertyId: string;
  name: string;
  status: 'draft' | 'sending';
  createdAt: string | null;
  /** draft: messages written; sending: approved messages not sent yet. */
  count: number;
}

export interface DashboardData {
  bookings: DashboardBooking[];
  inquiries: DashboardInquiry[];
  properties: AdminProperty[];
  campaignsWaiting: DashboardCampaign[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
  try {
    const user = await requireAdmin();
    const db = await getAdminDb();

    const [bookingsSnapshot, inquiriesSnapshot, propertiesSnapshot, campaignsSnapshot, outboxSnapshot] = await Promise.all([
      db.collection('bookings').orderBy('createdAt', 'desc').get(),
      db.collection('inquiries').orderBy('createdAt', 'desc').get(),
      db.collection('properties').get(),
      db.collection('campaigns').where('status', 'in', ['draft', 'sending']).get(),
      db.collection('outbox').where('status', 'in', ['approved_pending_send', 'claimed']).get(),
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

    // Campaigns are written automatically but only ever sent by hand, so the dashboard says what is
    // waiting on the owner. Same property scoping as everything else here.
    const unsentByCampaign = new Map<string, number>();
    outboxSnapshot.docs.forEach((d) => { const c = d.data().campaignId; if (c) unsentByCampaign.set(c, (unsentByCampaign.get(c) ?? 0) + 1); });
    const visible = new Set(properties.map((p) => p.id));
    const campaignsWaiting: DashboardCampaign[] = campaignsSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        const status = data.status as 'draft' | 'sending';
        const drafts = (data.perGuestDrafts ?? []) as Array<{ body?: string }>;
        return {
          id: doc.id,
          propertyId: data.propertyId,
          name: data.name || doc.id,
          status,
          createdAt: serializeTimestamp(data.createdAt),
          count: status === 'draft' ? drafts.filter((x) => (x.body ?? '').trim()).length : unsentByCampaign.get(doc.id) ?? 0,
        };
      })
      .filter((c) => visible.has(c.propertyId) && (c.status === 'draft' || c.count > 0))
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));

    logger.info('Dashboard data fetched', {
      bookings: bookings.length,
      inquiries: inquiries.length,
      properties: properties.length,
    });

    return { bookings, inquiries, properties, campaignsWaiting };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchDashboardData');
      return { bookings: [], inquiries: [], properties: [], campaignsWaiting: [] };
    }
    logger.error('Error fetching dashboard data', error as Error);
    return { bookings: [], inquiries: [], properties: [], campaignsWaiting: [] };
  }
}
