/**
 * Predefined themes for RentalSpot Builder
 * 
 * This file contains the definitions for all available themes.
 * Each theme follows the Theme interface defined in theme-types.ts.
 */

import { Theme } from './theme-types';

/**
 * The default Airbnb-inspired theme with signature pink accents
 */
export const airbnbTheme: Theme = {
  id: "airbnb",
  name: "Airbnb",
  description: "Clean modern design with Airbnb's signature pink accent",
  colors: {
    background: "0 0% 100%",         // White
    foreground: "240 10% 3.9%",      // Almost black
    primary: "358 100% 62%",         // #FF385C (Airbnb pink)
    secondary: "240 4.8% 95.9%",     // Light gray
    accent: "358 100% 67%",          // #FF5A5F (Slightly lighter pink)
    muted: "240 4.8% 95.9%",         // Light gray background
    border: "240 5.9% 90%",          // Light gray border
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    fontFamilyUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
    headingWeight: 600,
    bodyWeight: 400,
  },
  sizing: {
    borderRadius: "0.5rem",          // 8px
    buttonRadius: "0.5rem",          // 8px
    cardRadius: "0.75rem",           // 12px
    inputRadius: "0.5rem",           // 8px
    spacing: "1rem",                 // 16px
  },
  components: {
    button: {
      padding: "0.625rem 1.25rem",   // 10px 20px
      shadow: "none",
      hoverEffect: "darken",
    },
    card: {
      shadow: "0 1px 3px rgba(0,0,0,0.12)",
      borderWidth: "1px",
      padding: "1.5rem",             // 24px
    },
    input: {
      borderWidth: "1px",
      focusEffect: "border",
      padding: "0.625rem 0.75rem",   // 10px 12px
    },
  },
  previewImage: "/images/themes/airbnb.jpg",
};

/**
 * Ocean Blue theme with calming blue tones
 */
export const oceanTheme: Theme = {
  id: "ocean",
  name: "Ocean Blue",
  description: "Calming blues inspired by coastal destinations",
  colors: {
    background: "0 0% 100%",
    foreground: "222 47% 11%",
    primary: "196 100% 47%",         // #00A0F0
    secondary: "210 40% 96.1%",
    accent: "199 89% 48%",           // #1AA7EC
    muted: "210 40% 96.1%",
    border: "214 32% 91%",
  },
  typography: {
    fontFamily: "'Montserrat', sans-serif",
    fontFamilyUrl: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap",
    headingWeight: 600,
    bodyWeight: 400,
  },
  sizing: {
    borderRadius: "0.75rem",
    buttonRadius: "3rem",            // Pill buttons
    cardRadius: "1rem",
    inputRadius: "0.5rem",
    spacing: "1.25rem",              // 20px
  },
  components: {
    button: {
      padding: "0.75rem 1.5rem",     // 12px 24px
      shadow: "0 4px 6px rgba(0, 160, 240, 0.25)",
      hoverEffect: "scale",
    },
    card: {
      shadow: "0 8px 30px rgba(0, 0, 0, 0.08)",
      borderWidth: "0",
      padding: "1.75rem",            // 28px
    },
    input: {
      borderWidth: "2px",
      focusEffect: "glow",
      padding: "0.75rem 1rem",       // 12px 16px
    },
  },
  previewImage: "/images/themes/ocean.jpg",
};

/**
 * Forest Green theme with natural, earthy colors
 */
export const forestTheme: Theme = {
  id: "forest",
  name: "Forest Green",
  description: "Natural, earthy greens for a calming atmosphere",
  colors: {
    background: "0 0% 100%",
    foreground: "130 24% 10%",
    primary: "140 47% 40%",          // #3B9A63
    secondary: "140 30% 96%",
    accent: "150 54% 50%",           // #3CB371
    muted: "140 30% 96%",
    border: "140 21% 90%",
  },
  typography: {
    fontFamily: "'Lora', serif",
    fontFamilyUrl: "https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap",
    headingWeight: 700,
    bodyWeight: 400,
  },
  sizing: {
    borderRadius: "0.25rem",         // More squared corners
    buttonRadius: "0.25rem",
    cardRadius: "0.25rem",
    inputRadius: "0.25rem",
    spacing: "1rem",                 // 16px
  },
  components: {
    button: {
      padding: "0.625rem 1rem",      // 10px 16px
      shadow: "none",
      hoverEffect: "lighten",
    },
    card: {
      shadow: "none",
      borderWidth: "1px",
      padding: "1.5rem",             // 24px
    },
    input: {
      borderWidth: "1px",
      focusEffect: "border",
      padding: "0.625rem 0.75rem",   // 10px 12px
    },
  },
  previewImage: "/images/themes/forest.jpg",
};

