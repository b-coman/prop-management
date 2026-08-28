/**
 * pagePostWriter (in-app) — drafts an ORGANIC Facebook page post to keep the brand page alive
 * (promotion-system-architecture.md §4.3). The page-arm twin of the ad copywriter, but simpler: an
 * organic post is a warm caption + real photos, not a paid ad. It is grounded in the property's real
 * gallery + the public brand voice, and shaped to the same goal/audience framing.
 *
 * ALBUMS, NOT ONE PHOTO — and that is the page's own verdict, not a preference. Its six-year record,
 * read on 28 Aug 2026: every one of the five best posts is a multi-photo album (20 · 16 · 9 · 7 · 7
 * reactions) and every single-photo post sits at four or below. The old contract could only emit the
 * weaker format.
 *
 * POST TYPE carries the strategy's 60/25/15 mix into the data. Without it the ratio lives only in
 * someone's head, and a page that has posted 17 times in six years does not need another thing to
 * remember.
 *
 * NO OTA LINKS, enforced not advised. The one post in the page's history carrying an airbnb.com link
 * is also the only caption-bearing post with ZERO reactions — and it routed the page's own followers
 * to a channel charging 18.755%. That is a validation error here, not a matter of discipline.
 *
 * Truth is anchored in CODE (validatePagePost): every chosen photo must be a REAL owned gallery asset.
 * Publishing lives in `pagePublisher.ts`; this module only drafts.
 * Server-only. Degrades (throws) if ANTHROPIC_API_KEY is absent.
 */
import { getAnthropicClient, COPYWRITER_MODEL } from '@/lib/growth/anthropic';
import type { AdFraming } from '@/lib/growth/contracts';
import type { AdCreativeAsset } from './adCopywriter';
import { loggers } from '@/lib/logger';

const logger = loggers.ads;

const MESSAGE_MIN = 20;
const MESSAGE_MAX = 2000;
/** Albums win, but past ~5 the extra photos stop being looked at and start being scrolled. */
const PHOTOS_MIN = 1;
const PHOTOS_MAX = 5;
/** Below this an "album" is really a single photo wearing a costume — warn, don't block. */
const ALBUM_MIN = 3;

/**
 * The 60/25/15 mix. `place` earns reach, `proof` earns replies, `offer` converts — and only `offer`
 * may carry a booking link, which is what stops the page drifting back into being a shop window.
 */
export const POST_TYPES = ['place', 'proof', 'offer'] as const;
export type PagePostType = (typeof POST_TYPES)[number];

/** Channels that charge us commission. A page post must never hand its own followers to one. */
const OTA_LINK = /\b(airbnb|booking\.com|vrbo|expedia|trip\.com|hotels\.com|travelminit)\b/i;

export interface PagePost {
  message: string;
  /** 1-5 gallery storagePaths. Multi-photo is the point; see the header. */
  assetPaths: string[];
  postType: PagePostType;
  notes?: string;
}

