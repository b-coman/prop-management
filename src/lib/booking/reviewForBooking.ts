/**
 * Choose ONE guest review to show on the booking page.
 *
 * WHY NOT `pickReview` FROM growth/reviewPicker. That one is built for a fortnight of page posts:
 * it never repeats, and it spaces the same guest apart, which means it deliberately returns a
 * DIFFERENT review each time it is called. On a booking page that is the wrong property — the page
 * would quote a different guest on every render, which reads as unstable, cannot be screenshotted or
 * reviewed, and makes any test of the page non-deterministic. Here the same window should always show
 * the same review.
 *
 * `usableReviews` IS shared, because "what counts as quotable" is the same judgement in both places:
 * 4.5+, at least 60 characters, and never a "(rating only)" placeholder.
 *
 * DEGRADES TO NOTHING. Returns null when there is nothing honest to show, and the caller renders no
 * block at all — the same discipline as `buildExampleStays`. A booking page with no review is a
 * slightly thinner page; a booking page with a fabricated or mistranslated one is a liability.
 */
import { usableReviews, detectLanguage, type ReviewRow } from '@/lib/growth/reviewPicker';

/**
 * A review long enough to say something, short enough to read beside a price. Below this a review is
 * a slogan ("Superb!"); above it, nobody reads to the end on a phone and it pushes the CTA down.
 */
const IDEAL_MIN = 80;
const IDEAL_MAX = 320;

/**
 * Deterministic: the same corpus and the same language always yield the same review.
 *
 * Preference order, most important first:
 *   1. written in the page's own language — a translated quote loses the voice that makes it proof
 *   2. an ideal reading length for this context
 *   3. higher rating
 *   4. more recent
 *   5. id, purely so ties cannot reorder between renders
 */
export function pickBookingReview(rows: ReviewRow[], lang: string): ReviewRow | null {
  const pool = usableReviews(rows ?? []);
  if (!pool.length) return null;

  const score = (r: ReviewRow) => {
    const detected = detectLanguage(r.text);
    const sameLanguage = detected.lang === lang && detected.confident;
    const len = r.text.trim().length;
    return {
      sameLanguage: sameLanguage ? 1 : 0,
      idealLength: len >= IDEAL_MIN && len <= IDEAL_MAX ? 1 : 0,
      rating: r.rating,
      at: r.at ?? 0,
      id: r.id,
    };
  };

  return [...pool].sort((a, b) => {
    const A = score(a), B = score(b);
    return (
      B.sameLanguage - A.sameLanguage ||
      B.idealLength - A.idealLength ||
      B.rating - A.rating ||
      B.at - A.at ||
      A.id.localeCompare(B.id)
    );
  })[0];
}
