import { extractHSLValues, modifyHSL, hslToString } from './theme-utils';

// Test extractHSLValues function
describe('extractHSLValues', () => {
  test('extracts valid HSL values', () => {
    expect(extractHSLValues('358 100% 62%')).toEqual({ h: 358, s: 100, l: 62 });
    expect(extractHSLValues('0 0% 100%')).toEqual({ h: 0, s: 0, l: 100 });
    expect(extractHSLValues('196 84% 47%')).toEqual({ h: 196, s: 84, l: 47 });
  });

  test('handles different spacing formats', () => {
    expect(extractHSLValues('358  100%   62%')).toEqual({ h: 358, s: 100, l: 62 });
    expect(extractHSLValues('358 100% 62%')).toEqual({ h: 358, s: 100, l: 62 });
  });

  test('returns null for invalid formats', () => {
    expect(extractHSLValues('')).toBeNull();
    expect(extractHSLValues('not a color')).toBeNull();
    expect(extractHSLValues('358, 100%, 62%')).toBeNull(); // Commas not supported
    expect(extractHSLValues('358 100 62')).toBeNull(); // Missing percentage signs
    expect(extractHSLValues('400 100% 62%')).toBeNull(); // Hue out of range
    expect(extractHSLValues('358 101% 62%')).toBeNull(); // Saturation out of range
    expect(extractHSLValues('358 100% 101%')).toBeNull(); // Lightness out of range
  });
});

// Test modifyHSL function
describe('modifyHSL', () => {
  test('modifies HSL values correctly', () => {
    const original = { h: 358, s: 100, l: 62 };
    
    expect(modifyHSL(original, { h: 180 })).toEqual({ h: 180, s: 100, l: 62 });
    expect(modifyHSL(original, { s: 50 })).toEqual({ h: 358, s: 50, l: 62 });
    expect(modifyHSL(original, { l: 30 })).toEqual({ h: 358, s: 100, l: 30 });
    expect(modifyHSL(original, { h: 200, s: 80, l: 40 })).toEqual({ h: 200, s: 80, l: 40 });
  });

  test('returns original if no modifications provided', () => {
    const original = { h: 358, s: 100, l: 62 };
    expect(modifyHSL(original, {})).toEqual(original);
  });

  test('handles null input', () => {
    expect(modifyHSL(null as any, { h: 180 })).toBeNull();
  });
});

// Test hslToString function
describe('hslToString', () => {
  test('converts HSL to string correctly', () => {
    expect(hslToString({ h: 358, s: 100, l: 62 })).toBe('hsl(358, 100%, 62%)');
    expect(hslToString({ h: 0, s: 0, l: 100 })).toBe('hsl(0, 0%, 100%)');
  });

  test('handles alpha channel', () => {
    expect(hslToString({ h: 358, s: 100, l: 62 }, 0.5)).toBe('hsla(358, 100%, 62%, 0.5)');
    expect(hslToString({ h: 0, s: 0, l: 100 }, 0.8)).toBe('hsla(0, 0%, 100%, 0.8)');
  });

  test('handles null input', () => {
    expect(hslToString(null as any)).toBe('');
  });
});