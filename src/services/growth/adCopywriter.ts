/**
 * adCopywriter (in-app) — turns an approved ad BRIEF (`AdBrief`) + the property's real gallery into
 * the actual Meta ad CREATIVE: 1–5 grounded copy variants (primary text + headline + CTA) and a
 * photo selection. The creative twin of `copywriter.ts`: same shape (forced tool call → validate →
 * one bounded repair), but it writes PUBLIC brand copy for strangers in the target market, not a
 * personal message to a known guest.
 *
 * Truth is anchored by CODE, not trust: `validateAdCreative` enforces that every chosen photo is a
 * REAL, owned gallery asset (you cannot show an amenity the property lacks), copy fits Meta's limits,
 * and nothing is duplicated (Meta rejects duplicate asset_feed_spec values). The LLM owns the voice,
 * the angle, and which real photos best carry it. The output threads straight into
 * `composeAndCreateAd` (step 4b): `copy` → `CopyVariant[]`, `assetPaths` → `assetRefs`.
 *
 * Server-only. Degrades (throws a clear error) if ANTHROPIC_API_KEY is absent.
 */
import { getAnthropicClient, COPYWRITER_MODEL } from '@/lib/growth/anthropic';
import { validateAdCreative, type AdCreativePackForValidation } from '@/lib/growth/validateAdCreative';
import type { AdBrief, AdFraming } from '@/lib/growth/contracts';
import type { CopyVariant, AiImageDescription, BrandVoice } from '@/types';
import { loggers } from '@/lib/logger';

const logger = loggers.ads;

/** One gallery asset offered to the copywriter (from `adPlannerPack.assets`). */
export interface AdCreativeAsset {
  storagePath: string;
  alt: string;
  tags: string[];
  /** Rich vision description (season/mood/features/fitsAngles) — the primary signal for picking a photo that fits. */
  aiDescription?: AiImageDescription;
}

const AD_CREATIVE_TOOL = {
  name: 'emit_ad_creative',
  description: 'Emit the ad creative: the copy variants and the chosen photos.',
  input_schema: {
    type: 'object' as const,
    properties: {
      copy: {
        type: 'array',
        description: '1-5 DISTINCT copy variants (Meta A/B-tests them). Each: primary text, an optional short headline, and a CTA.',
        items: {
          type: 'object',
          properties: {
            primary: { type: 'string', description: 'the main ad text (Romanian). Lead with the hook; keep under ~150 chars where you can to avoid a "See more" cut-off.' },
            headline: { type: 'string', description: 'a short headline, ideally ≤27 chars (Romanian).' },
            cta: { type: 'string', enum: ['learn_more', 'book_now', 'contact_us'], description: "call-to-action; 'learn_more' is the safe default." },
          },
          required: ['primary', 'cta'],
        },
      },
      assetPaths: {
        type: 'array',
        description: 'the chosen photos, by EXACT storagePath from the pack\'s assets — 1-6 that carry the brief\'s themes (favor variety: exterior / interior / lifestyle). Never invent a path.',
        items: { type: 'string' },
      },
      assetGaps: {
        type: 'array',
        description: 'ONLY when a theme the brief genuinely needs has NO fitting real photo in the assets. Do NOT skip real photos to force a gap. Each: what is missing, the nearest real asset (exact storagePath), why it falls short, and the transform that would fix it.',
        items: {
          type: 'object',
          properties: {
            need: { type: 'string', description: 'the missing shot, e.g. "a family at the fire pit at winter dusk"' },
            nearestAssetPath: { type: 'string', description: 'the nearest REAL offered storagePath — the base photo to edit' },
            whyInsufficient: { type: 'string', description: 'why that nearest photo does not fully work' },
            transform: { type: 'string', enum: ['relight', 'populate_people', 'seasonal'], description: 'the edit that would fix it' },
          },
          required: ['need', 'nearestAssetPath', 'whyInsufficient', 'transform'],
        },
      },
      notes: { type: 'string', description: 'brief note on the creative choices (optional).' },
    },
    required: ['copy', 'assetPaths'],
  },
};

