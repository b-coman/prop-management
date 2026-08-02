/** @jest-environment node */

import { validatePagePost } from '../pagePostWriter';

const PACK = {
  propertyId: 'prahova-mountain-chalet',
  assetPaths: ['properties/prahova-mountain-chalet/autumn.jpg', 'properties/prahova-mountain-chalet/fire.jpg'],
};
const okMsg = 'Toamna se așterne peste Valea Prahovei — frunze aurii și dimineți liniștite. Veniți să vă bucurați de munte.';

describe('validatePagePost', () => {
  it('accepts a sane message + a real owned photo', () => {
    expect(validatePagePost({ message: okMsg, assetPath: PACK.assetPaths[0] }, PACK).ok).toBe(true);
  });
  it('rejects a too-short message', () => {
    const res = validatePagePost({ message: 'salut', assetPath: PACK.assetPaths[0] }, PACK);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('too short'))).toBe(true);
  });
  it('rejects a photo not in the gallery (cannot invent one)', () => {
    const res = validatePagePost({ message: okMsg, assetPath: 'properties/prahova-mountain-chalet/nope.jpg' }, PACK);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('not in the available gallery assets'))).toBe(true);
  });
  it('rejects a photo owned by another property', () => {
    const pack = { ...PACK, assetPaths: [...PACK.assetPaths, 'properties/other/x.jpg'] };
    const res = validatePagePost({ message: okMsg, assetPath: 'properties/other/x.jpg' }, pack);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('not owned by'))).toBe(true);
  });
  it('warns (not errors) on a long message', () => {
    const res = validatePagePost({ message: 'a '.repeat(300), assetPath: PACK.assetPaths[0] }, PACK);
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.includes('long for a page post'))).toBe(true);
  });
});
