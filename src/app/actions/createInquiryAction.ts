// src/app/actions/createInquiryAction.ts
"use server";

import { z } from "zod";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Inquiry, CurrencyCode } from "@/types"; // Added CurrencyCode
import { SUPPORTED_CURRENCIES } from "@/types"; // Import SUPPORTED_CURRENCIES
import { sanitizeEmail, sanitizePhone, sanitizeText } from "@/lib/sanitize";
import { revalidatePath } from "next/cache";
// Import email service functions
import { sendInquiryConfirmationEmail, sendInquiryNotificationEmail } from "@/services/emailService";

// Schema for creating an inquiry
const CreateInquirySchema = z.object({
  propertySlug: z.string().min(1, "Property slug is required."),
  checkInDate: z.string().datetime("Invalid check-in date."),
  checkOutDate: z.string().datetime("Invalid check-out date."),
  guestCount: z.number().int().positive("Invalid guest count."),
  guestInfo: z.object({
    firstName: z.string().min(1, "First name is required.").transform(sanitizeText),
    lastName: z.string().min(1, "Last name is required.").transform(sanitizeText),
    email: z.string().email("Invalid email address.").transform(sanitizeEmail),
    phone: z.string().optional().transform(val => val ? sanitizePhone(val) : undefined),
  }),
  message: z.string().min(10, "Message must be at least 10 characters.").max(1000, "Message cannot exceed 1000 characters.").transform(sanitizeText),
  totalPrice: z.number().nonnegative("Total price must be a non-negative number.").optional(),
  currency: z.enum(SUPPORTED_CURRENCIES).optional(),
}).refine(data => new Date(data.checkOutDate) > new Date(data.checkInDate), {
  message: "Check-out date must be after check-in date.",
  path: ["checkOutDate"],
});

type CreateInquiryInput = z.infer<typeof CreateInquirySchema>;

export async function createInquiryAction(
  input: CreateInquiryInput
): Promise<{ inquiryId?: string; error?: string }> {
  console.log("[Action createInquiryAction] Called with input:", JSON.stringify(input, null, 2));
  const validationResult = CreateInquirySchema.safeParse(input);

  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.error("[Action createInquiryAction] Validation Error:", errorMessages);
    return { error: `Invalid inquiry data: ${errorMessages}` };
  }

  const {
    propertySlug,
    checkInDate,
    checkOutDate,
    guestCount,
    guestInfo,
    message,
    totalPrice,
    currency,
  } = validationResult.data;

  try {
    const inquiriesCollection = collection(db, 'inquiries');
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    const inquiryData: Omit<Inquiry, 'id'> = {
      propertySlug: propertySlug,
      checkIn: Timestamp.fromDate(checkIn),
      checkOut: Timestamp.fromDate(checkOut),
      guestCount: guestCount,
      guestInfo: guestInfo,
      message: message,
      status: "new",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      responses: [], // Initialize with empty responses array
      totalPrice: totalPrice, // Add totalPrice
      currency: currency, // Add currency
    };
    console.log("[Action createInquiryAction] Prepared Firestore Data:", inquiryData);

    const docRef = await addDoc(inquiriesCollection, inquiryData);
    console.log(`[Action createInquiryAction] Inquiry created successfully with ID: ${docRef.id}`);

    // Send email notifications
    try {
      // Send confirmation email to the guest
      const inquiryWithId = { ...inquiryData, id: docRef.id } as Inquiry;
      const guestEmailResult = await sendInquiryConfirmationEmail(guestInfo.email, inquiryWithId);

      if (guestEmailResult.success) {
        console.log(`✅ [Action createInquiryAction] Sent confirmation email to guest ${guestInfo.email}`);
        if (guestEmailResult.previewUrl) {
          console.log(`  - Preview URL: ${guestEmailResult.previewUrl}`);
        }
      } else {
        console.warn(`⚠️ [Action createInquiryAction] Failed to send confirmation email: ${guestEmailResult.error}`);
      }

      // Fetch property owner email and send notification
      try {
        // For now, send to a fallback admin email since we don't have owner email
        // In a real implementation, you would fetch the property owner's email
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@rentalspot.com';
        const ownerEmailResult = await sendInquiryNotificationEmail(adminEmail, inquiryWithId);

        if (ownerEmailResult.success) {
          console.log(`✅ [Action createInquiryAction] Sent notification email to admin ${adminEmail}`);
          if (ownerEmailResult.previewUrl) {
            console.log(`  - Preview URL: ${ownerEmailResult.previewUrl}`);
          }
        } else {
          console.warn(`⚠️ [Action createInquiryAction] Failed to send notification email: ${ownerEmailResult.error}`);
        }
      } catch (ownerEmailError) {
        console.error(`❌ [Action createInquiryAction] Error sending notification to owner:`, ownerEmailError);
        // Don't fail if just owner notification fails
      }
    } catch (emailError) {
      console.error(`❌ [Action createInquiryAction] Failed to send notification emails:`, emailError);
      // Don't fail the whole action if email fails, but log it
    }

    revalidatePath(`/properties/${propertySlug}`); // May need revalidation if inquiries affect display
    return { inquiryId: docRef.id };
  } catch (error) {
    console.error(`❌ [Action createInquiryAction] Error creating inquiry:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('PERMISSION_DENIED')) {
      return { error: 'Permission denied. Could not create inquiry.' };
    }
    return { error: `Failed to create inquiry: ${errorMessage}` };
  }
}