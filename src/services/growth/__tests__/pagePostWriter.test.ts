/** @jest-environment node */

import { validatePagePost, normalizeTypography } from '../pagePostWriter';

const PACK = {
  propertyId: 'prahova-mountain-chalet',
  assetPaths: Array.from({ length: 12 }, (_, i) => `properties/prahova-mountain-chalet/p${i}.jpg`),
};
const okMsg =
  'Toamna se așterne peste Valea Prahovei — frunze aurii și dimineți liniștite. Ce vă place cel mai mult la munte în septembrie?';
/** The shape the page's own record says works: an album, not a single photo. */
const album = (n: number) => PACK.assetPaths.slice(0, n);
const post = (over: Partial<{ message: string; assetPaths: string[]; postType: string }> = {}) => ({
  message: okMsg,
  assetPaths: album(4),
  postType: 'place',
  ...over,
});

describe('validatePagePost', () => {
  it('accepts a sane message + a real owned album', () => {
    expect(validatePagePost(post(), PACK).ok).toBe(true);
  });

  it('rejects a too-short message', () => {
    const res = validatePagePost(post({ message: 'salut' }), PACK);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('too short'))).toBe(true);
  });

  it('rejects a photo not in the gallery (cannot invent one)', () => {
    const res = validatePagePost(
      post({ assetPaths: ['properties/prahova-mountain-chalet/nope.jpg'] }),
      PACK
    );
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('not in the available gallery assets'))).toBe(true);
  });

  it('rejects a photo owned by another property', () => {
    const pack = { ...PACK, assetPaths: [...PACK.assetPaths, 'properties/other/x.jpg'] };
    const res = validatePagePost(post({ assetPaths: ['properties/other/x.jpg'] }), pack);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('not owned by'))).toBe(true);
  });

  it('warns (not errors) on a long message', () => {
    const res = validatePagePost(post({ message: 'a '.repeat(300) }), PACK);
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.includes('long for a page post'))).toBe(true);
  });

  // ── albums ──────────────────────────────────────────────────────────────────
  // The page's six-year record: every one of its five best posts is an album, every single-photo
  // post sits at four reactions or below. A single photo is allowed but should not pass silently.
  it('warns on a single photo', () => {
    const res = validatePagePost(post({ assetPaths: album(1) }), PACK);
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.includes('burning the library'))).toBe(true);
  });

  it('does not warn once it is a real album', () => {
    const res = validatePagePost(post({ assetPaths: album(4) }), PACK);
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.includes('burning the library'))).toBe(false);
  });

  it('rejects more than five photos', () => {
    const res = validatePagePost(post({ assetPaths: album(6) }), PACK);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('too many photos'))).toBe(true);
  });

  it('rejects the same photo twice', () => {
    const res = validatePagePost(
      post({ assetPaths: [PACK.assetPaths[0], PACK.assetPaths[0], PACK.assetPaths[1]] }),
      PACK
    );
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('the same photo twice'))).toBe(true);
  });

  it('rejects no photos at all', () => {
    const res = validatePagePost(post({ assetPaths: [] }), PACK);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('no photos chosen'))).toBe(true);
  });

  // ── post type, which carries the 60/25/15 mix ───────────────────────────────
  it('accepts each of the three types', () => {
    for (const t of ['place', 'proof', 'offer']) {
      expect(validatePagePost(post({ postType: t }), PACK).ok).toBe(true);
    }
  });

  it('rejects an unknown type', () => {
    const res = validatePagePost(post({ postType: 'announcement' }), PACK);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('unknown postType'))).toBe(true);
  });

  it('rejects a missing type', () => {
    const res = validatePagePost(post({ postType: undefined as never }), PACK);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('no postType'))).toBe(true);
  });

  // ── OTA links ───────────────────────────────────────────────────────────────
  // The one post in this page's history carrying an airbnb.com link is also the only caption-bearing
  // post with zero reactions — and it routed the page's own followers to an 18.755% channel.
  it('rejects an Airbnb link in the caption', () => {
    const res = validatePagePost(
      post({ message: `${okMsg} Rezervări: https://www.airbnb.com/rooms/43265214` }),
      PACK
    );
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('links to an OTA'))).toBe(true);
  });

  it('rejects Booking.com and VRBO too', () => {
    for (const host of ['booking.com/hotel/ro/x', 'vrbo.com/3237734']) {
      const res = validatePagePost(post({ message: `${okMsg} ${host}` }), PACK);
      expect(res.ok).toBe(false);
      expect(res.errors.some((e) => e.includes('links to an OTA'))).toBe(true);
    }
  });

  // ── an offer's numbers, which are the only ones that cost money to get wrong ──
  describe('offer facts', () => {
    const FACTS = { priceRon: 1711, checkIn: '2026-09-04', checkOut: '2026-09-07' };
    const offer = (message: string) =>
      validatePagePost({ message, assetPaths: album(4), postType: 'offer' }, { ...PACK, offerFacts: FACTS });
    const good =
      'Ultimul weekend înainte de școală, la munte. 4-7 septembrie, curtea numai a voastră, 1711 lei cu tot cu curățenie. Scrieți-ne și e al vostru.';

    it('accepts a caption carrying the real price and the real dates', () => {
      expect(offer(good).ok).toBe(true);
    });

    it('rejects a caption that never names the price', () => {
      const res = offer('Ultimul weekend înainte de școală, 4-7 septembrie. Scrieți-ne pentru detalii și preț.');
      expect(res.ok).toBe(false);
      expect(res.errors.some((e) => e.includes('does not state the real total'))).toBe(true);
    });

    it('reads 1.711 and 1 711 as the same number a Romanian would type', () => {
      expect(offer(good.replace('1711', '1.711')).ok).toBe(true);
      expect(offer(good.replace('1711', '1 711')).ok).toBe(true);
    });

    // The expensive failure: a fluent sentence doing arithmetic nobody asked for.
    it('rejects an invented second number — a per-night price, a discount, a made-up total', () => {
      const res = offer(good.replace('1711 lei', '1711 lei, adică 570 lei pe noapte'));
      expect(res.ok).toBe(false);
      expect(res.errors.some((e) => e.includes('we did not give it those numbers'))).toBe(true);
    });

    it('rejects a caption with no real dates in it', () => {
      const res = offer('Weekendul viitor e liber la cabană, 1711 lei cu tot cu curățenie. Scrieți-ne.');
      expect(res.ok).toBe(false);
      expect(res.errors.some((e) => e.includes('does not name the real dates'))).toBe(true);
    });

    it('lets a year through — 2026 is not an invented price', () => {
      expect(offer(good.replace('septembrie', 'septembrie 2026')).ok).toBe(true);
    });

    it('is inert for the other two types, which name no numbers at all', () => {
      const res = validatePagePost({ message: okMsg, assetPaths: album(4), postType: 'place' }, { ...PACK, offerFacts: FACTS });
      expect(res.ok).toBe(true);
    });
  });

  it('still allows a link to the property’s own site', () => {
    const res = validatePagePost(
      post({ postType: 'offer', message: `${okMsg} https://prahova-chalet.ro/ro` }),
      PACK
    );
    expect(res.ok).toBe(true);
  });
});

