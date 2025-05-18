/**
 * Theme system type definitions
 * 
 * This file contains the type definitions for the theme system, including
 * interfaces for the entire theme structure and its components.
 */

/**
 * The main Theme interface that defines all aspects of a theme
 */
export interface Theme {
  id: string;              // Unique identifier
  name: string;            // Display name
  description: string;     // Brief description
  colors: ThemeColors;     // Color definitions
  typography: ThemeTypography; // Typography settings
  sizing: ThemeSizing;     // Size and spacing settings
  components: ThemeComponents; // Component-specific styling
  previewImage: string;    // Path to preview image
}

/**
 * Color definitions for the theme
 */
export interface ThemeColors {
  background: string;      // Main background (HSL format for CSS variables)
  foreground: string;      // Main text color
  primary: string;         // Primary action/brand color
  secondary: string;       // Secondary UI color
  accent: string;          // Highlight/accent color
  muted: string;           // Subdued background
  border: string;          // Border color
}

/**
 * Typography settings for the theme
 */
export interface ThemeTypography {
  fontFamily: string;      // Main font family
  fontFamilyUrl: string;   // Google Fonts URL
  headingWeight: number;   // Font weight for headings (400, 500, 600, 700)
  bodyWeight: number;      // Font weight for body text
}

/**
 * Size and spacing settings for the theme
 */
export interface ThemeSizing {
  borderRadius: string;    // Default border radius
  buttonRadius: string;    // Button-specific radius
  cardRadius: string;      // Card-specific radius
  inputRadius: string;     // Input-specific radius
  spacing: string;         // Base spacing unit
}

/**
 * Component-specific styling options
 */
export interface ThemeComponents {
  button: ThemeButtonStyles;
  card: ThemeCardStyles;
  input: ThemeInputStyles;
}

/**
 * Button-specific styling
 */
export interface ThemeButtonStyles {
  padding: string;
  shadow: string;
  hoverEffect: 'darken' | 'lighten' | 'scale' | 'glow';
}

/**
 * Card-specific styling
 */
export interface ThemeCardStyles {
  shadow: string;
  borderWidth: string;
  padding: string;
}

/**
 * Input-specific styling
 */
export interface ThemeInputStyles {
  borderWidth: string;
  focusEffect: 'border' | 'glow' | 'outline';
  padding: string;
}