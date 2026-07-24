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
 * Is this guest reachable domestically for reactivation ("lives in Romania", or a proven repeat)?
 *
 * `country` is UNRELIABLE (defaulted to RO across the base, like `language`), so a foreign phone —
 * a much stronger signal of where someone actually lives — OVERRIDES country=RO. Owner's rule
 * (2026-07-24): "George lives in the USA, you can see by the phone number." Several RO-diaspora
 * guests (name Romanian, phone +33/+1/+34/+49/+31) carry country=RO but cannot pop over for a
 * dated window — they are ads/OTA targets, not WhatsApp reactivation. A proven repeat returner
 * (2+ stays) still qualifies regardless of location (Artem ×3, Bianca ×2).
 */
export function isRomaniaBased(g: RomaniaBasedInput): boolean {
  if ((g.stays ?? 0) >= 2) return true;                 // proven repeat returner — worth it wherever they live
  const phone = g.normalizedPhone || g.phone;
  if (hasRomanianPhone(phone)) return true;             // RO phone = strongest "based here" signal
  if (phone && !hasRomanianPhone(phone)) return false;  // a FOREIGN phone overrides an unreliable country=RO
  return ['RO', 'ROMANIA'].includes(String(g.country || '').toUpperCase()); // no phone → fall back to country
}

/** Coarse thread-language sniff for the copywriter: which language to actually write in. */
export function detectLanguage(text: string): 'ro' | 'en' | 'unknown' {
  const ro = (text.match(/\b(si|sa|va|nu|ca|la|cu|de|pe|este|sunt|multumesc|buna|ziua|casa|casuta|noapte|rezervare|zile)\b/gi) || []).length;
  const en = (text.match(/\b(the|and|you|for|are|is|we|thanks|thank|hello|hi|please|room|night|booking|stay|great)\b/gi) || []).length;
  if (ro === 0 && en === 0) return 'unknown';
  return en > ro ? 'en' : 'ro';
}
