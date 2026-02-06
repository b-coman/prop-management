// src/app/admin/coupons/actions.ts
"use server";

import { z } from "zod";
import { getAdminDb, Timestamp, FieldValue } from "@/lib/firebaseAdminSafe";
import type { Coupon, SerializableTimestamp } from "@/types";
import { revalidatePath } from "next/cache";
import { sanitizeText } from "@/lib/sanitize";
import { loggers } from '@/lib/logger';
import { requireSuperAdmin, handleAuthError, AuthorizationError } from '@/lib/authorization';

const logger = loggers.admin;

// Schema for updating coupon status
const updateCouponStatusSchema = z.object({
  couponId: z.string().min(1, "Coupon ID is required."),
  isActive: z.boolean(),
});

// Schema for updating coupon expiry date
const updateCouponExpirySchema = z.object({
  couponId: z.string().min(1, "Coupon ID is required."),
  validUntil: z.date(), // Expecting a Date object from the client
});

// Schema for updating coupon booking validity period
const updateCouponBookingValiditySchema = z.object({
    couponId: z.string().min(1, "Coupon ID is required."),
    bookingValidFrom: z.date().nullable(),
    bookingValidUntil: z.date().nullable(),
}).refine(data => {
    if (data.bookingValidFrom && data.bookingValidUntil) {
        return data.bookingValidUntil >= data.bookingValidFrom;
    }
    return true;
}, {
    message: "Booking validity end date must be on or after the start date.",
    path: ["bookingValidUntil"],
});

// Schema for updating coupon exclusion periods
const exclusionPeriodSchema = z.object({
  start: z.date(),
  end: z.date(),
}).refine(data => data.end >= data.start, { // Allow same day start/end
  message: "Exclusion end date must be on or after the start date.",
  path: ["end"],
});

const updateCouponExclusionsSchema = z.object({
  couponId: z.string().min(1, "Coupon ID is required."),
  exclusionPeriods: z.array(exclusionPeriodSchema),
});


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
  logger.warn('Unhandled timestamp type for serialization', { type: typeof timestamp, timestamp });
  return null;
};


/**
 * Fetch all coupons
 * Only super admins can access coupons (global resource)
 */
export async function fetchCoupons(): Promise<Coupon[]> {
  try {
    // Only super admins can manage coupons
    await requireSuperAdmin();

    const db = await getAdminDb();
    const couponsSnapshot = await db.collection('coupons').get();
    const coupons: Coupon[] = [];

    couponsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Convert Timestamps to ISO strings for client components
      coupons.push({
        id: docSnap.id,
        ...data,
        validUntil: serializeTimestamp(data.validUntil),
        bookingValidFrom: serializeTimestamp(data.bookingValidFrom),
        bookingValidUntil: serializeTimestamp(data.bookingValidUntil),
        exclusionPeriods: data.exclusionPeriods?.map((p: {start: SerializableTimestamp, end: SerializableTimestamp}) => ({
            start: serializeTimestamp(p.start),
            end: serializeTimestamp(p.end),
        })) || null,
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt),
      } as Coupon);
    });

    return coupons;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchCoupons');
      return [];
    }
    logger.error('Error fetching coupons', error as Error);
    return [];
  }
}

export async function updateCouponStatusAction(
  values: z.infer<typeof updateCouponStatusSchema>
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return handleAuthError(error);
    }
    throw error;
  }

  const validatedFields = updateCouponStatusSchema.safeParse(values);

  if (!validatedFields.success) {
    return { success: false, error: "Invalid input." };
  }

  const { couponId, isActive } = validatedFields.data;

  try {
    const db = await getAdminDb();
    const couponRef = db.collection('coupons').doc(couponId);
    await couponRef.update({
      isActive: isActive,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath('/admin/coupons');
    return { success: true };
  } catch (error) {
    logger.error('Error updating coupon status', error as Error, { couponId });
    return { success: false, error: "Failed to update coupon status." };
  }
}

export async function updateCouponExpiryAction(
  values: z.infer<typeof updateCouponExpirySchema>
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return handleAuthError(error);
    }
    throw error;
  }

  const validatedFields = updateCouponExpirySchema.safeParse(values);

  if (!validatedFields.success) {
     const errorMessages = validatedFields.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, error: `Invalid input: ${errorMessages}` };
  }

  const { couponId, validUntil } = validatedFields.data;

  try {
    const db = await getAdminDb();
    const couponRef = db.collection('coupons').doc(couponId);
    await couponRef.update({
      validUntil: Timestamp.fromDate(validUntil),
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath('/admin/coupons');
    return { success: true };
  } catch (error) {
    logger.error('Error updating coupon expiry', error as Error, { couponId });
    return { success: false, error: "Failed to update coupon expiry date." };
  }
}


export async function updateCouponBookingValidityAction(
  values: z.infer<typeof updateCouponBookingValiditySchema>
): Promise<{ success: boolean; error?: string }> {
    try {
      await requireSuperAdmin();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return handleAuthError(error);
      }
      throw error;
    }

    const validatedFields = updateCouponBookingValiditySchema.safeParse(values);

    if (!validatedFields.success) {
        const errorMessages = validatedFields.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return { success: false, error: `Invalid input: ${errorMessages}` };
    }

    const { couponId, bookingValidFrom, bookingValidUntil } = validatedFields.data;

    try {
        const db = await getAdminDb();
        const couponRef = db.collection('coupons').doc(couponId);
        await couponRef.update({
            bookingValidFrom: bookingValidFrom ? Timestamp.fromDate(bookingValidFrom) : null,
            bookingValidUntil: bookingValidUntil ? Timestamp.fromDate(bookingValidUntil) : null,
            updatedAt: FieldValue.serverTimestamp(),
        });
        revalidatePath('/admin/coupons');
        return { success: true };
    } catch (error) {
        logger.error('Error updating coupon booking validity', error as Error, { couponId });
        return { success: false, error: "Failed to update coupon booking validity." };
    }
}

