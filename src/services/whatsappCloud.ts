// src/services/whatsappCloud.ts
// Sends from the property's own WhatsApp number (+40 753 980 097) through Meta's Cloud API.
//
// Only the owner is written to from here (the cleaning watch's alerts). Guest and cleaner messages
// do not go through this file. A message the business starts must be an approved template; a
// free-form text is only accepted within 24h of the recipient's last message (a button tap counts).
//
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages

import 'server-only';
import { loggers } from '@/lib/logger';

const GRAPH = 'https://graph.facebook.com/v21.0';
const logger = loggers.whatsapp;

export interface CloudSendResult {
  ok: boolean;
  wamid?: string;
  error?: string;
}

export interface TemplateButton {
  index: number;
  type: 'quick_reply' | 'url';
  /** The payload a quick reply sends back, or the dynamic suffix of a URL button. */
  param: string;
}

function config(): { token: string; phoneNumberId: string } | null {
  // Several secrets were once written with a trailing newline; trim, never trust.
  const token = process.env.WHATSAPP_CLOUD_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  return token && phoneNumberId ? { token, phoneNumberId } : null;
}

/** The Cloud API takes the number as digits only. */
function recipient(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/** Template parameters may not contain line breaks, tabs or 4+ spaces in a row (error 132018). */
export function templateParam(text: string): string {
  return text.replace(/\s*[\n\r\t]+\s*/g, ' ').replace(/ {4,}/g, '   ').trim();
}

async function send(payload: Record<string, unknown>): Promise<CloudSendResult> {
  const cfg = config();
  if (!cfg) {
    logger.error('WhatsApp Cloud API not configured (WHATSAPP_CLOUD_TOKEN / WHATSAPP_PHONE_NUMBER_ID)');
    return { ok: false, error: 'not configured' };
  }
  try {
    const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = body?.error?.message || `HTTP ${res.status}`;
      logger.error('WhatsApp Cloud send failed', new Error(error), {
        status: res.status,
        code: body?.error?.code,
        details: body?.error?.error_data?.details,
      });
      return { ok: false, error };
    }
    return { ok: true, wamid: body?.messages?.[0]?.id };
  } catch (error) {
    logger.error('WhatsApp Cloud send threw', error as Error);
    return { ok: false, error: (error as Error).message };
  }
}

export function sendCloudTemplate(
  to: string,
  name: string,
  language: string,
  bodyParams: string[],
  buttons: TemplateButton[] = [],
): Promise<CloudSendResult> {
  const components: Record<string, unknown>[] = [
    { type: 'body', parameters: bodyParams.map(text => ({ type: 'text', text: templateParam(text) })) },
    ...buttons.map(b => ({
      type: 'button',
      sub_type: b.type,
      index: String(b.index),
      parameters: [b.type === 'quick_reply' ? { type: 'payload', payload: b.param } : { type: 'text', text: b.param }],
    })),
  ];
  return send({ to: recipient(to), type: 'template', template: { name, language: { code: language }, components } });
}

export function sendCloudText(to: string, body: string): Promise<CloudSendResult> {
  return send({ to: recipient(to), type: 'text', text: { body, preview_url: false } });
}