describe('photo rotation', () => {
  // 59 photos and two posts a week: without rotation the library is exhausted in about seven posts
  // and the page starts repeating itself, which performs worse than a smaller fresh album.
  const P = (i: number) => `properties/prahova-mountain-chalet/p${i}.jpg`;

  it('rejects a photo used by a recent post', () => {
    const res = validatePagePost(post({ assetPaths: [P(0), P(1), P(2)] }), {
      ...PACK,
      recentlyUsedPaths: [P(1), P(7)],
    });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('already used by a recent post'))).toBe(true);
  });

  it('names the offending photos so the repair can fix exactly those', () => {
    const res = validatePagePost(post({ assetPaths: [P(0), P(1), P(2)] }), {
      ...PACK,
      recentlyUsedPaths: [P(0), P(2)],
    });
    expect(res.errors.some((e) => e.includes('p0.jpg') && e.includes('p2.jpg'))).toBe(true);
  });

  it('passes when nothing overlaps', () => {
    const res = validatePagePost(post({ assetPaths: [P(0), P(1), P(2)] }), {
      ...PACK,
      recentlyUsedPaths: [P(8), P(9)],
    });
    expect(res.ok).toBe(true);
  });

  it('is inert when the caller supplies no history', () => {
    expect(validatePagePost(post(), PACK).ok).toBe(true);
  });
});

