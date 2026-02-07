'use server';

import { revalidatePath } from 'next/cache';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { requirePropertyAccess, AuthorizationError } from '@/lib/authorization';
import { convertTimestampsToISOStrings } from '@/lib/utils';
import type { HousekeepingContact, HousekeepingMessage } from '@/types';

const logger = loggers.housekeeping;

// ============================================================================
// Contacts CRUD
// ============================================================================

export async function fetchHousekeepingContacts(
  propertyId: string
): Promise<HousekeepingContact[]> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();

    const snapshot = await db
      .collection('housekeepingContacts')
      .where('propertyId', '==', propertyId)
      .get();

    return snapshot.docs.map(doc => {
      const data = convertTimestampsToISOStrings(doc.data());
      return { id: doc.id, ...data } as HousekeepingContact;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchHousekeepingContacts', { propertyId });
      return [];
    }
    logger.error('Error fetching housekeeping contacts', error as Error, { propertyId });
    return [];
  }
}

export async function addHousekeepingContact(formData: FormData): Promise<{ error?: string }> {
  const propertyId = formData.get('propertyId')?.toString() || '';
  const name = formData.get('name')?.toString()?.trim() || '';
  const phone = formData.get('phone')?.toString()?.trim() || '';
  const language = (formData.get('language')?.toString() || 'ro') as 'ro' | 'en';
  const role = formData.get('role')?.toString()?.trim() || 'cleaning';
  const notifyMonthly = formData.get('notifyMonthly') === 'on';
  const notifyDaily = formData.get('notifyDaily') === 'on';
  const notifyChanges = formData.get('notifyChanges') === 'on';

  if (!propertyId) return { error: 'Property ID is required' };
  if (!name) return { error: 'Name is required' };
  if (!phone) return { error: 'Phone number is required' };

  // Basic E.164 validation
  if (!phone.startsWith('+') || phone.length < 10) {
    return { error: 'Phone must be in E.164 format (e.g., +40712345678)' };
  }

  try {
    await requirePropertyAccess(propertyId);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    throw error;
  }

  try {
    const db = await getAdminDb();
    await db.collection('housekeepingContacts').add({
      propertyId,
      name,
      phone,
      language,
      role,
      enabled: true,
      notifyMonthly,
      notifyDaily,
      notifyChanges,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Housekeeping contact added', { propertyId, name });
    revalidatePath('/admin/housekeeping');
    return {};
  } catch (error) {
    logger.error('Error adding housekeeping contact', error as Error, { propertyId });
    return { error: 'Failed to add contact' };
  }
}

export async function updateHousekeepingContact(
  contactId: string,
  data: Partial<Pick<HousekeepingContact, 'name' | 'phone' | 'language' | 'role' | 'notifyMonthly' | 'notifyDaily' | 'notifyChanges'>>
): Promise<{ error?: string }> {
  try {
    const db = await getAdminDb();
    const contactRef = db.collection('housekeepingContacts').doc(contactId);
    const contactDoc = await contactRef.get();

    if (!contactDoc.exists) return { error: 'Contact not found' };

    const contactData = contactDoc.data()!;
    await requirePropertyAccess(contactData.propertyId);

    await contactRef.update({
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Housekeeping contact updated', { contactId });
    revalidatePath('/admin/housekeeping');
    return {};
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    logger.error('Error updating housekeeping contact', error as Error, { contactId });
    return { error: 'Failed to update contact' };
  }
}

export async function deleteHousekeepingContact(contactId: string): Promise<{ error?: string }> {
  try {
    const db = await getAdminDb();
    const contactRef = db.collection('housekeepingContacts').doc(contactId);
    const contactDoc = await contactRef.get();

    if (!contactDoc.exists) return { error: 'Contact not found' };

    const contactData = contactDoc.data()!;
    await requirePropertyAccess(contactData.propertyId);

    await contactRef.delete();

    logger.info('Housekeeping contact deleted', { contactId });
    revalidatePath('/admin/housekeeping');
    return {};
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    logger.error('Error deleting housekeeping contact', error as Error, { contactId });
    return { error: 'Failed to delete contact' };
  }
}

export async function toggleContactEnabled(
  contactId: string,
  enabled: boolean
): Promise<{ error?: string }> {
  try {
    const db = await getAdminDb();
    const contactRef = db.collection('housekeepingContacts').doc(contactId);
    const contactDoc = await contactRef.get();

    if (!contactDoc.exists) return { error: 'Contact not found' };

    const contactData = contactDoc.data()!;
    await requirePropertyAccess(contactData.propertyId);

    await contactRef.update({
      enabled,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Housekeeping contact toggled', { contactId, enabled });
    revalidatePath('/admin/housekeeping');
    return {};
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    logger.error('Error toggling contact', error as Error, { contactId });
    return { error: 'Failed to toggle contact' };
  }
}

// ============================================================================
// Message Log
// ============================================================================

export async function fetchHousekeepingMessages(
  propertyId: string,
  limit: number = 50
): Promise<HousekeepingMessage[]> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();

    const snapshot = await db
      .collection('housekeepingMessages')
      .where('propertyId', '==', propertyId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => {
      const data = convertTimestampsToISOStrings(doc.data());
      return { id: doc.id, ...data } as HousekeepingMessage;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchHousekeepingMessages', { propertyId });
      return [];
    }
    logger.error('Error fetching housekeeping messages', error as Error, { propertyId });
    return [];
  }
}

// ============================================================================
// Manual Send Actions
// ============================================================================

export async function triggerManualMonthlySchedule(
  propertyId: string
): Promise<{ sent: number; failed: number; error?: string }> {
  try {
    await requirePropertyAccess(propertyId);

    const { sendMonthlyScheduleToProperty } = await import('@/services/housekeepingService');
    const result = await sendMonthlyScheduleToProperty(propertyId);

    revalidatePath('/admin/housekeeping');
    return result;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { sent: 0, failed: 0, error: error.message };
    }
    logger.error('Error triggering manual monthly schedule', error as Error, { propertyId });
    return { sent: 0, failed: 0, error: 'Failed to send monthly schedule' };
  }
}

export async function triggerManualDailyNotification(
  propertyId: string,
  dateStr?: string
): Promise<{ sent: number; failed: number; skipped: boolean; error?: string }> {
  try {
    await requirePropertyAccess(propertyId);

    const date = dateStr ? new Date(dateStr) : new Date();

    const { sendDailyNotificationToProperty } = await import('@/services/housekeepingService');
    const result = await sendDailyNotificationToProperty(propertyId, date);

    revalidatePath('/admin/housekeeping');
    return result;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { sent: 0, failed: 0, skipped: false, error: error.message };
    }
    logger.error('Error triggering manual daily notification', error as Error, { propertyId });
    return { sent: 0, failed: 0, skipped: false, error: 'Failed to send daily notification' };
  }
}

export async function sendTestMessage(
  contactId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getAdminDb();
    const contactRef = db.collection('housekeepingContacts').doc(contactId);
    const contactDoc = await contactRef.get();

    if (!contactDoc.exists) return { success: false, error: 'Contact not found' };

    const contactData = contactDoc.data()!;
    await requirePropertyAccess(contactData.propertyId);

    const { sendWhatsAppMessage } = await import('@/services/whatsappService');
    const result = await sendWhatsAppMessage(
      contactData.phone,
      'Test message from RentalSpot. WhatsApp notifications are working!'
    );

    // Log the test message
    await db.collection('housekeepingMessages').add({
      propertyId: contactData.propertyId,
      contactId,
      contactName: contactData.name,
      contactPhone: contactData.phone,
      type: 'manual',
      messageBody: 'Test message from RentalSpot. WhatsApp notifications are working!',
      twilioSid: result.sid,
      status: result.success ? 'sent' : 'failed',
      error: result.error,
      createdAt: FieldValue.serverTimestamp(),
    });

    revalidatePath('/admin/housekeeping');
    return { success: result.success, error: result.error };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    logger.error('Error sending test message', error as Error, { contactId });
    return { success: false, error: 'Failed to send test message' };
  }
}
