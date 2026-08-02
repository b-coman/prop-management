/**
 * generationPrompt — build a GUARDED image-generation prompt from an asset gap (Fable §2.3). The
 * prompt is assembled from a FIXED skeleton per transform, with the requester's need spliced inside —
 * a free-form instruction never becomes the whole prompt. The hard rule in every skeleton: edit only
 * the requested aspect of a REAL base photo; never add, remove, or invent rooms, structures, or
 * amenities. This is the same guardrail the (future) generation gateway will enforce in code; here it
 * produces a ready-to-paste prompt for the operator's own image-AI (manual-generation v1).
 *
 * Pure — no imports beyond the type.
 */
import type { AdAssetGap } from '@/types';

const NEVER = 'Do NOT add, remove, or alter any rooms, buildings, structures, furniture, or amenities — keep the exact same scene, layout, and viewpoint. Only a natural, realistic edit; no text, no logos, no watermarks.';

/**
 * Compose the generation prompt for a gap. `baseSummary` is the nearest real photo's one-line
 * description (from its aiDescription) so the operator/model knows what it is editing.
 */
export function buildGenerationPrompt(
  transform: AdAssetGap['transform'],
  need: string,
  baseSummary: string
): string {
  const base = baseSummary ? `Base photo (edit THIS image): ${baseSummary}.` : 'Edit the attached base photo.';
  const want = need.trim();
  switch (transform) {
    case 'relight':
      return `${base}\nChange ONLY the lighting/time-of-day to achieve: ${want}. ${NEVER}`;
    case 'seasonal':
      return `${base}\nChange ONLY the season/weather to: ${want} (e.g. autumn golden foliage, or winter snow on the ground and trees). Alter only seasonal elements — trees, ground, sky, light. ${NEVER}`;
    case 'populate_people':
      return `${base}\nAdd people naturally ${want}, placed believably within THIS exact scene at a realistic scale. Candid, not posed; no faces in sharp focus. ${NEVER}`;
    default:
      return `${base}\n${want}. ${NEVER}`;
  }
}