export async function updateCouponExclusionsAction(
  values: z.infer<typeof updateCouponExclusionsSchema>
): Promise<{ success: boolean; error?: string }> {
    try {
      await requireSuperAdmin();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return handleAuthError(error);
      }
      throw error;
    }

    const validatedFields = updateCouponExclusionsSchema.safeParse(values);

    if (!validatedFields.success) {
        const errorMessages = validatedFields.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return { success: false, error: `Invalid input: ${errorMessages}` };
    }

    const { couponId, exclusionPeriods } = validatedFields.data;

    try {
        const db = await getAdminDb();
        const couponRef = db.collection('coupons').doc(couponId);
        await couponRef.update({
            exclusionPeriods: exclusionPeriods.map(period => ({
                start: Timestamp.fromDate(period.start),
                end: Timestamp.fromDate(period.end),
            })),
            updatedAt: FieldValue.serverTimestamp(),
        });
        revalidatePath('/admin/coupons');
        return { success: true };
    } catch (error) {
        logger.error('Error updating coupon exclusion periods', error as Error, { couponId });
        return { success: false, error: "Failed to update coupon exclusion periods." };
    }
}

// ============================================================================
// Bulk Actions
// ============================================================================

const bulkIdsSchema = z.array(z.string().min(1)).min(1).max(50);

interface BulkActionResult {
  success: boolean;
  successCount: number;
  failCount: number;
}

export async function bulkDeactivateCoupons(couponIds: string[]): Promise<BulkActionResult> {
  const parsed = bulkIdsSchema.safeParse(couponIds);
  if (!parsed.success) {
    return { success: false, successCount: 0, failCount: couponIds.length };
  }

  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Auth failed for bulkDeactivateCoupons', { error: error.message });
    }
    return { success: false, successCount: 0, failCount: parsed.data.length };
  }

  try {
    const db = await getAdminDb();
    const batch = db.batch();

    for (const couponId of parsed.data) {
      const ref = db.collection('coupons').doc(couponId);
      batch.update(ref, {
        isActive: false,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    revalidatePath('/admin/coupons');
    logger.info('Bulk deactivate coupons completed', { count: parsed.data.length });

    return { success: true, successCount: parsed.data.length, failCount: 0 };
  } catch (error) {
    logger.error('Error in bulk deactivate coupons', error as Error);
    return { success: false, successCount: 0, failCount: parsed.data.length };
  }
}

export async function bulkDeleteCoupons(couponIds: string[]): Promise<BulkActionResult> {
  const parsed = bulkIdsSchema.safeParse(couponIds);
  if (!parsed.success) {
    return { success: false, successCount: 0, failCount: couponIds.length };
  }

  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Auth failed for bulkDeleteCoupons', { error: error.message });
    }
    return { success: false, successCount: 0, failCount: parsed.data.length };
  }

  try {
    const db = await getAdminDb();
    const batch = db.batch();

    for (const couponId of parsed.data) {
      const ref = db.collection('coupons').doc(couponId);
      batch.delete(ref);
    }

    await batch.commit();
    revalidatePath('/admin/coupons');
    logger.info('Bulk delete coupons completed', { count: parsed.data.length });

    return { success: true, successCount: parsed.data.length, failCount: 0 };
  } catch (error) {
    logger.error('Error in bulk delete coupons', error as Error);
    return { success: false, successCount: 0, failCount: parsed.data.length };
  }
}
