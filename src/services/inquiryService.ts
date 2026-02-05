// src/services/inquiryService.ts
// Inquiry-related Firestore operations using Admin SDK
'use server';

import { getAdminDb, Timestamp, FieldValue } from "@/lib/firebaseAdminSafe";
import type { Inquiry, SerializableTimestamp } from "@/types";
import { parseISO } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { sanitizeText } from '@/lib/sanitize';
import { loggers } from '@/lib/logger';

const logger = loggers.admin;


// Helper function to convert SerializableTimestamp to Date or null
const toDate = (timestamp: SerializableTimestamp | undefined | null): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (timestamp instanceof Timestamp) return timestamp.toDate();
  if (typeof timestamp === 'string') {
    try {
      return parseISO(timestamp);
    } catch {
      return null;
    }
  }
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  // Handle Admin SDK Timestamp-like objects with _seconds
  if (typeof timestamp === 'object' && '_seconds' in timestamp) {
    return new Date((timestamp as any)._seconds * 1000);
  }
  return null;
};

// Helper to convert Firestore Timestamp or string date to a serializable format (ISO string)
const serializeTimestamp = (timestamp: SerializableTimestamp | undefined | null): string | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  if (typeof timestamp === 'string') {
    try {
      return new Date(timestamp).toISOString();
    } catch (e) {
      logger.warn('Could not parse date string to ISOString', { timestamp, error: e });
      return null;
    }
  }
  if (typeof timestamp === 'number') {
    return new Date(timestamp).toISOString();
  }
  // Handle Admin SDK Timestamp-like objects with _seconds
  if (typeof timestamp === 'object' && '_seconds' in timestamp) {
    return new Date((timestamp as any)._seconds * 1000).toISOString();
  }
  logger.warn('Unhandled timestamp type for serialization', { type: typeof timestamp, timestamp });
  return null;
};


export async function getInquiryById(inquiryId: string): Promise<Inquiry | null> {
    logger.debug('Fetching inquiry', { inquiryId });
    try {
        const db = await getAdminDb();
        const inquiryRef = db.collection('inquiries').doc(inquiryId);
        const docSnap = await inquiryRef.get();

        if (docSnap.exists) {
             const data = docSnap.data()!;
             // Convert timestamps
             const createdAt = toDate(data.createdAt);
             const updatedAt = toDate(data.updatedAt);
             const checkIn = toDate(data.checkIn);
             const checkOut = toDate(data.checkOut);
             const responses = data.responses?.map((r: any) => ({ ...r, createdAt: toDate(r.createdAt) })) || [];

             return {
                 id: docSnap.id,
                 ...data,
                 createdAt,
                 updatedAt,
                 checkIn,
                 checkOut,
                 responses,
             } as Inquiry;
        } else {
            logger.warn('Inquiry not found', { inquiryId });
            return null;
        }
    } catch (error) {
         logger.error('Error fetching inquiry', error as Error, { inquiryId });
         throw new Error(`Failed to fetch inquiry: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function updateInquiryStatus(inquiryId: string, status: Inquiry['status']): Promise<void> {
    logger.debug('Updating inquiry status', { inquiryId, status });
    try {
        const db = await getAdminDb();
        const inquiryRef = db.collection('inquiries').doc(inquiryId);
        await inquiryRef.update({
            status: status,
            updatedAt: FieldValue.serverTimestamp(),
        });
        logger.info('Successfully updated inquiry status', { inquiryId, status });
        revalidatePath('/admin/inquiries');
        revalidatePath(`/admin/inquiries/${inquiryId}`);
    } catch (error) {
        logger.error('Error updating inquiry status', error as Error, { inquiryId, status });
        throw new Error(`Failed to update inquiry status: ${error instanceof Error ? error.message : String(error)}`);
    }
}


/**
 * Fetches all inquiries from the Firestore collection.
 * @returns A promise that resolves to an array of Inquiry objects.
 */
export async function getInquiries(): Promise<Inquiry[]> {
  logger.debug('Fetching all inquiries');
  const inquiries: Inquiry[] = [];
  try {
    const db = await getAdminDb();
    // Order by creation date, newest first
    const inquiriesSnapshot = await db.collection('inquiries')
      .orderBy('createdAt', 'desc')
      .get();

    inquiriesSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Convert Timestamps for client components
      inquiries.push({
        id: docSnap.id,
        ...data,
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt),
        checkIn: serializeTimestamp(data.checkIn),
        checkOut: serializeTimestamp(data.checkOut),
        responses: data.responses?.map((r: any) => ({ ...r, createdAt: serializeTimestamp(r.createdAt) })) || [],
      } as Inquiry);
    });
    logger.info('Fetched inquiries', { count: inquiries.length });
    return inquiries;
  } catch (error) {
    logger.error('Error fetching inquiries', error as Error);
    throw new Error(`Failed to fetch inquiries: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Adds a response message to an existing inquiry.
 * @param inquiryId The ID of the inquiry to add the response to.
 * @param message The content of the response message.
 * @param fromHost True if the response is from the host/admin, false otherwise.
 * @returns A promise that resolves when the update is complete.
 */
export async function addResponseToInquiry(
  inquiryId: string,
  message: string,
  fromHost: boolean
): Promise<void> {
  logger.debug('Adding response to inquiry', { inquiryId, fromHost });
  if (!inquiryId || !message) {
    throw new Error("Inquiry ID and message are required to add a response.");
  }

  const sanitizedMessage = sanitizeText(message); // Sanitize the message

  const newResponse = {
    message: sanitizedMessage,
    createdAt: FieldValue.serverTimestamp(), // Use Firestore server timestamp
    fromHost: fromHost,
  };

  try {
    const db = await getAdminDb();
    const inquiryRef = db.collection('inquiries').doc(inquiryId);

    // Update the inquiry document using arrayUnion equivalent
    await inquiryRef.update({
      responses: FieldValue.arrayUnion(newResponse), // Add the new response to the array
      status: 'responded', // Update status to 'responded'
      updatedAt: FieldValue.serverTimestamp(), // Update the main inquiry timestamp
    });
    logger.info('Successfully added response to inquiry', { inquiryId });
    revalidatePath(`/admin/inquiries/${inquiryId}`); // Revalidate detail page
    revalidatePath('/admin/inquiries'); // Revalidate list page
  } catch (error) {
    logger.error('Error adding response to inquiry', error as Error, { inquiryId });
    throw new Error(`Failed to add response: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Add other inquiry management functions as needed
// e.g., functions related to converting inquiry to booking
