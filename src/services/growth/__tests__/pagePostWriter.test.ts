/** @jest-environment node */

import { validatePagePost } from '../pagePostWriter';

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