const SYSTEM = `You are the ad creative writer for a small Romanian mountain-chalet rental. You turn an
approved ad BRIEF into the actual Meta ad: the copy and the photo selection. The audience is
STRANGERS in Romanian feeder cities (not past guests) — write PUBLIC brand copy, warm but not
personal, in ROMANIAN (the target market).

THE RULES
1. FOLLOW THE BRIEF, SERVE THE GOAL + AUDIENCE. Write to the brief's angle, tone, and occasion
   (brief.creativeBrief), and to the pack's goal (the outcome) + audience (who) — every copy variant
   AND every photo you pick must serve THIS audience for THIS goal and period. A couples/off-peak ad
   and a families/school-break ad read and look different. Lead with a scroll-stopping hook, then the
   point of the trip. 1-3 short sentences per variant.
2. GROUND IN REALITY, PICK PHOTOS THAT TRULY FIT. Choose photos ONLY from the provided assets, by
   their EXACT storagePath — you cannot show something the property does not have (no invented pools,
   spas, or activities). Each asset carries a rich aiDescription (season, mood, people, features,
   fitsAngles) from a vision model that actually LOOKED at it — USE IT to pick photos that fit the
   goal, the season/period, and the audience: a summer photo for an autumn ad is wrong; a
   kids/playground photo for a couples ad is wrong. Match the aiDescription fitsAngles + season to the
   brief; fall back to alt/tags only for an asset with no aiDescription.
3. META SHAPE. 1-5 primary-text variants, each DISTINCT (Meta rejects duplicates). Headlines short
   (≤27 chars ideal); if you reuse a headline, use the SAME one across all variants (never two
   different-but-duplicate). Pick 1-6 photos with variety (exterior / interior / lifestyle) so
   Dynamic Creative has range. CTA: 'learn_more' unless 'book_now' clearly fits.
4. DIRECT BOOKING. The destination is the property's own site — a light nudge to book direct is good,
   but the ad's job is to earn the click, not to close.
5. DECLARE MISSING SHOTS (only real gaps). If a theme the brief genuinely needs has NO fitting real
   photo, STILL pick the best real photos for assetPaths, AND add an assetGaps entry: what is missing,
   the nearest real photo (its storagePath), why it falls short, and the transform (relight/seasonal/
   populate_people). Never skip real photos to force a gap, and never invent a scene — the gap always
   points at a real photo to edit.

6. WRITE IN THE OWNER'S VOICE. When voice is present it OUTRANKS your own instincts about what good
   marketing copy sounds like. Read voice.good as the target — those are lines the owner actually
   wrote or approved, and matching their rhythm matters more than any rule of thumb. Read voice.avoid
   as corrections already made once; do not reintroduce them. Concrete beats clever: if a principle
   and a flourish conflict, keep the principle.

Return the creative by calling emit_ad_creative. Nothing else.`;

export interface RawAssetGap {
  need: string;
  nearestAssetPath: string;
  whyInsufficient: string;
  transform: 'relight' | 'populate_people' | 'seasonal';
}

export interface GenerateAdCreativeResult {
  ok: boolean;
  creative: { copy: CopyVariant[]; assetPaths: string[]; notes?: string; assetGaps?: RawAssetGap[] } | null;
  errors: string[];
  warnings: string[];
  attempts: number;
}

interface EmitAdCreativeInput {
  copy: CopyVariant[];
  assetPaths: string[];
  notes?: string;
  assetGaps?: RawAssetGap[];
}

/**
 * Generate the ad creative for an approved (acting) brief. Runs the LLM, validates, and on failure
 * feeds the validator errors back for ONE bounded repair before returning — never ships copy that
 * fails Meta's shape or a photo that isn't a real owned asset.
 */
