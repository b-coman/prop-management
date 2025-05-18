/**
 * Utility functions for the theme system
 */

import { Theme } from './theme-types';

/**
 * Interface for HSL color values
 */
export interface HSLValues {
  h: number;
  s: number;
  l: number;
}

/**
 * Apply a theme's CSS variables to the document root
 * @param theme The theme to apply
 */
export function applyThemeToDOM(theme: Theme): void {
  if (typeof document === 'undefined') return;
  
  console.log(`[Theme Utils] Applying theme: ${theme.id} (${theme.name})`);
  
  const root = document.documentElement;
  
  // Apply color variables
  root.style.setProperty('--background', theme.colors.background);
  root.style.setProperty('--foreground', theme.colors.foreground);
  root.style.setProperty('--primary', theme.colors.primary);
  root.style.setProperty('--secondary', theme.colors.secondary);
  root.style.setProperty('--accent', theme.colors.accent);
  root.style.setProperty('--muted', theme.colors.muted);
  root.style.setProperty('--border', theme.colors.border);
  
  // Apply typography variables
  root.style.setProperty('--font-family', theme.typography.fontFamily);
  
  // Apply sizing variables
  root.style.setProperty('--radius', theme.sizing.borderRadius);
  root.style.setProperty('--button-radius', theme.sizing.buttonRadius);
  root.style.setProperty('--card-radius', theme.sizing.cardRadius);
  root.style.setProperty('--input-radius', theme.sizing.inputRadius);
  root.style.setProperty('--spacing', theme.sizing.spacing);
  
  // Apply component-specific variables
  root.style.setProperty('--button-padding', theme.components.button.padding);
  root.style.setProperty('--button-shadow', theme.components.button.shadow);
  root.style.setProperty('--card-shadow', theme.components.card.shadow);
  root.style.setProperty('--card-border-width', theme.components.card.borderWidth);
  root.style.setProperty('--card-padding', theme.components.card.padding);
  root.style.setProperty('--input-border-width', theme.components.input.borderWidth);
  root.style.setProperty('--input-padding', theme.components.input.padding);
}

/**
 * Load a font dynamically by adding a link element to the document head
 * @param fontUrl The URL of the font to load
 * @param id Optional ID to give the link element
 */
export function loadFont(fontUrl: string, id: string = 'theme-font'): void {
  if (typeof document === 'undefined') return;
  
  // Remove existing font link if it exists
  const existingLink = document.getElementById(id);
  if (existingLink) {
    existingLink.remove();
  }
  
  // Create new font link
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = fontUrl;
  document.head.appendChild(link);
}

/**
 * Convert a theme's hover effect to appropriate Tailwind classes
 * @param hoverEffect The hover effect to convert
 * @param baseColor The base color class to use (e.g., 'bg-primary')
 * @returns Tailwind classes for the hover effect
 */
export function getHoverClasses(hoverEffect: 'darken' | 'lighten' | 'scale' | 'glow', baseColor: string = 'bg-primary'): string {
  switch (hoverEffect) {
    case 'darken':
      return `hover:${baseColor}/90`;
    case 'lighten':
      return `hover:${baseColor}/80`;
    case 'scale':
      return 'hover:scale-105 transition-transform';
    case 'glow':
      return 'hover:shadow-lg hover:shadow-primary/20 transition-shadow';
    default:
      return `hover:${baseColor}/90`;
  }
}

/**
 * Parse HSL values from a string in the format "H S% L%"
 * @param hslString The HSL string to parse (e.g., "196 100% 47%")
 * @returns An object with h, s, l values
 */
