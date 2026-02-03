// src/app/actions/createInquiryAction.ts
"use server";

import { z } from "zod";
import { collection, addDoc, serverTimestamp, Timestamp, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Inquiry, Property, CurrencyCode, LanguageCode } from "@/types";
import { SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES } from "@/types";
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
  language: z.enum(SUPPORTED_LANGUAGES).optional().default('en'), // User's language preference for emails
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
    language,
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
      language: language, // User's language preference for emails
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
        // Fetch property to get owner email
        const propertyRef = doc(db, 'properties', propertySlug);
        const propertySnap = await getDoc(propertyRef);

        let notificationEmail: string | null = null;
        if (propertySnap.exists()) {
          const propertyData = propertySnap.data() as Property;
          notificationEmail = propertyData.ownerEmail || null;
        }

        // Fallback to ADMIN_EMAIL env var if no owner email configured
        const finalEmail = notificationEmail || process.env.ADMIN_EMAIL;

        if (finalEmail) {
          const ownerEmailResult = await sendInquiryNotificationEmail(finalEmail, inquiryWithId);

          if (ownerEmailResult.success) {
            console.log(`✅ [Action createInquiryAction] Sent notification email to ${finalEmail}`);
            if (ownerEmailResult.previewUrl) {
              console.log(`  - Preview URL: ${ownerEmailResult.previewUrl}`);
            }
          } else {
            console.warn(`⚠️ [Action createInquiryAction] Failed to send notification email: ${ownerEmailResult.error}`);
          }
        } else {
          console.warn(`⚠️ [Action createInquiryAction] No owner email configured for property ${propertySlug} and no ADMIN_EMAIL env var set. Skipping notification.`);
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