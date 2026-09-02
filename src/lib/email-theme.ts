/**
 * Email palette derived from the property's own site theme.
 *
 * Emails were hard-coded to indigo (#4f46e5) while prahova-mountain-chalet has
 * run the `forest` theme for a long time, so the confirmation a guest received
 * looked like a different company from the site they had just booked on.
 *
 * This reads the SAME theme definitions the website uses, so a property that
 * switches theme gets matching email automatically and nothing here needs a
 * per-property branch (CLAUDE.md rule 7: multi-property first).
 *
 * Colours are converted to hex because Outlook's Word rendering engine does not
 * understand `hsl()`.
 */
import { getThemeById } from '@/lib/themes/theme-definitions';

export interface EmailPalette {
  /** Brand colour: headings, the rule under the hero, the primary button. */
  primary: string;
  /** Body text. */
  foreground: string;
  /** Secondary text: labels, footer. */
  mutedForeground: string;
  /** Page background behind the card. */
  canvas: string;
  /** Card / panel background. */
  surface: string;
  /** Hairline rules. */
  border: string;
  /** Heading font stack, with serif/sans fallbacks that exist on every device. */
  headingFont: string;
  /** Body font stack. */
  bodyFont: string;
}

/** "140 47% 40%" (Tailwind HSL triplet) -> "#3b9a63". */
function hslTripletToHex(triplet: string): string | null {
  const m = triplet.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!m) return null;
  const h = parseFloat(m[1]) / 360;
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const to255 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return '#' + [to255(r), to255(g), to255(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Pull the first family out of a theme font stack ("'Lora', serif" -> "Lora")
 * and append fallbacks that exist without a webfont. Email clients vary wildly
 * in webfont support, so the fallback has to carry the design on its own.
 */
function toEmailFontStack(themeFontFamily: string | undefined): string {
  const first = (themeFontFamily || '').split(',')[0]?.replace(/['"]/g, '').trim();
  const isSerif = /serif/i.test(themeFontFamily || '') && !/sans-serif/i.test(themeFontFamily || '');
  const fallback = isSerif
    ? "Georgia, 'Times New Roman', serif"
    : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  return first ? `'${first}', ${fallback}` : fallback;
}

const NEUTRAL: EmailPalette = {
  primary: '#1f2937',
  foreground: '#1a1a1a',
  mutedForeground: '#6b7280',
  canvas: '#f4f4f2',
  surface: '#ffffff',
  border: '#e5e7eb',
  headingFont: "Georgia, 'Times New Roman', serif",
  bodyFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
};

export function getEmailPalette(themeId?: string): EmailPalette {
  if (!themeId) return NEUTRAL;
  try {
    const theme = getThemeById(themeId);
    const c = theme.colors;
    return {
      primary: hslTripletToHex(c.primary) || NEUTRAL.primary,
      foreground: hslTripletToHex(c.foreground) || NEUTRAL.foreground,
      // Theme files carry no dedicated muted-foreground, and the `muted` token is
      // a near-white surface — unreadable as text. Keep the neutral grey.
      mutedForeground: NEUTRAL.mutedForeground,
      canvas: hslTripletToHex(c.muted) || NEUTRAL.canvas,
      surface: '#ffffff',
      border: hslTripletToHex(c.border) || NEUTRAL.border,
      headingFont: toEmailFontStack(theme.typography?.fontFamily),
      bodyFont: NEUTRAL.bodyFont,
    };
  } catch {
    return NEUTRAL;
  }
}
