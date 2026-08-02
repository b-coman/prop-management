/**
 * pagePostWriter (in-app) — drafts an ORGANIC Facebook page post to keep the brand page alive
 * (promotion-system-architecture.md §4.3). The page-arm twin of the ad copywriter, but simpler: an
 * organic post is ONE warm caption + ONE real photo, not a paid ad. It is grounded in the property's
 * real gallery + the public brand voice, and shaped to the same goal/audience framing.
 *
 * DELIVERY PHILOSOPHY (mirrors WhatsApp): the server DRAFTS, it does not publish. v1 is manual — the
 * operator reviews the draft and posts it by hand (copy the caption, download the photo), exactly
 * like the wa.me one-tap send. API auto-publish is the later upgrade and needs the owner's one-time
 * token-scope grant (pages_manage_posts + a CREATE_CONTENT page task, infra doc §11.2) plus a
 * contract spike — NOT built blind here.
 *
 * Truth is anchored in CODE (validatePagePost): the chosen photo must be a REAL owned gallery asset.
 * Server-only. Degrades (throws) if ANTHROPIC_API_KEY is absent.
 */
import { getAnthropicClient, COPYWRITER_MODEL } from '@/lib/growth/anthropic';
import type { AdFraming } from '@/lib/growth/contracts';
import type { AdCreativeAsset } from './adCopywriter';
import { loggers } from '@/lib/logger';

const logger = loggers.ads;

const MESSAGE_MIN = 20;
const MESSAGE_MAX = 2000;

export interface PagePost {
  message: string;
  assetPath: string;
  notes?: string;
}

export interface PagePostValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Pure validator: the post must have a sane-length message and ONE photo that is a real owned asset. */
export function validatePagePost(
  post: { message: string; assetPath: string },
  pack: { propertyId: string; assetPaths: string[] }
): PagePostValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const msg = (post.message ?? '').trim();
  if (msg.length < MESSAGE_MIN) errors.push(`message too short (${msg.length} < ${MESSAGE_MIN})`);
  else if (msg.length > MESSAGE_MAX) errors.push(`message too long (${msg.length} > ${MESSAGE_MAX})`);
  else if (msg.length > 500) warnings.push(`message ${msg.length} chars — long for a page post; shorter usually performs better`);

  if (!post.assetPath) errors.push('no photo chosen');
  else if (!pack.assetPaths.includes(post.assetPath)) errors.push(`photo not in the available gallery assets: ${post.assetPath}`);
  else if (!post.assetPath.startsWith(`properties/${pack.propertyId}/`)) errors.push(`photo not owned by ${pack.propertyId}`);

  return { ok: errors.length === 0, errors, warnings };
}

const PAGE_POST_TOOL = {
  name: 'emit_page_post',
  description: 'Emit one organic Facebook page post: the caption and the chosen photo.',
  input_schema: {
    type: 'object' as const,
    properties: {
      message: { type: 'string', description: 'the post caption in ROMANIAN — warm, organic, community feel (NOT a hard-sell ad). Short, a few sentences; a light question or invite is good for engagement.' },
      assetPath: { type: 'string', description: 'ONE photo by EXACT storagePath from the assets — the one that best carries the post. Never invent a path.' },
      notes: { type: 'string', description: 'brief note on the choice (optional).' },
    },
    required: ['message', 'assetPath'],
  },
};

const SYSTEM = `You write ORGANIC Facebook page posts for a small Romanian mountain-chalet rental — to keep
the page alive and warm, NOT to run a paid ad. Audience: the page's followers + locals in Romania.
Write in ROMANIAN, in a warm, genuine, public brand voice — a real host sharing a moment, not a
billboard.

RULES
1. ORGANIC, NOT AN AD. A page post shares something real — a seasonal moment, a small update, a
   view, an invitation to come enjoy the mountains. Warm and human; a light question or "come see"
   invite drives engagement. No aggressive selling, no fake urgency.
2. SHAPE TO THE PROMPT + FRAMING. Follow the prompt (what the post is about) and any goal/audience
   given — a couples/off-peak post and a families/school-break post look different.
3. GROUND IN REALITY. Pick ONE photo, by exact storagePath, from the provided assets — you can only
   show what the property really has. Never claim an amenity/experience not evident in the assets.
4. KEEP IT SHORT. A few sentences. Diacritics are fine (this is public brand copy). One or two
   tasteful emoji are OK if they fit.

Return the post by calling emit_page_post. Nothing else.`;

