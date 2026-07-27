/** @jest-environment node */

import { validateAdCreative, type AdCreativePackForValidation } from '../validateAdCreative';
import type { CopyVariant } from '@/types';

const PACK: AdCreativePackForValidation = {
  propertyId: 'prahova-mountain-chalet',
  assetPaths: [
    'properties/prahova-mountain-chalet/autumn-chalet.jpg',
    'properties/prahova-mountain-chalet/fireplace.jpg',
    'properties/prahova-mountain-chalet/valley-view.jpg',
  ],
};

const cv = (primary: string, headline?: string, cta: CopyVariant['cta'] = 'learn_more'): CopyVariant => ({ primary, headline, cta });

const OK = {
  copy: [
    cv('O evadare linistita in Valea Prahovei, printre paduri aurii de toamna.', 'Cabana in munte'),
    cv('Weekend la munte, departe de oras — foc in semineu si liniste.', 'Toamna la cabana'),
  ],
  assetPaths: ['properties/prahova-mountain-chalet/autumn-chalet.jpg', 'properties/prahova-mountain-chalet/fireplace.jpg'],
};

describe('validateAdCreative — happy path', () => {
  it('accepts well-formed copy + real, owned, distinct photos', () => {
    const res = validateAdCreative(PACK, OK);
    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
  });
});

describe('validateAdCreative — copy', () => {
  it('rejects zero copy variants', () => {
    const res = validateAdCreative(PACK, { ...OK, copy: [] });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('no copy variant'))).toBe(true);
  });
  it('rejects too many copy variants', () => {
    const res = validateAdCreative(PACK, { ...OK, copy: Array.from({ length: 6 }, (_, i) => cv(`Un text de reclama numarul ${i} destul de lung.`)) });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('too many copy variants'))).toBe(true);
  });
  it('rejects an empty and a too-short primary', () => {
    expect(validateAdCreative(PACK, { ...OK, copy: [cv('')] }).errors.some((e) => e.includes('empty primary'))).toBe(true);
    expect(validateAdCreative(PACK, { ...OK, copy: [cv('prea scurt')] }).errors.some((e) => e.includes('too short'))).toBe(true);
  });
  it('warns (not errors) on a primary over the soft "See more" length', () => {
    const long = 'x'.repeat(200);
    const res = validateAdCreative(PACK, { ...OK, copy: [cv(long, 'ok')] });
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.includes('See more'))).toBe(true);
  });
  it('errors on a headline past the hard max', () => {
    const res = validateAdCreative(PACK, { ...OK, copy: [cv('Un text de reclama valid si suficient de lung.', 'x'.repeat(41))] });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('headline too long'))).toBe(true);
  });
  it('rejects an unknown CTA', () => {
    const res = validateAdCreative(PACK, { ...OK, copy: [cv('Un text de reclama valid si suficient de lung.', 'ok', 'sign_up' as never)] });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('unknown cta'))).toBe(true);
  });
  it('rejects duplicate primaries and duplicate headlines (Meta asset_feed_spec dedup)', () => {
    const dupP = validateAdCreative(PACK, { ...OK, copy: [cv('Acelasi text de reclama repetat aici.'), cv('Acelasi text de reclama repetat aici.')] });
    expect(dupP.errors.some((e) => e.includes('duplicate primary'))).toBe(true);
    const dupH = validateAdCreative(PACK, {
      ...OK,
      copy: [cv('Primul text de reclama distinct.', 'Acelasi titlu'), cv('Al doilea text de reclama distinct.', 'Acelasi titlu')],
    });
    expect(dupH.errors.some((e) => e.includes('duplicate headline'))).toBe(true);
  });
});

describe('validateAdCreative — photos (grounding)', () => {
  it('rejects zero photos', () => {
    expect(validateAdCreative(PACK, { ...OK, assetPaths: [] }).errors.some((e) => e.includes('no photo'))).toBe(true);
  });
  it('rejects a photo not in the available assets (cannot invent a photo)', () => {
    const res = validateAdCreative(PACK, { ...OK, assetPaths: ['properties/prahova-mountain-chalet/does-not-exist.jpg'] });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('not in the available gallery assets'))).toBe(true);
  });
  it('rejects a photo owned by a different property', () => {
    const pack = { ...PACK, assetPaths: [...PACK.assetPaths, 'properties/other-property/pool.jpg'] };
    const res = validateAdCreative(pack, { ...OK, assetPaths: ['properties/other-property/pool.jpg'] });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('not owned by'))).toBe(true);
  });
  it('rejects the same photo selected twice', () => {
    const p = 'properties/prahova-mountain-chalet/autumn-chalet.jpg';
    const res = validateAdCreative(PACK, { ...OK, assetPaths: [p, p] });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('more than once'))).toBe(true);
  });
});
