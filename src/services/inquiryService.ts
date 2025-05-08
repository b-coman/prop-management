// src/services/inquiryService.ts
// Placeholder for inquiry-related Firestore operations
'use server'; // Add 'use server' directive

import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp, Timestamp, query, where, getDocs, arrayUnion, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Inquiry, SerializableTimestamp } from "@/types";
import { parseISO } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { sanitizeText } from '@/lib/sanitize';


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
      console.warn(`Could not parse date string to ISOString: ${timestamp}`, e);
      return null;
    }
  }
  if (typeof timestamp === 'number') {
    return new Date(timestamp).toISOString();
  }
  console.warn(`Unhandled timestamp type for serialization: ${typeof timestamp}`, timestamp);
  return null;
};


export async function getInquiryById(inquiryId: string): Promise<Inquiry | null> {
     console.log(`[inquiryService] Fetching inquiry ${inquiryId}`);
    try {
        const inquiryRef = doc(db, 'inquiries', inquiryId);
        const docSnap = await getDoc(inquiryRef);

        if (docSnap.exists()) {
             const data = docSnap.data();
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
            console.warn(`[inquiryService] Inquiry ${inquiryId} not found.`);
            return null;
        }
    } catch (error) {
         console.error(`❌ [inquiryService] Error fetching inquiry ${inquiryId}:`, error);
         throw new Error(`Failed to fetch inquiry: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function updateInquiryStatus(inquiryId: string, status: Inquiry['status']): Promise<void> {
     console.log(`[inquiryService] Updating inquiry ${inquiryId} status to ${status}`);
    try {
        const inquiryRef = doc(db, 'inquiries', inquiryId);
        await updateDoc(inquiryRef, {
            status: status,
            updatedAt: serverTimestamp(),
        });
        console.log(`✅ [inquiryService] Successfully updated inquiry ${inquiryId} status.`);
        revalidatePath('/admin/inquiries');
        revalidatePath(`/admin/inquiries/${inquiryId}`);
    } catch (error) {
        console.error(`❌ [inquiryService] Error updating inquiry ${inquiryId} status:`, error);
        throw new Error(`Failed to update inquiry status: ${error instanceof Error ? error.message : String(error)}`);
    }
}


/**
 * Fetches all inquiries from the Firestore collection.
 * @returns A promise that resolves to an array of Inquiry objects.
 */
export async function getInquiries(): Promise<Inquiry[]> {
  console.log("[inquiryService] Fetching all inquiries");
  const inquiries: Inquiry[] = [];
  try {
    const inquiriesCollection = collection(db, 'inquiries');
    // Order by creation date, newest first
    const q = query(inquiriesCollection, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Convert Timestamps for client components
      inquiries.push({
        id: doc.id,
        ...data,
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt),
        checkIn: serializeTimestamp(data.checkIn),
        checkOut: serializeTimestamp(data.checkOut),
        responses: data.responses?.map((r: any) => ({ ...r, createdAt: serializeTimestamp(r.createdAt) })) || [],
      } as Inquiry); // Cast ensuring the structure matches
    });
    console.log(`[inquiryService] Found ${inquiries.length} inquiries.`);
    return inquiries;
  } catch (error) {
    console.error("❌ [inquiryService] Error fetching inquiries:", error);
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
  console.log(`[inquiryService] Adding response to inquiry ${inquiryId}. FromHost: ${fromHost}`);
  if (!inquiryId || !message) {
    throw new Error("Inquiry ID and message are required to add a response.");
  }

  const inquiryRef = doc(db, 'inquiries', inquiryId);
  const sanitizedMessage = sanitizeText(message); // Sanitize the message

  const newResponse = {
    message: sanitizedMessage,
    createdAt: serverTimestamp(), // Use Firestore server timestamp
    fromHost: fromHost,
  };

  try {
    // Update the inquiry document
    await updateDoc(inquiryRef, {
      responses: arrayUnion(newResponse), // Add the new response to the array
      status: 'responded', // Update status to 'responded'
      updatedAt: serverTimestamp(), // Update the main inquiry timestamp
    });
    console.log(`✅ [inquiryService] Successfully added response to inquiry ${inquiryId}.`);
    revalidatePath(`/admin/inquiries/${inquiryId}`); // Revalidate detail page
    revalidatePath('/admin/inquiries'); // Revalidate list page
  } catch (error) {
    console.error(`❌ [inquiryService] Error adding response to inquiry ${inquiryId}:`, error);
    throw new Error(`Failed to add response: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Add other inquiry management functions as needed
// e.g., functions related to converting inquiry to booking
