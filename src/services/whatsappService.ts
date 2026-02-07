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

// ============================================================================
// Template SID registry
// ============================================================================

export const WHATSAPP_TEMPLATES = {
  curatenie_test: 'HX59f1abe62543a4fa25dca11bc18e776e',
  curatenie_zilnic: 'HXfde05c39892320be10304d1fb4bb9a4e',
  curatenie_modificare: 'HX30b0bf3c0c4d21b7f5f9ade2bcf7b216',
  program_0: 'HX97ece4348d3e1599b601dfbd6c6761d8',
  program_1: 'HX0b392a7a4c2dabcbcd5a7a02c60d4d6d',
  program_2: 'HX56c488f20980ac5ee85f0ec096882eaf',
  program_3: 'HXb5b216e8ab9d062d3aaa15f283677208',
  program_4: 'HX852e73976e24c95ae5c7b1344420ad18',
  program_5: 'HX5a7bab389948656441d562232ee90cf4',
  program_6: 'HX46f98ecaa6a736b2db2ae92a06bf7925',
} as const;

export type WhatsAppTemplateName = keyof typeof WHATSAPP_TEMPLATES;

// ============================================================================
// Send freeform message (for sandbox / fallback)
// ============================================================================

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

// ============================================================================
// Send template message (for production WhatsApp)
// ============================================================================

export async function sendWhatsAppTemplate(
  to: string,
  templateName: WhatsAppTemplateName,
  variables: Record<string, string>
): Promise<{ success: boolean; sid?: string; error?: string; messageBody?: string }> {
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

  const contentSid = WHATSAPP_TEMPLATES[templateName];
  if (!contentSid) {
    logger.error('Unknown WhatsApp template', new Error(`Template not found: ${templateName}`));
    return { success: false, error: `Unknown template: ${templateName}` };
  }

  try {
    logger.info('Sending WhatsApp template', {
      to: to.slice(0, 6) + '***',
      template: templateName,
    });

    const message = await client.messages.create({
      from: `whatsapp:${whatsappNumber}`,
      to: `whatsapp:${to}`,
      contentSid,
      contentVariables: JSON.stringify(variables),
    });

    logger.info('WhatsApp template sent', { sid: message.sid, template: templateName });

    // Build a human-readable version for logging
    const messageBody = `[template:${templateName}] vars: ${JSON.stringify(variables)}`;

    return { success: true, sid: message.sid, messageBody };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to send WhatsApp template', error as Error, {
      to: to.slice(0, 6) + '***',
      template: templateName,
    });
    return { success: false, error: errorMessage };
  }
}
