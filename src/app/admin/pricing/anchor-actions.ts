'use server';

/**
 * Saving the anchor settings — the few numbers the rate sheet is built from.
 *
 * This writes CONFIGURATION only. It does not touch `seasonalPricing`, `dateOverrides` or
 * `priceCalendars`, so no guest-facing price moves when these are saved, and nothing is sent to any
 * OTA. What changes is the set of numbers the sheet tells you to type.
 *
 * NOTE: a 'use server' file may only export async functions. Types and constants must live elsewhere,
 * or every server action in the module graph fails at runtime with a silent 500.
 */
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { loggers } from '@/lib/logger';
import { requirePropertyAccess, AuthorizationError } from '@/lib/authorization';
import { saveAnchorConfig } from '@/services/anchorConfigService';
import type { AnchorChannelSetting } from '@/lib/pricing/anchorPricing';

const logger = loggers.adminPricing;

const roundingSchema = z.object({
  nearest: z.coerce.number().min(0).max(100),
  mode: z.enum(['nearest', 'up', 'down']),
});

const channelSchema = z.object({
  channelId: z.string().min(1),
  // A factor below 1 would list a channel under the anchor. Allowed — it is the owner's call — but
  // bounded so a stray keystroke cannot publish a wild number to type into a live dashboard.
  factor: z.coerce.number().min(0.1).max(5),
  currency: z.string().min(3).max(3),
  fxDivisor: z.coerce.number().min(0.01).max(1000).optional(),
  rounding: roundingSchema.optional(),
  cleaningFee: z.coerce.number().min(0).max(10000).nullable().optional(),
});

const anchorSchema = z.object({
  propertyId: z.string().min(1),
  anchorChannelId: z.string().min(1),
  weekdayPrice: z.coerce.number().min(1).max(100000),
  weekendPrice: z.coerce.number().min(1).max(100000),
  // 0 is legitimate: it means "the website matches the cheapest channel rather than undercutting it".
  directDiscountPct: z.coerce.number().min(0).max(0.9),
  channels: z.array(channelSchema).min(1),
  directRounding: roundingSchema.optional(),
});

export async function saveAnchorSettings(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  const parsed = anchorSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, error: `${first.path.join('.')}: ${first.message}` };
  }
  const { propertyId, ...config } = parsed.data;

  try {
    await requirePropertyAccess(propertyId);
  } catch (e) {
    if (e instanceof AuthorizationError) return { success: false, error: 'Not authorised for this property.' };
    throw e;
  }

  try {
    await saveAnchorConfig(propertyId, {
      ...config,
      channels: config.channels as AnchorChannelSetting[],
    }, 'admin');
    revalidatePath('/admin/pricing');
    return { success: true };
  } catch (e) {
    logger.error('Failed to save anchor settings', e as Error, { propertyId });
    return { success: false, error: (e as Error).message };
  }
}