export function parseHSLValues(hslString: string): HSLValues {
  try {
    // Handle different formats: "H S% L%" or "H, S%, L%"
    const normalizedStr = hslString.replace(/,/g, ' ').trim();
    
    // Use regex to extract values
    const match = normalizedStr.match(/^(\d+)\s+(\d+)%\s+(\d+)%$/);
    
    if (!match) {
      throw new Error(`Invalid HSL format: ${hslString}. Expected format: "H S% L%" or "H, S%, L%"`);
    }
    
    const h = parseInt(match[1], 10);
    const s = parseInt(match[2], 10);
    const l = parseInt(match[3], 10);
    
    // Validate ranges
    if (h < 0 || h > 360) throw new Error(`Hue value out of range (0-360): ${h}`);
    if (s < 0 || s > 100) throw new Error(`Saturation value out of range (0-100): ${s}`);
    if (l < 0 || l > 100) throw new Error(`Lightness value out of range (0-100): ${l}`);
    
    return { h, s, l };
  } catch (error) {
    console.error(`[Theme Utils] Error parsing HSL: ${error}`);
    // Return a fallback value
    return { h: 0, s: 0, l: 0 };
  }
}

/**
 * Get HSL values from a CSS variable
 * @param variableName The CSS variable name (e.g., '--primary')
 * @returns HSL values object or null if not found
 */
export function getHSLFromCSSVariable(variableName: string): HSLValues | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(variableName)
      .trim();
    
    if (!value) return null;
    
    return parseHSLValues(value);
  } catch (error) {
    console.error(`[Theme Utils] Error getting CSS variable ${variableName}: ${error}`);
    return null;
  }
}

/**
 * Convert HSL values to a CSS-compatible string
 * @param hsl The HSL values object
 * @param alpha Optional alpha value for transparency
 * @returns HSL or HSLA string ready for CSS
 */
export function hslToString(hsl: HSLValues, alpha?: number): string {
  if (alpha !== undefined && alpha >= 0 && alpha <= 1) {
    return `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${alpha})`;
  }
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

/**
 * Apply theme-based styling to the header element
 * @param isScrolled Whether the header is in scrolled state
 * @param themeId Optional theme ID to use (will read from root variables if not provided)
 */
export function applyThemeToHeader(isScrolled: boolean, themeId?: string): void {
  if (typeof window === 'undefined') return;
  
  // Create the style element if it doesn't exist
  let styleEl = document.getElementById('theme-header-styles');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'theme-header-styles';
    document.head.appendChild(styleEl);
  }
  
  try {
    const header = document.getElementById('site-header') || document.querySelector('header');
    if (!header) return;
    
    if (!isScrolled) {
      // Get the primary color from CSS variable
      const primaryHSL = getHSLFromCSSVariable('--primary');
      
      if (!primaryHSL) {
        console.error('[Header] Could not get primary color');
        return;
      }
      
      // Generate foreground text color based on primary's lightness
      let textColor = 'white';
      if (primaryHSL.l > 70) {
        textColor = 'black'; // For light background colors, use dark text
      }
      
      // Create CSS for primary background color with transparency
      styleEl.textContent = `
        header {
          background-color: ${hslToString(primaryHSL, 0.7)} !important;
          backdrop-filter: blur(4px) !important;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1) !important;
        }
        
        /* Text color based on background lightness */
        header * {
          color: ${textColor} !important;
        }
        
        /* Logo element */
        header svg, header img {
          filter: drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.2)) !important;
        }
        
        /* Special Book button */
        header button[data-theme-aware="true"] {
          background-color: ${textColor} !important;
          color: ${hslToString(primaryHSL)} !important;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1) !important;
        }
        
        /* Currency dropdown */
        header [data-theme-aware="true"] {
          border-color: ${textColor === 'white' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)'} !important;
        }
        
        header [data-theme-aware="true"][data-state="open"] {
          background-color: ${hslToString(primaryHSL, 0.6)} !important;
        }
        
        /* First section special handling to ensure it goes under the header */
        #main-content > section:first-child {
          z-index: 40 !important;
          position: relative !important;
          margin-top: -4rem !important;
        }
        
        /* We're handling the hero section padding via JavaScript */
        
        /* Ensure content padding accommodates fixed header */
        #main-content {
          padding-top: 4rem !important;
        }
      `;
      
      console.log(`[Header] Applied theme styling (${themeId || 'current theme'}) to header`);
    } else {
      // Empty the style content when scrolled to use default styling
      styleEl.textContent = '';
    }
  } catch (err) {
    console.error('[Header] Style update error:', err);
  }
}