export interface GeneratePagePostResult {
  ok: boolean;
  post: PagePost | null;
  errors: string[];
  warnings: string[];
  attempts: number;
}

interface EmitPagePostInput {
  message: string;
  assetPath: string;
  notes?: string;
}

/**
 * Draft an organic page post. Runs the LLM, validates (real owned photo + sane message), and on
 * failure feeds the errors back for ONE bounded repair. Produces a DRAFT only — never publishes.
 */
export async function generatePagePost(
  input: { propertyId: string; prompt: string; assets: AdCreativeAsset[]; framing?: AdFraming },
  opts?: { maxRepairs?: number }
): Promise<GeneratePagePostResult> {
  if (!input.assets.length) return { ok: false, post: null, errors: ['no gallery assets available'], warnings: [], attempts: 0 };
  const client = getAnthropicClient();
  if (!client) throw new Error('ANTHROPIC_API_KEY not configured — the in-app page-post writer is unavailable');

  const validationPack = { propertyId: input.propertyId, assetPaths: input.assets.map((a) => a.storagePath) };
  const maxRepairs = opts?.maxRepairs ?? 1;

  const postPack = {
    prompt: input.prompt,
    goal: input.framing?.goal ?? null,
    audience: input.framing?.audience ?? null,
    assets: input.assets.map((a) => ({ storagePath: a.storagePath, alt: a.alt, tags: a.tags })),
  };
  const messages: Array<{ role: 'user' | 'assistant'; content: unknown }> = [
    { role: 'user', content: `Here is the post brief + the available gallery assets. Write ONE organic page post and call emit_page_post.\n\n${JSON.stringify(postPack)}` },
  ];

  let post: PagePost | null = null;
  let lastValidation = { ok: false, errors: [] as string[], warnings: [] as string[] };

  for (let attempt = 1; attempt <= maxRepairs + 1; attempt++) {
    const resp = await client.messages.create({
      model: COPYWRITER_MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      tools: [PAGE_POST_TOOL],
      tool_choice: { type: 'tool', name: 'emit_page_post' },
      messages: messages as never,
    });
    const toolUse = resp.content.find((b: { type: string }) => b.type === 'tool_use') as { id?: string; input?: EmitPagePostInput } | undefined;
    const emitted = toolUse?.input;
    post = emitted ? { message: emitted.message, assetPath: emitted.assetPath, notes: emitted.notes } : null;

    const v = post ? validatePagePost(post, validationPack) : { ok: false, errors: ['the model returned no post'], warnings: [] };
    lastValidation = { ok: v.ok, errors: v.errors, warnings: v.warnings };
    logger.info('pagePostWriter generatePagePost attempt', { attempt, ok: v.ok, errors: v.errors.length });

    if (v.ok) return { ok: true, post, errors: [], warnings: v.warnings, attempts: attempt };
    if (attempt > maxRepairs) break;

    const repairText = `The post failed validation. Fix EXACTLY these and re-emit via emit_page_post:\n- ${lastValidation.errors.join('\n- ')}\n\nReminder: pick ONE photo by exact storagePath from the assets; message ${MESSAGE_MIN}-${MESSAGE_MAX} chars.`;
    messages.push({ role: 'assistant', content: resp.content });
    messages.push({ role: 'user', content: toolUse?.id ? [{ type: 'tool_result', tool_use_id: toolUse.id, content: repairText }] : repairText });
  }

  return { ok: false, post, errors: lastValidation.errors, warnings: lastValidation.warnings, attempts: maxRepairs + 1 };
}
