/** @jest-environment node */

import { validatePagePost } from '../pagePostWriter';

const PACK = {
  propertyId: 'prahova-mountain-chalet',
  assetPaths: [
    'properties/prahova-mountain-chalet/autumn.jpg',
    'properties/prahova-mountain-chalet/fire.jpg',
    'properties/prahova-mountain-chalet/terrace.jpg',
    'properties/prahova-mountain-chalet/kitchen.jpg',
    'properties/prahova-mountain-chalet/view.jpg',
    'properties/prahova-mountain-chalet/swing.jpg',
  ],
};
const okMsg =
  'Toamna se așterne peste Valea Prahovei — frunze aurii și dimineți liniștite. Ce vă place cel mai mult la munte în septembrie?';
/** The shape the page's own record says works: an album, not a single photo. */
const album = (n: number) => PACK.assetPaths.slice(0, n);
const post = (over: Partial<{ message: string; assetPaths: string[]; postType: string }> = {}) => ({
  message: okMsg,
  assetPaths: album(3),
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
  it('warns on a single photo, because this page’s albums beat singles ~3:1', () => {
    const res = validatePagePost(post({ assetPaths: album(1) }), PACK);
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.includes('3:1'))).toBe(true);
  });

  it('does not warn once it is a real album', () => {
    const res = validatePagePost(post({ assetPaths: album(4) }), PACK);
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.includes('3:1'))).toBe(false);
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

describe('album composition', () => {
  // First real draft, 28 Aug 2026: 5 photos, 4 of them the chalet exterior from different angles.
  // The first version of this check warned whenever ANY tag dominated. The owner pointed out that is
  // wrong: "maybe another post won't be only about season, could be kids, could be BBQ activities,
  // cooking, walking" — a themed album SHOULD be dominated by its theme.
  const TAGS: Record<string, string[]> = {
    'properties/prahova-mountain-chalet/autumn.jpg': ['exterior', 'outdoor', 'autumn'],
    'properties/prahova-mountain-chalet/fire.jpg': ['exterior', 'outdoor', 'autumn', 'bbq'],
    'properties/prahova-mountain-chalet/terrace.jpg': ['exterior', 'outdoor', 'terrace'],
    'properties/prahova-mountain-chalet/kitchen.jpg': ['interior', 'kitchen'],
    'properties/prahova-mountain-chalet/view.jpg': ['view', 'landscape'],
    'properties/prahova-mountain-chalet/swing.jpg': ['garden', 'kids'],
  };
  const packWithTags = { ...PACK, tagsByPath: TAGS };

  it('warns when a FRAMING tag dominates — the same shot repeated', () => {
    // three exteriors: where the camera stood, with no unifying subject
    const res = validatePagePost(post({ assetPaths: album(3) }), packWithTags);
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.includes('where the camera stood'))).toBe(true);
  });

  it('does NOT warn when a SUBJECT tag dominates — that is a themed album', () => {
    // A barbecue post should be mostly barbecue. This is the case that broke the first rule.
    const bbqPack = {
      ...PACK,
      tagsByPath: {
        'properties/prahova-mountain-chalet/autumn.jpg': ['bbq', 'outdoor'],
        'properties/prahova-mountain-chalet/fire.jpg': ['bbq', 'fire'],
        'properties/prahova-mountain-chalet/terrace.jpg': ['bbq', 'interior'],
        'properties/prahova-mountain-chalet/kitchen.jpg': ['bbq', 'kitchen', 'interior'],
      } as Record<string, string[]>,
    };
    const res = validatePagePost(post({ assetPaths: album(4) }), bbqPack);
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.includes('where the camera stood'))).toBe(false);
  });

  it('does not warn on a varied album', () => {
    const varied = [
      'properties/prahova-mountain-chalet/autumn.jpg',
      'properties/prahova-mountain-chalet/kitchen.jpg',
      'properties/prahova-mountain-chalet/view.jpg',
      'properties/prahova-mountain-chalet/swing.jpg',
    ];
    const res = validatePagePost(post({ assetPaths: varied }), packWithTags);
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.includes('where the camera stood'))).toBe(false);
  });

  it('stays silent when no tags are supplied', () => {
    const res = validatePagePost(post({ assetPaths: album(3) }), PACK);
    expect(res.warnings.some((w) => w.includes('where the camera stood'))).toBe(false);
  });

  // The real second draft, 28 Aug: a barbecue album where ALL FOUR photos are `outdoor` — because
  // cooking over a fire happens outdoors. The framing overlap is a consequence of the subject.
  it('does not warn when a framing tag is matched by an equally strong subject', () => {
    const realDraft = {
      ...PACK,
      tagsByPath: {
        'properties/prahova-mountain-chalet/autumn.jpg': ['exterior', 'outdoor', 'garden', 'autumn', 'bbq'],
        'properties/prahova-mountain-chalet/fire.jpg': ['outdoor', 'bbq', 'fire', 'lifestyle'],
        'properties/prahova-mountain-chalet/terrace.jpg': ['outdoor', 'bbq', 'fire', 'autumn'],
        'properties/prahova-mountain-chalet/kitchen.jpg': ['outdoor', 'bbq', 'fire', 'autumn', 'view'],
      } as Record<string, string[]>,
    };
    const res = validatePagePost(post({ assetPaths: album(4) }), realDraft);
    expect(res.ok).toBe(true);
    // outdoor 4/4, but bbq is also 4/4 — the album has a theme
    expect(res.warnings.some((w) => w.includes('where the camera stood'))).toBe(false);
  });

  it('still warns when framing dominates and no subject holds it together', () => {
    const wide = {
      ...PACK,
      tagsByPath: {
        'properties/prahova-mountain-chalet/autumn.jpg': ['exterior', 'outdoor', 'autumn'],
        'properties/prahova-mountain-chalet/fire.jpg': ['exterior', 'outdoor', 'garden'],
        'properties/prahova-mountain-chalet/terrace.jpg': ['exterior', 'outdoor', 'terrace'],
        'properties/prahova-mountain-chalet/kitchen.jpg': ['exterior', 'outdoor', 'view'],
      } as Record<string, string[]>,
    };
    const res = validatePagePost(post({ assetPaths: album(4) }), wide);
    expect(res.warnings.some((w) => w.includes('where the camera stood'))).toBe(true);
  });
});