export async function generateAdCreative(
  brief: AdBrief,
  assets: AdCreativeAsset[],
  opts?: { maxRepairs?: number; framing?: AdFraming; voice?: BrandVoice | null }
): Promise<GenerateAdCreativeResult> {
  if (!brief.act) return { ok: false, creative: null, errors: ['brief is act:false — there is no creative to write for a declined plan'], warnings: [], attempts: 0 };
  if (!assets.length) return { ok: false, creative: null, errors: ['no gallery assets available to build a creative'], warnings: [], attempts: 0 };

  const client = getAnthropicClient();
  if (!client) throw new Error('ANTHROPIC_API_KEY not configured — the in-app ad copywriter is unavailable');

  const validationPack: AdCreativePackForValidation = { propertyId: brief.propertyId, assetPaths: assets.map((a) => a.storagePath) };
  const maxRepairs = opts?.maxRepairs ?? 1;

  const creativePack = {
    voice: opts?.voice ?? null,
    goal: opts?.framing?.goal ?? null,
    audience: opts?.framing?.audience ?? null,
    occasion: brief.opportunity.occasion,
    window: brief.opportunity.window,
    creativeBrief: brief.creativeBrief,
    objective: brief.objective,
    cities: brief.targeting.cities.map((c) => c.name),
    assets: assets.map((a) => ({ storagePath: a.storagePath, alt: a.alt, tags: a.tags, aiDescription: a.aiDescription })),
  };
  const messages: Array<{ role: 'user' | 'assistant'; content: unknown }> = [
    { role: 'user', content: `Here is the ad brief + the available gallery assets. Write the creative and call emit_ad_creative.\n\n${JSON.stringify(creativePack)}` },
  ];

  let creative: GenerateAdCreativeResult['creative'] = null;
  let lastValidation = { ok: false, errors: [] as string[], warnings: [] as string[] };

  for (let attempt = 1; attempt <= maxRepairs + 1; attempt++) {
    const resp = await client.messages.create({
      model: COPYWRITER_MODEL, // Opus 4.8 (no `thinking`: incompatible with forced tool_choice)
      max_tokens: 2048,
      system: SYSTEM,
      tools: [AD_CREATIVE_TOOL],
      tool_choice: { type: 'tool', name: 'emit_ad_creative' },
      messages: messages as never,
    });
    const toolUse = resp.content.find((b: { type: string }) => b.type === 'tool_use') as { id?: string; input?: EmitAdCreativeInput } | undefined;
    const input = toolUse?.input;
    const toolUseId = toolUse?.id;

    creative = input ? { copy: input.copy ?? [], assetPaths: input.assetPaths ?? [], notes: input.notes, assetGaps: input.assetGaps ?? [] } : null;

    const v = creative
      ? validateAdCreative(validationPack, { copy: creative.copy, assetPaths: creative.assetPaths, assetGaps: creative.assetGaps })
      : { ok: false, errors: ['the model returned no creative'], warnings: [] };
    lastValidation = { ok: v.ok, errors: v.errors, warnings: v.warnings };
    logger.info('adCopywriter generateAdCreative attempt', { attempt, variants: creative?.copy.length, photos: creative?.assetPaths.length, ok: v.ok, errors: v.errors.length });

    if (v.ok) return { ok: true, creative, errors: [], warnings: v.warnings, attempts: attempt };
    if (attempt > maxRepairs) break;

    const repairText =
      `The creative failed validation. Fix EXACTLY these and re-emit via emit_ad_creative:\n- ${lastValidation.errors.join('\n- ')}\n\n` +
      `Reminder: photos only by exact storagePath from the assets; 1-5 DISTINCT copy variants; no duplicate headlines (or share one); valid CTA.`;
    messages.push({ role: 'assistant', content: resp.content });
    messages.push({ role: 'user', content: toolUseId ? [{ type: 'tool_result', tool_use_id: toolUseId, content: repairText }] : repairText });
  }

  return { ok: false, creative, errors: lastValidation.errors, warnings: lastValidation.warnings, attempts: maxRepairs + 1 };
}
