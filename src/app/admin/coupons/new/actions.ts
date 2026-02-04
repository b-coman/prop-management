// src/app/admin/coupons/new/actions.ts
"use server";

import { z } from "zod";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Coupon } from "@/types";
import { revalidatePath } from "next/cache";
import { sanitizeText } from "@/lib/sanitize";
import { loggers } from '@/lib/logger';
import { requireSuperAdmin, handleAuthError, AuthorizationError } from '@/lib/authorization';

const logger = loggers.admin;

const exclusionPeriodSchema = z.object({
  start: z.date(),
  end: z.date(),
}).refine(data => data.end > data.start, {
  message: "Exclusion end date must be after start date.",
  path: ["end"],
});

// Apply sanitization using Zod transforms
const createCouponSchema = z.object({
  code: z.string().min(3).max(50).trim().transform(val => sanitizeText(val.toUpperCase())),
  discount: z.coerce.number().min(1).max(100),
  validUntil: z.date(),
  isActive: z.boolean().default(true),
  description: z.string().max(100).optional().transform(val => val ? sanitizeText(val) : ""),
  bookingValidFrom: z.date().nullable().optional(),
  bookingValidUntil: z.date().nullable().optional(),
  exclusionPeriods: z.array(exclusionPeriodSchema).optional(),
})
.refine(data => {
    if (data.bookingValidFrom && data.bookingValidUntil) {
        return data.bookingValidUntil > data.bookingValidFrom;
    }
    return true;
}, {
    message: "Booking validity end date must be after start date.",
    path: ["bookingValidUntil"],
})
.refine(data => {
    if (data.validUntil && data.bookingValidUntil) {
        return data.validUntil >= data.bookingValidUntil;
    }
    return true;
}, {
    message: "Coupon expiry date must be on or after the booking validity end date.",
    path: ["validUntil"],
});

export async function createCouponAction(
  values: z.infer<typeof createCouponSchema>
): Promise<{ id?: string; code?: string; error?: string }> {
  try {
    // Only super admins can create coupons
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return handleAuthError(error) as { error: string };
    }
    throw error;
  }

  const validatedFields = createCouponSchema.safeParse(values);

  if (!validatedFields.success) {
    const errorMessages = validatedFields.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    logger.warn('Create coupon validation error', { errors: errorMessages });
    return { error: `Invalid input: ${errorMessages}` };
  }

  const {
    code, // Sanitized by Zod
    discount,
    validUntil,
    isActive,
    description, // Sanitized by Zod
    bookingValidFrom,
    bookingValidUntil,
    exclusionPeriods
  } = validatedFields.data;

  try {
    const couponsCollection = collection(db, 'coupons');
    const couponData: Omit<Coupon, 'id'> = {
      code: code,
      discount: discount,
      validUntil: Timestamp.fromDate(validUntil),
      isActive: isActive,
      description: description || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      bookingValidFrom: bookingValidFrom ? Timestamp.fromDate(bookingValidFrom) : null,
      bookingValidUntil: bookingValidUntil ? Timestamp.fromDate(bookingValidUntil) : null,
      exclusionPeriods: exclusionPeriods ? exclusionPeriods.map(period => ({
        start: Timestamp.fromDate(period.start),
        end: Timestamp.fromDate(period.end),
      })) : null,
    };

    const docRef = await addDoc(couponsCollection, couponData);
    logger.info('Coupon created successfully', { code, id: docRef.id });
    revalidatePath('/admin/coupons');
    return { id: docRef.id, code: code };
  } catch (error) {
    logger.error('Error creating coupon', error as Error, { code });
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('PERMISSION_DENIED')) {
      return { error: 'Permission denied. Ensure you are logged in with admin privileges.' };
    }
    return { error: `Failed to create coupon: ${errorMessage}` };
  }
}