export interface PagePostValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Pure validator: sane message, real owned photos, a known type, and never an OTA link. */
export function validatePagePost(
  post: { message: string; assetPaths: string[]; postType?: string },
  pack: { propertyId: string; assetPaths: string[]; tagsByPath?: Record<string, string[]> }
): PagePostValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const msg = (post.message ?? '').trim();
  if (msg.length < MESSAGE_MIN) errors.push(`message too short (${msg.length} < ${MESSAGE_MIN})`);
  else if (msg.length > MESSAGE_MAX) errors.push(`message too long (${msg.length} > ${MESSAGE_MAX})`);
  else if (msg.length > 500) warnings.push(`message ${msg.length} chars — long for a page post; shorter usually performs better`);

  // The page's own history is the argument: its single OTA-link post scored zero and sent followers
  // to an 18.755% channel. Blocked, so it cannot happen on a busy day.
  const ota = msg.match(OTA_LINK);
  if (ota) errors.push(`caption links to an OTA (${ota[0]}) — page posts point at the direct site or nowhere`);

  const paths = post.assetPaths ?? [];
  if (!paths.length) errors.push('no photos chosen');
  else if (paths.length > PHOTOS_MAX) errors.push(`too many photos (${paths.length} > ${PHOTOS_MAX})`);
  else {
    const seen = new Set<string>();
    for (const path of paths) {
      if (seen.has(path)) { errors.push(`the same photo twice: ${path}`); continue; }
      seen.add(path);
      if (!pack.assetPaths.includes(path)) errors.push(`photo not in the available gallery assets: ${path}`);
      else if (!path.startsWith(`properties/${pack.propertyId}/`)) errors.push(`photo not owned by ${pack.propertyId}`);
    }
    if (paths.length >= PHOTOS_MIN && paths.length < ALBUM_MIN) {
      warnings.push(`${paths.length} photo(s) — this page's albums out-perform single photos about 3:1, so ${ALBUM_MIN}-${PHOTOS_MAX} is usually better`);
    }

    // AN ALBUM OF NEAR-DUPLICATES IS NOT AN ALBUM.
    // First real draft, 28 Aug 2026: five photos, four of them the chalet exterior from slightly
    // different angles. Not the model's fault — only 7 of 59 gallery photos are tagged `autumn` and
    // 5 of those 7 are `exterior`, so an autumn brief has almost nothing else to choose. But the
    // result still reads as one photo posted five times, which wastes the format that this page's
    // record says is its strongest. A warning, never an error: with a thin seasonal set a hard block
    // could be impossible to satisfy, and a mediocre album still beats no post.
    if (pack.tagsByPath && paths.length >= ALBUM_MIN) {
      const counts = new Map<string, number>();
      for (const path of paths) {
        for (const tag of pack.tagsByPath[path] ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
      for (const [tag, n] of counts) {
        if (n > Math.ceil(paths.length * 0.6)) {
          warnings.push(`${n} of ${paths.length} photos are "${tag}" — the album repeats one subject; vary it even if that means a photo slightly off-season`);
          break;
        }
      }
    }
  }

  if (!post.postType) errors.push('no postType chosen');
  else if (!(POST_TYPES as readonly string[]).includes(post.postType)) errors.push(`unknown postType: ${post.postType}`);

  return { ok: errors.length === 0, errors, warnings };
}

const PAGE_POST_TOOL = {
  name: 'emit_page_post',
  description: 'Emit one organic Facebook page post: the caption and the chosen photo.',
  input_schema: {
    type: 'object' as const,
    properties: {
      message: { type: 'string', description: 'the post caption in ROMANIAN — warm, organic, community feel (NOT a hard-sell ad). Short, a few sentences. END WITH A REAL QUESTION unless postType is "offer": this page has earned exactly one comment in six years, and it came from the one caption that spoke to a person instead of describing a property.' },
      assetPaths: { type: 'array', items: { type: 'string' }, description: '3 to 5 photos by EXACT storagePath from the assets, as an ALBUM that tells one small story in order. This page\'s albums out-perform its single photos about 3:1. Never invent a path, never repeat one.' },
      postType: { type: 'string', enum: ['place', 'proof', 'offer'], description: 'place = the chalet/season with no offer and no link (earns reach). proof = guests, a review, the place in use, ending in a question (earns replies). offer = specific dates and a real price (converts). Follow the type asked for in the brief.' },
      notes: { type: 'string', description: 'brief note on the choices (optional).' },
    },
    required: ['message', 'assetPaths', 'postType'],
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
3. GROUND IN REALITY, BUILD AN ALBUM. Pick 3-5 photos, by exact storagePath, from the provided assets
   — you can only show what the property really has. Order them so they tell one small story: the
   wide shot that sets the scene, then the details that reward a second look. Each asset has a rich
   aiDescription (season, mood, people, features, fitsAngles) from a vision model — use it so the
   photos genuinely fit the prompt and the audience. Never claim an amenity not evident in the
   assets, and never repeat a photo.
3b. VARY THE SUBJECT — this matters more than matching the season. Do NOT pick four exteriors from
   slightly different angles; that reads as one photo posted four times and wastes the album. Aim for
   at most two photos sharing the same primary subject (exterior / interior / garden / fire / view),
   and reach for an interior or a close detail even if it was shot in another season. A varied album
   in mixed light beats five near-identical wide shots that all match the month.
4. KEEP IT SHORT, AND ASK SOMETHING. A few sentences. For 'place' and 'proof', end on a real question
   someone could answer — not "who else loves autumn?" but something specific to what is in the
   photos. Diacritics are fine (this is public brand copy). One or two tasteful emoji are OK.
5. NEVER LINK TO AN OTA. Not Airbnb, not Booking.com, not VRBO. The only booking link a page post may
   carry is the property's own site, and only when postType is 'offer'. This is enforced in code.
6. MATCH THE TYPE. 'place' shares a moment and sells nothing. 'proof' shows the place being used and
   invites a reply. 'offer' names real dates and a real price — the one type allowed to ask for the
   booking.

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
  assetPaths: string[];
  postType: PagePostType;
  notes?: string;
}

/**
 * Draft an organic page post. Runs the LLM, validates (real owned photo + sane message), and on
 * failure feeds the errors back for ONE bounded repair. Produces a DRAFT only — never publishes.
 */
export async function generatePagePost(
  input: { propertyId: string; prompt: string; assets: AdCreativeAsset[]; framing?: AdFraming; postType?: PagePostType },
  opts?: { maxRepairs?: number }
): Promise<GeneratePagePostResult> {
  if (!input.assets.length) return { ok: false, post: null, errors: ['no gallery assets available'], warnings: [], attempts: 0 };
  const client = getAnthropicClient();
  if (!client) throw new Error('ANTHROPIC_API_KEY not configured — the in-app page-post writer is unavailable');

  const validationPack = {
    propertyId: input.propertyId,
    assetPaths: input.assets.map((a) => a.storagePath),
    // Tags feed the variety check — without them an album of five near-identical exteriors passes.
    tagsByPath: Object.fromEntries(input.assets.map((a) => [a.storagePath, a.tags ?? []])),
  };
  const maxRepairs = opts?.maxRepairs ?? 1;

  const postPack = {
    prompt: input.prompt,
    postType: input.postType ?? 'place',
    goal: input.framing?.goal ?? null,
    audience: input.framing?.audience ?? null,
    assets: input.assets.map((a) => ({ storagePath: a.storagePath, alt: a.alt, tags: a.tags, aiDescription: a.aiDescription })),
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
    post = emitted
      ? { message: emitted.message, assetPaths: emitted.assetPaths ?? [], postType: emitted.postType, notes: emitted.notes }
      : null;

    const v = post ? validatePagePost(post, validationPack) : { ok: false, errors: ['the model returned no post'], warnings: [] };
    lastValidation = { ok: v.ok, errors: v.errors, warnings: v.warnings };
    logger.info('pagePostWriter generatePagePost attempt', { attempt, ok: v.ok, errors: v.errors.length });

    if (v.ok) return { ok: true, post, errors: [], warnings: v.warnings, attempts: attempt };
    if (attempt > maxRepairs) break;

    const repairText = `The post failed validation. Fix EXACTLY these and re-emit via emit_page_post:\n- ${lastValidation.errors.join('\n- ')}\n\nReminder: ${ALBUM_MIN}-${PHOTOS_MAX} DISTINCT photos by exact storagePath from the assets; message ${MESSAGE_MIN}-${MESSAGE_MAX} chars; postType one of ${POST_TYPES.join('/')}; no OTA links.`;
    messages.push({ role: 'assistant', content: resp.content });
    messages.push({ role: 'user', content: toolUse?.id ? [{ type: 'tool_result', tool_use_id: toolUse.id, content: repairText }] : repairText });
  }

  return { ok: false, post, errors: lastValidation.errors, warnings: lastValidation.warnings, attempts: maxRepairs + 1 };
}
