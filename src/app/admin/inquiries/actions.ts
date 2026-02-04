// src/app/admin/inquiries/actions.ts
"use server";

import { z } from "zod";
import { updateInquiryStatus as updateStatusService, addResponseToInquiry as addResponseService } from "@/services/inquiryService";
import type { Inquiry } from "@/types";
import { loggers } from '@/lib/logger';

const logger = loggers.admin;

// Schema for updating inquiry status
const updateInquiryStatusSchema = z.object({
  inquiryId: z.string().min(1, "Inquiry ID is required."),
  status: z.enum(["new", "responded", "converted", "closed"]),
});

// Schema for adding a response
const addResponseSchema = z.object({
    inquiryId: z.string().min(1, "Inquiry ID is required."),
    message: z.string().min(1, "Response message cannot be empty.").max(2000, "Response message too long."), // Limit message length
});

/**
 * Server action to update the status of an inquiry.
 */
export async function updateInquiryStatusAction(
  values: z.infer<typeof updateInquiryStatusSchema>
): Promise<{ success: boolean; error?: string }> {
  const validatedFields = updateInquiryStatusSchema.safeParse(values);

  if (!validatedFields.success) {
    return { success: false, error: "Invalid input." };
  }

  const { inquiryId, status } = validatedFields.data;

  try {
    await updateStatusService(inquiryId, status);
    return { success: true };
  } catch (error) {
    logger.error('Error updating inquiry status', error as Error, { inquiryId, status });
    return { success: false, error: "Failed to update inquiry status." };
  }
}

/**
 * Server action for an admin/host to add a response to an inquiry.
 */
export async function addResponseToInquiryAction(
  values: z.infer<typeof addResponseSchema>
): Promise<{ success: boolean; error?: string }> {
    const validatedFields = addResponseSchema.safeParse(values);

    if (!validatedFields.success) {
        return { success: false, error: "Invalid input." };
    }

    const { inquiryId, message } = validatedFields.data;

    try {
        // Assume responses added through this action are always from the host
        await addResponseService(inquiryId, message, true);
        return { success: true };
    } catch (error) {
        logger.error('Error adding response to inquiry', error as Error, { inquiryId });
        return { success: false, error: "Failed to add response." };
    }
}

// Potentially add an action for "Convert to Booking" later
