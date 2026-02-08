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
  program_0: 'HXc4de78581cb3c13f62edeaa4541bda40',
  program_1: 'HXc1376e3107c73dba9a68557fefab7656',
  program_2: 'HXb719041f666c821c28f0b044948e4968',
  program_3: 'HX7fecff44de0d97937121b0ea9f2996cf',
  program_4: 'HX8d5d94a3e644ebb8f174c4c14059561d',
  program_5: 'HX0907e5a890426069545f5528168f1870',
  program_6: 'HX6008e5bed8001a1a4fcf05c277964e20',
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
