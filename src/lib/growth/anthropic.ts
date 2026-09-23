/**
 * anthropic — lazy, gracefully-degrading Claude client for the Opportunity Engine's in-app LLM
 * stages (the copywriter today; the planner/analyst later). Server-side ONLY — never import from a
 * client component (the key is a RUNTIME secret).
 *
 * Mirrors the whatsappService pattern: if ANTHROPIC_API_KEY is absent, `getAnthropicClient()`
 * returns null and callers degrade (surface "LLM not configured") instead of throwing at import.
 */
import Anthropic from '@anthropic-ai/sdk';
import { loggers } from '@/lib/logger';

const logger = loggers.campaign;

/** The default model for Opportunity-Engine generation. Opus 4.8 (per the claude-api guidance). */
export const COPYWRITER_MODEL = 'claude-opus-4-8';

/**
 * The WhatsApp copywriter's model. Separate from COPYWRITER_MODEL because the other stages (analyst,
 * ad planner, gallery vision, page posts) use forced tool_choice with thinking off, and moving them
 * is its own change (Opus 5.5 rejects forced tool_choice). The copywriter runs with adaptive thinking
 * and structured output instead. Picked on 2026-09-23 from a side-by-side on campaign B: 5.5 at medium
 * wrote shorter, less templated Romanian than 4.8 and 5, made no date errors, and cost ~20% less.
 */
export const WHATSAPP_COPYWRITER_MODEL = 'claude-opus-5-5';
/** Opus 5.5's own default. In testing, `high` cost more without clearly better copy. */
export const WHATSAPP_COPYWRITER_EFFORT = 'medium' as const;

let client: Anthropic | null = null;
let triedInit = false;

/** Lazily construct the client. Returns null if the key is not configured (degrade, don't crash). */
export function getAnthropicClient(): Anthropic | null {
  if (triedInit) return client;
  triedInit = true;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.warn('ANTHROPIC_API_KEY not set — in-app LLM stages will be unavailable');
    return null;
  }
  client = new Anthropic({ apiKey });
  return client;
}

/** True if the copywriter can run in-app (key present). Used to gate the Gate-0 "Generate" button. */
export function isCopywriterAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
