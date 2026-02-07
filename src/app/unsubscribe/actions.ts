'use server';

import { validateUnsubscribeToken } from '@/lib/unsubscribe-token';
import { setGuestUnsubscribed } from '@/services/guestService';
import { loggers } from '@/lib/logger';

const logger = loggers.guest;

export async function processUnsubscribe(
  email: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  if (!normalizedEmail || !token) {
    return { success: false, error: 'Missing email or token.' };
  }

  if (!validateUnsubscribeToken(normalizedEmail, token)) {
    logger.warn('Invalid unsubscribe token', { email: normalizedEmail });
    return { success: false, error: 'Invalid or expired link.' };
  }

  try {
    await setGuestUnsubscribed(normalizedEmail, true);
    logger.info('Guest unsubscribed successfully', { email: normalizedEmail });
    return { success: true };
  } catch (error) {
    logger.error('Error processing unsubscribe', error as Error, { email: normalizedEmail });
    return { success: false, error: 'An error occurred. Please try again.' };
  }
}
