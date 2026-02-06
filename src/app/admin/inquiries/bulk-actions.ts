"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { loggers } from '@/lib/logger';
import { getInquiryById, updateInquiryStatus } from '@/services/inquiryService';
import {
  requireAdmin,
  requirePropertyAccess,
  AuthorizationError,
} from '@/lib/authorization';

const logger = loggers.admin;

const bulkIdsSchema = z.array(z.string().min(1)).min(1).max(50);

interface BulkActionResult {
  success: boolean;
  successCount: number;
  failCount: number;
}

export async function bulkCloseInquiries(inquiryIds: string[]): Promise<BulkActionResult> {
  const parsed = bulkIdsSchema.safeParse(inquiryIds);
  if (!parsed.success) {
    return { success: false, successCount: 0, failCount: inquiryIds.length };
  }

  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Auth failed for bulkCloseInquiries', { error: error.message });
    }
    return { success: false, successCount: 0, failCount: parsed.data.length };
  }

  let successCount = 0;
  let failCount = 0;

  const results = await Promise.allSettled(
    parsed.data.map(async (inquiryId) => {
      const inquiry = await getInquiryById(inquiryId);
      if (!inquiry) {
        throw new Error('Inquiry not found');
      }

      await requirePropertyAccess(inquiry.propertySlug);

      if (inquiry.status === 'closed') {
        throw new Error('Inquiry already closed');
      }

      await updateInquiryStatus(inquiryId, 'closed');
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      successCount++;
    } else {
      failCount++;
      logger.warn('Bulk close failed for one inquiry', { reason: result.reason?.message });
    }
  }

  revalidatePath('/admin/inquiries');
  logger.info('Bulk close inquiries completed', { successCount, failCount });

  return { success: failCount === 0, successCount, failCount };
}

export async function bulkMarkInquiriesResponded(inquiryIds: string[]): Promise<BulkActionResult> {
  const parsed = bulkIdsSchema.safeParse(inquiryIds);
  if (!parsed.success) {
    return { success: false, successCount: 0, failCount: inquiryIds.length };
  }

  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Auth failed for bulkMarkInquiriesResponded', { error: error.message });
    }
    return { success: false, successCount: 0, failCount: parsed.data.length };
  }

  let successCount = 0;
  let failCount = 0;

  const results = await Promise.allSettled(
    parsed.data.map(async (inquiryId) => {
      const inquiry = await getInquiryById(inquiryId);
      if (!inquiry) {
        throw new Error('Inquiry not found');
      }

      await requirePropertyAccess(inquiry.propertySlug);

      // Skip already responded, closed, or converted
      if (inquiry.status === 'responded' || inquiry.status === 'closed' || inquiry.status === 'converted') {
        throw new Error(`Inquiry has status: ${inquiry.status}`);
      }

      await updateInquiryStatus(inquiryId, 'responded');
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      successCount++;
    } else {
      failCount++;
      logger.warn('Bulk mark responded failed for one inquiry', { reason: result.reason?.message });
    }
  }

  revalidatePath('/admin/inquiries');
  logger.info('Bulk mark inquiries responded completed', { successCount, failCount });

  return { success: failCount === 0, successCount, failCount };
}
