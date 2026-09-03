/**
 * The focus ring, and why it needed wiring at all.
 *
 * `globals.css` hardcoded `--ring: 358 100% 62%` with the comment "Primary pink for rings". That
 * value IS the airbnb theme's own primary, and no theme ever set `--ring`, so every other theme
 * silently inherited Airbnb's pink: a forest-green property outlined its focused controls in red,
 * which reads as a validation error rather than as focus.
 */
import { themeToInlineStyles } from '../theme-utils';
import type { Theme } from '../theme-types';

const shell = {
  typography: { fontFamily: 'x', fontFamilyUrl: '', headingWeight: 700, bodyWeight: 400 },
  sizing: { borderRadius: '0', buttonRadius: '0', cardRadius: '0', inputRadius: '0', spacing: '1rem' },
  components: {
    button: { padding: '0', shadow: 'none', hoverEffect: 'lighten' },
    card: { shadow: 'none', borderWidth: '1px', padding: '1rem' },
    input: { borderWidth: '1px', padding: '0.5rem' },
  },
} as unknown as Theme;

const withColors = (colors: Record<string, string>): Theme =>
  ({ ...shell, id: 't', name: 'T', description: '', colors } as unknown as Theme);

const FOREST = withColors({
  background: '0 0% 100%', foreground: '130 24% 10%', primary: '140 47% 40%',
  secondary: '140 30% 96%', accent: '150 54% 50%', muted: '140 30% 96%', border: '140 21% 90%',
});

describe('--ring follows the theme', () => {
  it('defaults to primary when a theme states no ring', () => {
    expect((themeToInlineStyles(FOREST) as Record<string, string>)['--ring']).toBe('140 47% 40%');
  });

  it('lets a theme state its own', () => {
    const t = withColors({ ...(FOREST.colors as any), ring: '12 34% 56%' });
    expect((themeToInlineStyles(t) as Record<string, string>)['--ring']).toBe('12 34% 56%');
  });

  it('leaves the airbnb theme byte-identical, since its primary was the old hardcoded value', () => {
    const airbnb = withColors({
      background: '0 0% 100%', foreground: '0 0% 13%', primary: '358 100% 62%',
      secondary: '0 0% 96%', accent: '358 100% 62%', muted: '0 0% 96%', border: '0 0% 87%',
    });
    expect((themeToInlineStyles(airbnb) as Record<string, string>)['--ring']).toBe('358 100% 62%');
  });

  it('still emits every colour variable it emitted before', () => {
    const out = themeToInlineStyles(FOREST) as Record<string, string>;
    for (const v of ['--background', '--foreground', '--primary', '--secondary', '--accent', '--muted', '--border']) {
      expect(out[v]).toBeTruthy();
    }
  });
});
