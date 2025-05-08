// src/app/admin/inquiries/actions.ts
"use server";

import { z } from "zod";
import { updateInquiryStatus as updateStatusService, addResponseToInquiry as addResponseService } from "@/services/inquiryService";
import type { Inquiry } from "@/types";

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
    console.error(`[Action updateInquiryStatusAction] Error updating inquiry ${inquiryId} status:`, error);
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
        console.error(`[Action addResponseToInquiryAction] Error adding response to inquiry ${inquiryId}:`, error);
        return { success: false, error: "Failed to add response." };
    }
}

// Potentially add an action for "Convert to Booking" later
