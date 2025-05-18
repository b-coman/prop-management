/**
 * HSL Color value object
 */
export interface HSLColor {
  h: number;  // Hue (0-360)
  s: number;  // Saturation (0-100)
  l: number;  // Lightness (0-100)
}

/**
 * Extracts HSL values from a CSS variable string
 * @param hslString - The HSL string in format like "196, 100%, 47%"
 * @returns An object with h, s, l values or null if parsing fails
 *
 * @example
 * const primaryColor = extractHSLValues("358 100% 62%");
 * // Returns { h: 358, s: 100, l: 62 }
 */
export function extractHSLValues(hslString: string): HSLColor | null {
  if (!hslString) {
    console.warn("extractHSLValues: Empty HSL string provided");
    return null;
  }

  try {
    // Normalize string by removing extra spaces and ensuring consistent format
    const normalizedString = hslString.trim().replace(/\s+/g, ' ');
    
    // Match pattern: hue(0-360) saturation(0-100%) lightness(0-100%)
    const pattern = /^(\d+)\s+(\d+)%\s+(\d+)%$/;
    const match = normalizedString.match(pattern);
    
    if (!match) {
      console.warn(`extractHSLValues: Invalid HSL format - "${hslString}". Expected format: "H S% L%"`);
      return null;
    }

    // Extract and convert values
    const h = parseInt(match[1], 10);
    const s = parseInt(match[2], 10);
    const l = parseInt(match[3], 10);

    // Validate ranges
    if (h < 0 || h > 360) {
      console.warn(`extractHSLValues: Hue value out of range (0-360): ${h}`);
      return null;
    }
    
    if (s < 0 || s > 100) {
      console.warn(`extractHSLValues: Saturation value out of range (0-100): ${s}`);
      return null;
    }
    
    if (l < 0 || l > 100) {
      console.warn(`extractHSLValues: Lightness value out of range (0-100): ${l}`);
      return null;
    }

    return { h, s, l };
  } catch (error) {
    console.error("extractHSLValues: Failed to parse HSL string", error);
    return null;
  }
}

/**
 * Gets an HSL color from a CSS variable
 * @param cssVariable - The name of the CSS variable (without the -- prefix)
 * @returns HSL color object or null if not found/valid
 * 
 * @example
 * const primaryColor = getHSLFromCSSVariable("primary");
 * // Returns HSL object if --primary is defined in CSS variables
 */
export function getHSLFromCSSVariable(cssVariable: string): HSLColor | null {
  // Skip if running server-side where window isn't available
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    // Get the computed value of the CSS variable
    const rootStyles = getComputedStyle(document.documentElement);
    const cssValue = rootStyles.getPropertyValue(`--${cssVariable}`).trim();
    
    if (!cssValue) {
      console.warn(`getHSLFromCSSVariable: CSS variable --${cssVariable} not found`);
      return null;
    }
    
    return extractHSLValues(cssValue);
  } catch (error) {
    console.error(`getHSLFromCSSVariable: Error getting CSS variable --${cssVariable}`, error);
    return null;
  }
}

/**
 * Constructs a CSS hsla() string from HSL values
 * @param hsl - HSL color object
 * @param alpha - Optional alpha value (0-1)
 * @returns CSS hsla string
 * 
 * @example
 * const hslString = hslToString({ h: 358, s: 100, l: 62 }, 0.5);
 * // Returns "hsla(358, 100%, 62%, 0.5)"
 */
export function hslToString(hsl: HSLColor, alpha?: number): string {
  if (!hsl) {
    return "";
  }
  
  return alpha !== undefined 
    ? `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${alpha})`
    : `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

/**
 * Creates a modified version of an HSL color
 * @param hsl - Original HSL color
 * @param modifications - Object with h, s, l adjustments (absolute values, not relative)
 * @returns New HSL color object
 * 
 * @example
 * const darkerColor = modifyHSL({ h: 358, s: 100, l: 62 }, { l: 40 });
 * // Returns { h: 358, s: 100, l: 40 }
 */
export function modifyHSL(hsl: HSLColor, modifications: Partial<HSLColor>): HSLColor {
  if (!hsl) {
    return hsl;
  }
  
  return {
    h: modifications.h !== undefined ? modifications.h : hsl.h,
    s: modifications.s !== undefined ? modifications.s : hsl.s,
    l: modifications.l !== undefined ? modifications.l : hsl.l
  };
}