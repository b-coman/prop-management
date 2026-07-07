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
  curatenie_zilnic: 'HXf06e572e696fdd3e432179b8c19ba26a',
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

/**
 * Marketing-category templates (Growth Engine) — SEPARATE from the operational
 * curatenie_ and program_ templates. Content SIDs come from env and are EMPTY
 * until the templates are approved in Twilio/Meta, so the live send path stays
 * inert until finalization. See plans/growth-engine.md section 6.6 / 10.
 */
export const WHATSAPP_MARKETING_TEMPLATES = {
  winter_invite: process.env.WHATSAPP_TPL_WINTER_INVITE || '',
  we_miss_you: process.env.WHATSAPP_TPL_WE_MISS_YOU || '',
  seasonal_availability: process.env.WHATSAPP_TPL_SEASONAL_AVAILABILITY || '',
} as const;

export type WhatsAppMarketingTemplateName = keyof typeof WHATSAPP_MARKETING_TEMPLATES;

/**
 * Resolve a Twilio content SID from either the ops or the marketing registry.
 * Returns undefined for unknown names OR marketing templates whose SID env var
 * isn't set yet (unapproved) — callers treat that as "not deliverable".
 */
export function resolveWhatsAppTemplateSid(name: string): string | undefined {
  const sid =
    (WHATSAPP_TEMPLATES as Record<string, string>)[name] ??
    (WHATSAPP_MARKETING_TEMPLATES as Record<string, string>)[name];
  return sid || undefined;
}

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
  const contentSid = WHATSAPP_TEMPLATES[templateName];
  if (!contentSid) {
    logger.error('Unknown WhatsApp template', new Error(`Template not found: ${templateName}`));
    return { success: false, error: `Unknown template: ${templateName}` };
  }
  return sendWhatsAppTemplateBySid(to, contentSid, variables);
}

/**
 * Send a template by its Twilio content SID directly. Used by the Growth Engine
 * Execution Gateway, which resolves SIDs across both the ops and marketing
 * registries via resolveWhatsAppTemplateSid().
 */
export async function sendWhatsAppTemplateBySid(
  to: string,
  contentSid: string,
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

  if (!contentSid) {
    logger.error('Missing WhatsApp content SID', new Error('Empty content SID'));
    return { success: false, error: 'Missing content SID' };
  }

  try {
    logger.info('Sending WhatsApp template', { to: to.slice(0, 6) + '***', contentSid });

    const message = await client.messages.create({
      from: `whatsapp:${whatsappNumber}`,
      to: `whatsapp:${to}`,
      contentSid,
      contentVariables: JSON.stringify(variables),
    });

    logger.info('WhatsApp template sent', { sid: message.sid, contentSid });
    const messageBody = `[sid:${contentSid}] vars: ${JSON.stringify(variables)}`;
    return { success: true, sid: message.sid, messageBody };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to send WhatsApp template', error as Error, {
      to: to.slice(0, 6) + '***',
      contentSid,
    });
    return { success: false, error: errorMessage };
  }
}
