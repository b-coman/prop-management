'use server';

import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { convertTimestampsToISOStrings } from '@/lib/utils';
import { loggers } from '@/lib/logger';
import { requireAdmin, filterPropertiesForUser, AuthorizationError } from '@/lib/authorization';

const logger = loggers.admin;

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
