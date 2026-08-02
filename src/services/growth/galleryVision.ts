/**
 * galleryVision — describe a gallery photo with a VISION model, so the ad/page selectors can decide
 * whether a photo actually fits a goal/period/audience (promotion-system-architecture.md §4.2, ad
 * plan §14.2). This is the "look at the pixels, don't trust a thin alt tag" upgrade: it produces the
 * rich structured `AiImageDescription` (season, mood, light, features, people, fitting angles).
 *
 * HARD GUARDRAIL: describe ONLY what is visibly present — never infer an amenity, room, or activity
 * that isn't in the frame. A wrong description would make the selector confidently pick a wrong photo.
 *
 * Server-only. Throws if ANTHROPIC_API_KEY is absent.
 */
import { getAnthropicClient, COPYWRITER_MODEL } from '@/lib/growth/anthropic';
import { loggers } from '@/lib/logger';
import type { AiImageDescription } from '@/types';

/** Vision-capable media types the Anthropic API accepts. */
export type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

const DESCRIBE_TOOL = {
  name: 'emit_description',
  description: 'Emit the structured description of the photo.',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: { type: 'string', description: 'one concrete line: what the photo shows.' },
      setting: { type: 'string', description: 'exterior | interior | garden | aerial | detail (or the best single word).' },
      season: { type: 'string', enum: ['autumn', 'winter', 'spring', 'summer', 'indeterminate'], description: 'the season if visibly inferable (snow, green leaves, golden foliage), else indeterminate.' },
      timeOfDay: { type: 'string', enum: ['day', 'golden-hour', 'night', 'indeterminate'] },
      mood: { type: 'string', description: 'the feeling it conveys, e.g. "cozy, warm", "tranquil", "lively".' },
      subjects: { type: 'array', items: { type: 'string' }, description: 'concrete things visible — be specific ("cast-iron cauldron over a fire", not "cooking").' },
      features: { type: 'array', items: { type: 'string' }, description: 'amenities/features actually VISIBLE — "wood-burning stove", "terrace", "bunk beds", "playground". Never list one you cannot see.' },
      people: { type: 'string', enum: ['none', 'adults', 'children', 'family', 'mixed'], description: 'who appears in the frame.' },
      activities: { type: 'array', items: { type: 'string' }, description: 'activities the scene implies — "outdoor cooking", "relaxing", "kids playing".' },
      palette: { type: 'array', items: { type: 'string' }, description: 'dominant colours — "golden", "warm wood", "green".' },
      fitsAngles: { type: 'array', items: { type: 'string' }, description: 'marketing angles this photo suits — e.g. "romantic", "family", "food-and-fire", "nature", "cozy-winter", "off-peak-quiet".' },
    },
    required: ['summary', 'setting', 'season', 'timeOfDay', 'mood', 'subjects', 'features', 'people', 'activities', 'palette', 'fitsAngles'],
  },
};

const SYSTEM = `You describe photos of a Romanian mountain-chalet vacation rental for an AI that will
later SELECT images for ads and social posts. Look at the image carefully and record ONLY what is
visibly present. NEVER invent an amenity, room, activity, season, or person that is not clearly in
the frame — a wrong description makes the downstream AI confidently pick the wrong photo. Be concrete
and specific. If the season or time of day is not visibly clear, say "indeterminate". Fill every
field by calling emit_description.`;

/**
 * Describe one image. Returns the structured description, or null if the model returned nothing.
 * `base64` is the raw image bytes base64-encoded; `mediaType` is its MIME type.
 */
export async function describeImage(base64: string, mediaType: SupportedMediaType): Promise<AiImageDescription | null> {
  const client = getAnthropicClient();
  if (!client) throw new Error('ANTHROPIC_API_KEY not configured — gallery vision is unavailable');

  const resp = await client.messages.create({
    model: COPYWRITER_MODEL, // Opus 4.8 — vision-capable
    max_tokens: 1024,
    system: SYSTEM,
    tools: [DESCRIBE_TOOL],
    tool_choice: { type: 'tool', name: 'emit_description' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: 'Describe this vacation-rental photo. Ground ONLY in what is visible; fill every field.' },
        ],
      },
    ],
  } as never);

  const tool = resp.content.find((b: { type: string }) => b.type === 'tool_use') as { input?: Record<string, unknown> } | undefined;
  const i = tool?.input;
  if (!i) return null;

  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    summary: String(i.summary ?? ''),
    setting: String(i.setting ?? ''),
    season: String(i.season ?? 'indeterminate'),
    timeOfDay: String(i.timeOfDay ?? 'indeterminate'),
    mood: String(i.mood ?? ''),
    subjects: arr(i.subjects),
    features: arr(i.features),
    people: String(i.people ?? 'none'),
    activities: arr(i.activities),
    palette: arr(i.palette),
    fitsAngles: arr(i.fitsAngles),
    model: COPYWRITER_MODEL,
    describedAt: new Date().toISOString(),
  };
}

/** Best-effort MIME sniff from a URL/path extension; defaults to JPEG (the common gallery format). */
export function mediaTypeFromUrl(url: string): SupportedMediaType {
  const u = url.toLowerCase();
  if (u.includes('.png')) return 'image/png';
  if (u.includes('.webp')) return 'image/webp';
  if (u.includes('.gif')) return 'image/gif';
  return 'image/jpeg';
}

/**
 * Describe every gallery photo that has a storagePath but no `aiDescription` yet, and save it back —
 * so a NEWLY uploaded image gets a rich description without anyone running a script (called by the
 * caption-gallery cron and available as an on-demand admin action). Writes after each image so it's
 * resumable; never throws per image. Returns how many were described. `getAdminDb` is imported lazily
 * to keep this module client-safe at type level (the Anthropic call is the only hard server dep).
 */
export async function captionUndescribedImages(
  propertyId: string,
  opts?: { force?: boolean; limit?: number }
): Promise<{ described: number; pending: number; total: number }> {
  const { getAdminDb } = await import('@/lib/firebaseAdminSafe');
  const db = await getAdminDb();
  const ref = db.collection('properties').doc(propertyId);
  const snap = await ref.get();
  if (!snap.exists) return { described: 0, pending: 0, total: 0 };
  const images = (snap.data()?.images ?? []) as Array<{ url?: string; storagePath?: string; aiDescription?: unknown }>;

  const todo = images
    .map((img, idx) => ({ img, idx }))
    .filter(({ img }) => img.storagePath && (opts?.force || !img.aiDescription))
    .slice(0, opts?.limit ?? Infinity);

  let described = 0;
  for (const { img, idx } of todo) {
    if (!img.url) continue;
    try {
      const res = await fetch(img.url);
      if (!res.ok) continue;
      const bytes = Buffer.from(await res.arrayBuffer());
      const desc = await describeImage(bytes.toString('base64'), mediaTypeFromUrl(img.url));
      if (!desc) continue;
      images[idx] = { ...img, aiDescription: desc };
      await ref.update({ images }); // write-after-each → resumable
      described += 1;
    } catch (error) {
      loggers.ads.warn('captionUndescribedImages: failed for one image (continuing)', { propertyId, idx, error: String(error) });
    }
  }
  return { described, pending: todo.length, total: images.length };
}