/**
 * Modern Minimal theme with clean, minimal design
 */
export const modernTheme: Theme = {
  id: "modern",
  name: "Modern Minimal",
  description: "Clean, minimal design with ample whitespace",
  colors: {
    background: "0 0% 100%",
    foreground: "0 0% 10%",
    primary: "210 100% 50%",         // #0078FF (Vibrant blue)
    secondary: "0 0% 98%",
    accent: "280 100% 70%",          // Purple accent
    muted: "0 0% 97%",
    border: "0 0% 90%",
  },
  typography: {
    fontFamily: "'DM Sans', sans-serif",
    fontFamilyUrl: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap",
    headingWeight: 700,
    bodyWeight: 400,
  },
  sizing: {
    borderRadius: "0.75rem",
    buttonRadius: "0.5rem",
    cardRadius: "1rem",
    inputRadius: "0.5rem",
    spacing: "1.5rem",               // 24px (more spacious)
  },
  components: {
    button: {
      padding: "0.75rem 1.5rem",     // 12px 24px
      shadow: "0 2px 10px rgba(0, 0, 0, 0.05)",
      hoverEffect: "scale",
    },
    card: {
      shadow: "0 20px 60px rgba(0, 0, 0, 0.05)",
      borderWidth: "0",
      padding: "2rem",               // 32px
    },
    input: {
      borderWidth: "1px",
      focusEffect: "border",
      padding: "0.75rem 1rem",       // 12px 16px
    },
  },
  previewImage: "/images/themes/modern.jpg",
};

/**
 * Luxury Estate theme with dark, sophisticated styling
 */
export const luxuryTheme: Theme = {
  id: "luxury",
  name: "Luxury Estate",
  description: "Sophisticated dark design with gold accents",
  colors: {
    background: "0 0% 10%",          // Nearly black
    foreground: "0 0% 90%",          // Nearly white
    primary: "36 100% 50%",          // Gold (#FFC000)
    secondary: "30 15% 20%",         // Dark brown
    accent: "36 80% 65%",            // Light gold
    muted: "30 10% 20%",             // Dark muted brown
    border: "30 20% 30%",            // Medium brown border
  },
  typography: {
    fontFamily: "'Playfair Display', serif",
    fontFamilyUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap",
    headingWeight: 600,
    bodyWeight: 400,
  },
  sizing: {
    borderRadius: "0.25rem",         // More squared corners
    buttonRadius: "0",               // Completely square buttons
    cardRadius: "0.25rem",           // Slight rounding on cards
    inputRadius: "0",                // Square inputs
    spacing: "1.25rem",              // 20px
  },
  components: {
    button: {
      padding: "0.75rem 1.5rem",     // 12px 24px
      shadow: "0 4px 8px rgba(0,0,0,0.3)",
      hoverEffect: "glow",
    },
    card: {
      shadow: "0 10px 30px rgba(0,0,0,0.25)",
      borderWidth: "1px",
      padding: "2rem",               // 32px
    },
    input: {
      borderWidth: "1px",
      focusEffect: "glow",
      padding: "0.75rem 1rem",       // 12px 16px
    },
  },
  previewImage: "/images/themes/luxury.jpg",
};

/**
 * Collection of all predefined themes
 */
export const predefinedThemes: Theme[] = [
  airbnbTheme,
  oceanTheme,
  forestTheme,
  modernTheme,
  luxuryTheme,
];

/**
 * Get a theme by its ID
 * @param id The theme ID to find
 * @returns The theme with the given ID, or the default theme if not found
 */
export function getThemeById(id: string): Theme {
  return predefinedThemes.find(theme => theme.id === id) || airbnbTheme;
}

/**
 * Default theme ID to use if none is specified
 */
export const DEFAULT_THEME_ID = "airbnb";