// src/services/inquiryService.ts
// Placeholder for inquiry-related Firestore operations
'use server'; // Add 'use server' directive

import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp, Timestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Inquiry, SerializableTimestamp } from "@/types";
import { parseISO } from 'date-fns';


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
    } catch (error) {
        console.error(`❌ [inquiryService] Error updating inquiry ${inquiryId} status:`, error);
        throw new Error(`Failed to update inquiry status: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Add other inquiry management functions as needed
// e.g., addResponseToInquiry, getInquiriesForProperty, etc.
