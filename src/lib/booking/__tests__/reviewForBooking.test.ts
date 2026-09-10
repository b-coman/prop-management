/**
 * The booking-page review has one property the campaign picker deliberately does NOT have: it must
 * be the same review every time. A page that quotes a different guest on each render can't be
 * reviewed, screenshotted or tested, and reads as unstable to anyone who reloads.
 */
import { pickBookingReview } from '../reviewForBooking';
import type { ReviewRow } from '@/lib/growth/reviewPicker';

const RO_LONG: ReviewRow = {
  id: 'ro-long', author: 'Andrei', rating: 5, source: 'airbnb', at: 1_700_000_000,
  text: 'Ne-am simțit foarte bine, casa este exact ca în poze și gazda foarte primitoare. Curtea este mare, copiii s-au jucat toată ziua, iar seara am făcut foc. Recomand cu drag și vom reveni cu siguranță.',
};
const EN_LONG: ReviewRow = {
  id: 'en-long', author: 'Sarah', rating: 5, source: 'booking.com', at: 1_800_000_000,
  text: 'The house was spotless and the host was very welcoming. Everything we needed was there and the kids loved the garden. We would happily stay again next summer.',
};
const RO_SHORT: ReviewRow = {
  id: 'ro-short', author: 'Ioana', rating: 5, source: 'airbnb', at: 1_900_000_000,
  text: 'Totul a fost foarte frumos, recomand!',   // under 60 chars — not usable at all
};
const LOW_RATED: ReviewRow = {
  id: 'low', author: 'Mihai', rating: 3, source: 'airbnb', at: 1_900_000_000,
  text: 'Casa este frumoasă dar drumul de acces a fost dificil pentru mașina noastră joasă și am avut probleme.',
};
const RATING_ONLY: ReviewRow = {
  id: 'ratingonly', author: 'X', rating: 5, source: 'booking.com', at: 1_900_000_000,
  text: '(rating only) no text was left by this guest for the property at all here',
};

describe('pickBookingReview', () => {
  it('is deterministic — the same corpus yields the same review every call', () => {
    const corpus = [EN_LONG, RO_LONG, LOW_RATED];
    const picks = Array.from({ length: 5 }, () => pickBookingReview(corpus, 'ro')?.id);
    expect(new Set(picks).size).toBe(1);
  });

  it('does not depend on the order the corpus arrives in', () => {
    const a = pickBookingReview([EN_LONG, RO_LONG], 'ro')?.id;
    const b = pickBookingReview([RO_LONG, EN_LONG], 'ro')?.id;
    expect(a).toBe(b);
  });

  it('prefers a review written in the page language', () => {
    // EN_LONG is more recent; language must still win.
    expect(pickBookingReview([EN_LONG, RO_LONG], 'ro')?.id).toBe('ro-long');
    expect(pickBookingReview([EN_LONG, RO_LONG], 'en')?.id).toBe('en-long');
  });

  it('excludes low-rated reviews', () => {
    expect(pickBookingReview([LOW_RATED], 'ro')).toBeNull();
  });

  it('excludes reviews too short to say anything', () => {
    expect(pickBookingReview([RO_SHORT], 'ro')).toBeNull();
  });

  it('excludes rating-only placeholders', () => {
    expect(pickBookingReview([RATING_ONLY], 'en')).toBeNull();
  });

  it('returns null rather than something unusable when there is nothing to quote', () => {
    expect(pickBookingReview([], 'ro')).toBeNull();
    expect(pickBookingReview([LOW_RATED, RO_SHORT, RATING_ONLY], 'ro')).toBeNull();
  });

  it('survives a malformed corpus without throwing', () => {
    expect(pickBookingReview(undefined as never, 'ro')).toBeNull();
  });

  it('falls back to another language rather than showing nothing', () => {
    // Only 19 of the 85 usable Prahova reviews are Romanian. An English one is still real proof.
    expect(pickBookingReview([EN_LONG], 'ro')?.id).toBe('en-long');
  });

  it('prefers a readable length over a wall of text', () => {
    const rambling: ReviewRow = {
      ...RO_LONG, id: 'rambling', at: 2_000_000_000,
      text: RO_LONG.text.repeat(4),  // well past the point anyone reads on a phone
    };
    expect(pickBookingReview([rambling, RO_LONG], 'ro')?.id).toBe('ro-long');
  });
});
