'use server';

import { loggers } from '@/lib/logger';

const logger = loggers.whatsapp;

let twilioClient: any = null;

function getTwilioClient() {
  if (twilioClient) return twilioClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const twilio = require('twilio');
  twilioClient = twilio(accountSid, authToken);
  return twilioClient;
}

export async function sendWhatsAppMessage(
  to: string,
  body: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!whatsappNumber) {
    logger.warn('WhatsApp not configured: TWILIO_WHATSAPP_NUMBER missing');
    return { success: false, error: 'WhatsApp not configured' };
  }

  const client = getTwilioClient();
  if (!client) {
    logger.warn('WhatsApp not configured: TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN missing');
    return { success: false, error: 'WhatsApp not configured' };
  }

  try {
    logger.info('Sending WhatsApp message', { to: to.slice(0, 6) + '***' });

    const message = await client.messages.create({
      from: `whatsapp:${whatsappNumber}`,
      to: `whatsapp:${to}`,
      body,
    });

    logger.info('WhatsApp message sent', { sid: message.sid });
    return { success: true, sid: message.sid };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to send WhatsApp message', error as Error, { to: to.slice(0, 6) + '***' });
    return { success: false, error: errorMessage };
  }
}
