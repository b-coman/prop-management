/**
 * campaignMessaging — render owner-written copy into per-guest messages and queue
 * them through the Execution Gateway (manual_queue → outbox).
 *
 * v1 has no LLM drafter: the owner writes 2–3 short variants per language, with
 * {name} / {property} / {link} placeholders. The renderer fills each guest's real
 * tokens, ROTATES variants within a language (byte-variation for WhatsApp
 * ban-safety), and appends the STOP opt-out line. Every message then goes through
 * `executeSend` so the guardrails (consent, suppression, dedup, future-booking,
 * frequency-cap) run before anything reaches the outbox.
 *
 * Plain server module (NOT 'use server') — exports types + async functions.
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { Guest, LanguageCode } from '@/types';
import { getGuestById } from '@/services/guestService';
import { resolveGuestLanguage } from '@/lib/growth/language';
import { normalizePhone } from '@/lib/sanitize';
import { executeSend, getPropertyContext } from '@/services/executionGateway';

const logger = loggers.campaign;

// A stable template name so a re-queue of the same campaign+guest dedups.
export const MANUAL_QUEUE_TEMPLATE = 'manual';

export interface MessageVariant {
  language: LanguageCode;
  body: string; // may contain {name} / {property} / {link}
}

export interface RenderedMessage {
  guestId: string;
  name: string;
  phone: string; // E.164
  language: LanguageCode;
  body: string; // fully rendered, incl. opt-out line
  variantIndex: number;
}

export type SkipReason = 'guest-not-found' | 'no-phone' | 'no-variant-for-language';
export interface SkippedRender {
  guestId: string;
  name?: string;
  reason: SkipReason;
}

/** Opt-out line appended to every message. STOP is what /api/whatsapp/inbound honors. */
const OPT_OUT: Record<LanguageCode, string> = {
  ro: 'Răspundeți STOP dacă nu mai doriți mesaje.',
  en: 'Reply STOP to opt out.',
};

/** Fill {name} / {property} / {link}. Unknown placeholders are left untouched. */
export function fillTemplate(body: string, tokens: { name: string; property: string; link: string }): string {
  return body
    .replace(/\{name\}/g, tokens.name)
    .replace(/\{property\}/g, tokens.property)
    .replace(/\{link\}/g, tokens.link);
}

interface RenderInput {
  propertyId: string;
  guestIds: string[];
  variants: MessageVariant[];
}

/**
 * Render (no writes) — produces the per-guest messages for Gate 1 preview and,
 * deterministically, the same bodies the queue step will send. Skips (with a
 * reason) any guest missing a phone or a variant for their language.
 */
export async function renderMessages(input: RenderInput): Promise<{ rendered: RenderedMessage[]; skipped: SkippedRender[] }> {
  const db = await getAdminDb();
  const ctx = await getPropertyContext(db, input.propertyId);
  const propertyName = ctx.name;
  const link = ctx.link ?? '';

  const variantsByLang: Record<string, MessageVariant[]> = {};
  for (const v of input.variants) {
    if (!v.body?.trim()) continue;
    (variantsByLang[v.language] ??= []).push(v);
  }

  const rendered: RenderedMessage[] = [];
  const skipped: SkippedRender[] = [];

  // Resolve each guest first, then group by language so variant rotation is
  // stable and evenly distributed within a language.
  const resolved: Array<{ guest: Guest; lang: LanguageCode; phone: string | null }> = [];
  for (const id of input.guestIds) {
    const g = await getGuestById(id);
    if (!g) {
      skipped.push({ guestId: id, reason: 'guest-not-found' });
      continue;
    }
    const phone = g.normalizedPhone || (g.phone ? normalizePhone(g.phone) : null);
    resolved.push({ guest: g, lang: resolveGuestLanguage(g), phone });
  }

  const byLang: Record<string, typeof resolved> = {};
  for (const r of resolved) (byLang[r.lang] ??= []).push(r);

  for (const [lang, list] of Object.entries(byLang)) {
    list.sort((a, b) => a.guest.id.localeCompare(b.guest.id)); // deterministic rotation order
    const variants = variantsByLang[lang] ?? [];
    list.forEach((r, i) => {
      const name = (r.guest.firstName || '').trim();
      if (!r.phone) {
        skipped.push({ guestId: r.guest.id, name, reason: 'no-phone' });
        return;
      }
      if (variants.length === 0) {
        skipped.push({ guestId: r.guest.id, name, reason: 'no-variant-for-language' });
        return;
      }
      const variantIndex = i % variants.length;
      const filled = fillTemplate(variants[variantIndex].body, { name, property: propertyName, link });
      const body = `${filled.trim()}\n\n${OPT_OUT[lang as LanguageCode] ?? OPT_OUT.en}`;
      rendered.push({ guestId: r.guest.id, name, phone: r.phone, language: lang as LanguageCode, body, variantIndex });
    });
  }

  return { rendered, skipped };
}

export interface QueueResult {
  queued: number;
  results: Array<{ guestId: string; status: string; reason?: string }>;
  skipped: SkippedRender[];
}

/**
 * Render + queue: every rendered message goes through `executeSend` with
 * `deliveryMode: 'manual_queue'`, so all guardrails run and (in live mode) an
 * outbox row is written. Returns the per-guest outcome.
 */
export async function queueMessages(input: RenderInput & { campaignId: string }): Promise<QueueResult> {
  const { rendered, skipped } = await renderMessages(input);
  const results: QueueResult['results'] = [];
  let queued = 0;

  for (const m of rendered) {
    const res = await executeSend({
      guestId: m.guestId,
      propertyId: input.propertyId,
      channel: 'whatsapp',
      templateName: MANUAL_QUEUE_TEMPLATE,
      campaignId: input.campaignId,
      deliveryMode: 'manual_queue',
      body: m.body,
    });
    if (res.status === 'queued') queued++;
    results.push({ guestId: m.guestId, status: res.status, reason: res.reason });
  }

  logger.info('queueMessages complete', {
    campaignId: input.campaignId,
    propertyId: input.propertyId,
    rendered: rendered.length,
    queued,
    skipped: skipped.length,
  });
  return { queued, results, skipped };
}
