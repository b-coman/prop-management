/**
 * audience — the shared predicate for who the reactivation engine may reach.
 *
 * Owner's framing (2026-07-24): the criterion is "lives in Romania" (can realistically come to the
 * chalet), NOT "is ethnically Romanian." A foreigner with a Romanian phone who speaks English still
 * qualifies — the language field just tells the copywriter which language to write in (and is
 * unreliable anyway: everyone is blanket-tagged "ro", so detect from the thread, not the field).
 *
 * Signal, in order of trust:
 *   1. Romanian phone (+40) — strongest "based here" signal.
 *   2. country === RO.
 *   3. a repeat guest (2+ stays) — a proven returner is worth reaching regardless of where they
 *      live (Artem ×3, Bianca ×2 are foreign but came back). Owner-endorsed extension.
 *
 * NOTE: the `language: "ro"` tag is a blanket default across the base and does NOT reflect the
 * language the guest actually communicates in — do not use it to decide Romanian-ness.
 *
 * Pure — importable by every pack and by the eventual in-app orchestration.
 */

/** True if the phone is a Romanian number (+40 / 0040 / bare 40…). */
export function hasRomanianPhone(phone: string | undefined | null): boolean {
  const p = (phone || '').replace(/[^0-9+]/g, '');
  if (p.startsWith('+40') || p.startsWith('0040')) return true;
  // bare national/E.164-without-plus: 40 followed by a 9-digit RO subscriber number
  if (/^40\d{9}$/.test(p)) return true;
  return false;
}

export interface RomaniaBasedInput {
  normalizedPhone?: string | null;
  phone?: string | null;
  country?: string | null;
  stays?: number;   // non-cancelled stays (for the repeat-returner extension)
}

/**
 * Is this guest a Romanian-affinity reactivation target (domestic OR diaspora OR proven repeat)?
 *
 * `country` IS meaningful (it varies across ~30 countries, NOT a blanket-RO default — corrected
 * 2026-07-24). Combined with the phone it cleanly separates three groups:
 *   - domestic  : Romanian phone (+40)                → lives here; good for any window.
 *   - diaspora  : country=RO but a FOREIGN phone      → Romanian living abroad; visits RO for major
 *                 holidays (Christmas/Easter/summer/national days). Owner's rule (2026-07-24): do NOT
 *                 exclude them — they travel home and are a real seasonal target; just target the
 *                 right occasions (not a short-notice local gap). Use classifyResidency() + the
 *                 planner's occasion reasoning to decide when.
 *   - foreign   : country≠RO                          → a tourist; ads/OTA, NOT WhatsApp reactivation.
 * A proven repeat returner (2+ stays) qualifies regardless of origin (Artem ×3, Bianca ×2).
 * (Individuals we never want to contact are handled separately via suppressionList / unsubscribed.)
 */
export function isRomaniaBased(g: RomaniaBasedInput): boolean {
  if ((g.stays ?? 0) >= 2) return true;                                          // proven repeat returner
  if (hasRomanianPhone(g.normalizedPhone) || hasRomanianPhone(g.phone)) return true; // domestic
  if (['RO', 'ROMANIA'].includes(String(g.country || '').toUpperCase())) return true; // Romanian (diaspora if foreign phone)
  return false;                                                                  // foreign tourist — not a reactivation target
}

export type Residency = 'domestic' | 'diaspora' | 'foreign';

/**
 * Classify where a reactivation target lives, so the planner can match them to the right occasion:
 * domestic → any window; diaspora → major-holiday/vacation windows they travel home for; foreign →
 * only present here as a proven repeat returner (kept for loyalty, judge case by case).
 */
export function classifyResidency(g: RomaniaBasedInput): Residency {
  if (hasRomanianPhone(g.normalizedPhone) || hasRomanianPhone(g.phone)) return 'domestic';
  if (['RO', 'ROMANIA'].includes(String(g.country || '').toUpperCase())) return 'diaspora';
  return 'foreign';
}

/** Coarse thread-language sniff for the copywriter: which language to actually write in. */
export function detectLanguage(text: string): 'ro' | 'en' | 'unknown' {
  const ro = (text.match(/\b(si|sa|va|nu|ca|la|cu|de|pe|este|sunt|multumesc|buna|ziua|casa|casuta|noapte|rezervare|zile)\b/gi) || []).length;
  const en = (text.match(/\b(the|and|you|for|are|is|we|thanks|thank|hello|hi|please|room|night|booking|stay|great)\b/gi) || []).length;
  if (ro === 0 && en === 0) return 'unknown';
  return en > ro ? 'en' : 'ro';
}