describe('album composition', () => {
  // The composition check only runs on real albums (ALBUM_MIN+), so these fixtures are 6 photos.
  const P = (i: number) => `properties/prahova-mountain-chalet/p${i}.jpg`;
  const tags = (m: Record<number, string[]>) => ({
    ...PACK,
    tagsByPath: Object.fromEntries(Object.entries(m).map(([i, t]) => [P(Number(i)), t])),
  });

  it('warns when a FRAMING tag dominates — the same shot repeated', () => {
    // six wide exteriors: where the camera stood, with nothing tying them together
    const pack = tags({ 0: ['exterior', 'outdoor'], 1: ['exterior', 'outdoor'], 2: ['exterior', 'outdoor'],
                        3: ['exterior', 'outdoor'], 4: ['exterior', 'outdoor'], 5: ['exterior', 'view'] });
    const res = validatePagePost(post({ assetPaths: album(5) }), pack);
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.includes('where the camera stood'))).toBe(true);
  });

  // The real second draft, 28 Aug: every photo `outdoor` because cooking over a fire happens
  // outdoors. The owner caught the first version of this rule firing on exactly this case.
  it('does NOT warn when a SUBJECT tag is as strong as the framing — a themed album', () => {
    const pack = tags({ 0: ['outdoor', 'bbq', 'garden'], 1: ['outdoor', 'bbq', 'fire'], 2: ['outdoor', 'bbq', 'fire'],
                        3: ['outdoor', 'bbq', 'autumn'], 4: ['outdoor', 'bbq', 'view'], 5: ['outdoor', 'bbq'] });
    const res = validatePagePost(post({ assetPaths: album(5) }), pack);
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.includes('where the camera stood'))).toBe(false);
  });

  it('does not warn on a varied album', () => {
    const pack = tags({ 0: ['exterior', 'autumn'], 1: ['interior', 'kitchen'], 2: ['view', 'landscape'],
                        3: ['garden', 'kids'], 4: ['interior', 'bedroom'], 5: ['fire', 'evening'] });
    const res = validatePagePost(post({ assetPaths: album(5) }), pack);
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.includes('where the camera stood'))).toBe(false);
  });

  it('stays silent when no tags are supplied', () => {
    const res = validatePagePost(post({ assetPaths: album(5) }), PACK);
    expect(res.warnings.some((w) => w.includes('where the camera stood'))).toBe(false);
  });

});

describe('normalizeTypography', () => {
  // A standing owner directive across every channel. The model reached for an em-dash in three of
  // four drafts on the first real slate, so this is enforced rather than requested.
  it('turns em- and en-dashes into plain hyphens', () => {
    expect(normalizeTypography('Ultimul weekend — 4–7 septembrie')).toBe('Ultimul weekend - 4-7 septembrie');
  });

  it('leaves an ordinary hyphen and the rest of the text alone', () => {
    const s = 'bine-mi pare, în grădină am... culoare 🥰';
    expect(normalizeTypography(s)).toBe(s);
  });
});

describe('proper Romanian', () => {
  // The second real slate emitted "Trees peste tot, liniște, si laptopul ramane inchis daca vrei" —
  // clean diacritics for one sentence, then five misspellings and an English noun. Asked-for rules
  // get this right most of the time, which is the worst possible rate for a public page.
  const post = (message: string) => validatePagePost({ message, assetPaths: PACK.assetPaths.slice(0, 4), postType: 'place' }, PACK);

  it('rejects a caption that drops its diacritics halfway', () => {
    const res = post('E o seară liniștită la munte, si laptopul ramane inchis daca vrei asta.');
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('written without diacritics'))).toBe(true);
  });

  it('names every offending word so one repair fixes them all', () => {
    const res = post('Liniste totala in gradina, langa padure, daca vrei sa stai mai mult acolo.');
    const err = res.errors.find((e) => e.includes('written without diacritics'))!;
    for (const w of ['liniste', 'gradina', 'langa', 'padure', 'daca']) expect(err).toContain(w);
  });

  it('leaves proper Romanian alone', () => {
    const res = post('E o seară liniștită la munte, iar grădina e numai a voastră. Ce beți lângă foc?');
    expect(res.ok).toBe(true);
  });

  // "noua"/"nouă", "fata"/"față" and "sa"/"să" are real words either way — flagging them would
  // reject correct Romanian, which is worse than missing one.
  it('does not flag words that are valid without diacritics', () => {
    const res = post('Casa noua a fost gata la timp, iar fata lor sa vină oricând vrea la noi.');
    expect(res.ok).toBe(true);
  });
});
