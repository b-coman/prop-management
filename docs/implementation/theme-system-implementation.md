# Theme System Implementation - RentalSpot Builder

This document covers the implementation details of the dynamic theme system in RentalSpot Builder, including code patterns, fixes for common issues, and technical decisions.

## 1. Directory Structure & Files

The theme system is implemented across multiple directories:

```
src/
├── lib/
│   └── themes/
│       ├── theme-types.ts         # Type definitions for themes
│       ├── theme-definitions.ts   # Predefined theme objects
│       └── theme-utils.ts         # Utility functions for theme application
│
├── contexts/
│   └── ThemeContext.tsx           # React context for theme state management
│
├── components/
│   └── ui/
│       └── theme-selector.tsx     # UI component for theme selection
│
└── types/
    └── index.ts                   # Updated Property interface with themeId
```

## 2. Theme Definitions & Types

### Theme Interface (theme-types.ts)

The `Theme` interface defines the structure of each theme:

```typescript
// src/lib/themes/theme-types.ts
export interface Theme {
  id: string;
  name: string;
  description: string;
  
  // Color definitions (in HSL format for CSS variables)
  colors: ThemeColors;
  
  // Typography settings
  typography: ThemeTypography;
  
  // Size and spacing settings
  sizing: ThemeSizing;
  
  // Component-specific styling
  components: ThemeComponents;
  
  // Path to preview image
  previewImage: string;
}

export interface ThemeColors {
  background: string;    // Main background
  foreground: string;    // Main text color
  primary: string;       // Primary action/brand color
  secondary: string;     // Secondary UI color
  accent: string;        // Highlight/accent color
  muted: string;         // Subdued background
  border: string;        // Border color
}

export interface ThemeTypography {
  fontFamily: string;    // Main font family
  fontFamilyUrl: string; // Google Fonts URL
  headingWeight: number; // Font weight for headings
  bodyWeight: number;    // Font weight for body text
}

export interface ThemeSizing {
  borderRadius: string;  // Default border radius
  buttonRadius: string;  // Button-specific radius
  cardRadius: string;    // Card-specific radius
  inputRadius: string;   // Input-specific radius
  spacing: string;       // Base spacing unit
}

export interface ThemeComponents {
  button: {
    padding: string;
    shadow: string;
    hoverEffect: 'darken' | 'lighten' | 'scale' | 'glow';
  };
  card: {
    shadow: string;
    borderWidth: string;
    padding: string;
  };
  input: {
    borderWidth: string;
    focusEffect: 'border' | 'glow' | 'outline';
    padding: string;
  };
}
```

### Predefined Themes (theme-definitions.ts)

The system includes 5 predefined themes:

1. **Airbnb** - Clean modern design with Airbnb's signature pink accent
2. **Ocean Blue** - Calming blues inspired by coastal destinations
3. **Forest Green** - Natural, earthy greens for a calming atmosphere
4. **Modern Minimal** - Clean, minimal design with ample whitespace
5. **Luxury Estate** - Sophisticated dark design with gold accents

```typescript
// src/lib/themes/theme-definitions.ts
import { Theme } from './theme-types';

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
  // ... other properties
};

// Define other themes: oceanTheme, forestTheme, modernTheme, luxuryTheme

// Export all themes in an array
export const predefinedThemes: Theme[] = [
  airbnbTheme,
  oceanTheme,
  forestTheme,
  modernTheme,
  luxuryTheme,
];

// Helper function to get a theme by ID
export function getThemeById(id: string): Theme {
  return predefinedThemes.find(theme => theme.id === id) || airbnbTheme;
}

// Default theme ID for when none is specified
export const DEFAULT_THEME_ID = "airbnb";
```

## 3. Theme Utilities

The `theme-utils.ts` file contains functions for applying themes to the DOM:

```typescript
// src/lib/themes/theme-utils.ts
import { Theme } from './theme-types';

/**
 * Apply a theme's CSS variables to the document root
 * @param theme The theme to apply
 */
export function applyThemeToDOM(theme: Theme): void {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  
  // Apply color variables
  root.style.setProperty('--background', theme.colors.background);
  root.style.setProperty('--foreground', theme.colors.foreground);
  root.style.setProperty('--primary', theme.colors.primary);
  // ... other color properties
  
  // Apply typography variables
  root.style.setProperty('--font-family', theme.typography.fontFamily);
  
  // Apply sizing variables
  root.style.setProperty('--radius', theme.sizing.borderRadius);
  root.style.setProperty('--button-radius', theme.sizing.buttonRadius);
  // ... other sizing properties
  
  // Apply component-specific variables
  root.style.setProperty('--button-padding', theme.components.button.padding);
  root.style.setProperty('--button-shadow', theme.components.button.shadow);
  // ... other component properties
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
 */
export function getHoverClasses(hoverEffect: string, baseColor: string = 'bg-primary'): string {
  // ... implementation
}
```

## 4. Theme Context

The `ThemeContext.tsx` file provides a React context for managing theme state:

```typescript
// src/contexts/ThemeContext.tsx
"use client";

import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { Theme, getThemeById, DEFAULT_THEME_ID } from "@/lib/themes/theme-definitions";
import { applyThemeToDOM, loadFont } from "@/lib/themes/theme-utils";

/**
 * Context type definition for the theme context
 */
interface ThemeContextType {
  theme: Theme; // Current theme
  setTheme: (id: string) => void; // Function to change the theme
}

// Create the context with undefined as default
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * ThemeProvider component that wraps the application and provides theme context
 */
export function ThemeProvider({
  children,
  initialThemeId = DEFAULT_THEME_ID,
}: {
  children: ReactNode;
  initialThemeId?: string;
}) {
  // Initialize theme from the provided ID or default
  const [theme, setThemeState] = useState<Theme>(() => getThemeById(initialThemeId));

  // Function to change the current theme
  const setTheme = (id: string) => {
    const newTheme = getThemeById(id);
    setThemeState(newTheme);

    // Store theme preference in localStorage for persistence
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", id);
    }
  };

  // Apply the theme when it changes
  useEffect(() => {
    // Skip applying theme on server
    if (typeof window === "undefined") return;

    // Apply theme CSS variables to DOM
    applyThemeToDOM(theme);

    // Load font for the theme
    loadFont(theme.typography.fontFamilyUrl);
  }, [theme]);

  // Context value
  const contextValue = {
    theme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Custom hook to use the theme context
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  
  return context;
}
```

## 5. Theme Selector and Preview Components

The theme system includes both selection and preview capabilities to help property owners choose the right theme.

### 5.1 Theme Selector Component

The `theme-selector.tsx` file provides a UI component for selecting themes:

```typescript
// src/components/ui/theme-selector.tsx
"use client"

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
import { predefinedThemes } from "@/lib/themes/theme-definitions";

/**
 * Props for the ThemeSelector component
 */
interface ThemeSelectorProps {
  /**
   * The currently selected theme ID
   */
  selectedThemeId: string;
  
  /**
   * Callback for when theme selection changes
   */
  onThemeChange: (id: string) => void;
}

/**
 * ThemeSelector Component
 * 
 * Displays a grid of theme options with previews that property owners can select from.
 */
export function ThemeSelector({ selectedThemeId, onThemeChange }: ThemeSelectorProps) {
  // Track which theme is being hovered
  const [hoveredThemeId, setHoveredThemeId] = useState<string | null>(null);
  
  return (
    <RadioGroup 
      value={selectedThemeId} 
      onValueChange={onThemeChange}
      className="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      {predefinedThemes.map((themeOption) => (
        <div key={themeOption.id} className="relative">
          <RadioGroupItem 
            value={themeOption.id} 
            id={themeOption.id} 
            className="sr-only" 
          />
          <Label 
            htmlFor={themeOption.id} 
            className="cursor-pointer block h-full"
            onMouseEnter={() => setHoveredThemeId(themeOption.id)}
            onMouseLeave={() => setHoveredThemeId(null)}
          >
            <Card className={`overflow-hidden h-full transition-all duration-300 
              ${selectedThemeId === themeOption.id 
                ? 'ring-4 ring-primary shadow-lg scale-[1.02] z-10' 
                : hoveredThemeId === themeOption.id 
                  ? 'ring-2 ring-primary/50 shadow-md scale-[1.01] border-primary/75' 
                  : 'border hover:border-primary'}`}>
              
              {/* Theme preview header with gradient and indicators */}
              <div className="aspect-video relative">
                <div 
                  className="w-full h-full bg-gradient-to-r"
                  style={{ 
                    backgroundImage: `linear-gradient(to right, hsl(${themeOption.colors.primary}), hsl(${themeOption.colors.accent}))` 
                  }}
                />
                {/* CheckCircle icon for selected theme */}
                {selectedThemeId === themeOption.id && (
                  <div className="absolute top-3 right-3 p-1 rounded-full bg-white shadow-md">
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                  </div>
                )}
                {/* "Active Theme" label for selected theme */}
                {selectedThemeId === themeOption.id && (
                  <div className="absolute top-0 left-0 w-full text-center py-1 px-2 text-xs font-medium bg-primary text-white">
                    Active Theme
                  </div>
                )}
                {/* "Click to Select" label for hovered themes */}
                {hoveredThemeId === themeOption.id && selectedThemeId !== themeOption.id && (
                  <div className="absolute bottom-0 left-0 w-full text-center py-1 px-2 text-xs font-medium bg-primary/75 text-white">
                    Click to Select
                  </div>
                )}
              </div>
              
              {/* Theme information */}
              <CardHeader className="p-4">
                <h3 className="font-medium flex items-center">
                  {themeOption.name}
                  {selectedThemeId === themeOption.id && <span className="ml-2 text-xs py-0.5 px-2 rounded-full bg-primary/10 text-primary">Selected</span>}
                </h3>
                <p className="text-sm text-muted-foreground">{themeOption.description}</p>
              </CardHeader>
              
              {/* Theme preview elements (colors, typography, components) */}
              <CardContent className="p-4 pt-0">
                {/* Color swatches */}
                <div className="flex gap-2">
                  <div 
                    className="w-6 h-6 rounded-full shadow-sm" 
                    style={{ background: `hsl(${themeOption.colors.primary})` }}
                    title="Primary color"
                  />
                  <div 
                    className="w-6 h-6 rounded-full shadow-sm" 
                    style={{ background: `hsl(${themeOption.colors.accent})` }}
                    title="Accent color"
                  />
                  <div 
                    className="w-6 h-6 rounded-full shadow-sm" 
                    style={{ background: `hsl(${themeOption.colors.secondary})` }}
                    title="Secondary color"
                  />
                </div>
                
                {/* Font preview */}
                <div className="mt-3 p-2 bg-gray-50 rounded text-xs overflow-hidden">
                  <div style={{ fontFamily: themeOption.typography.fontFamily }}>
                    <span className="block truncate" style={{ fontWeight: themeOption.typography.headingWeight }}>
                      Heading Text
                    </span>
                    <span className="block truncate" style={{ fontWeight: themeOption.typography.bodyWeight }}>
                      Body text sample
                    </span>
                  </div>
                </div>
                
                {/* Component styles preview */}
                <div className="mt-2 flex gap-2">
                  <div 
                    className="text-xs rounded shadow-sm py-1 px-2 text-white"
                    style={{ 
                      background: `hsl(${themeOption.colors.primary})`,
                      borderRadius: themeOption.sizing.buttonRadius,
                    }}
                  >
                    Button
                  </div>
                  <div 
                    className="text-xs rounded-full shadow-sm py-1 px-2 bg-gray-100"
                    style={{ 
                      borderRadius: themeOption.sizing.buttonRadius,
                    }}
                  >
                    Pill
                  </div>
                </div>
                
                {/* Preview Theme Button */}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      // Get the property slug from the URL
                      const urlParts = window.location.pathname.split('/');
                      const propertiesIndex = urlParts.findIndex(part => part === 'properties');
                      const propertySlug = urlParts[propertiesIndex + 1];
                      
                      if (propertySlug) {
                        // Open property page with theme preview parameter
                        window.open(`/properties/${propertySlug}?preview_theme=${themeOption.id}`, '_blank');
                      }
                    }}
                    className="text-xs w-full py-1.5 px-2 rounded border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    Preview Theme
                  </button>
                </div>
              </CardContent>
            </Card>
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
```

### 5.2 Theme Preview System

The theme preview system allows property owners to see how their property website would look with different themes without changing their saved settings. This feature is implemented in the property page renderer:

```typescript
// Excerpt from src/components/property/property-page-renderer.tsx

export function PropertyPageRenderer({
  template,
  overrides,
  propertyName,
  propertySlug,
  pageName,
  themeId = DEFAULT_THEME_ID,
}: PropertyPageRendererProps) {
  const [isClient, setIsClient] = useState(false);
  const [effectiveThemeId, setEffectiveThemeId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  // Initialize state on client-side only to avoid hydration issues
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Handle theme selection based on URL parameter or prop
  useEffect(() => {
    if (!isClient) return;
    
    try {
      const url = new URL(window.location.href);
      const previewTheme = url.searchParams.get('preview_theme');
      
      if (previewTheme) {
        console.log(`[Theme Preview] Setting preview theme: ${previewTheme}`);
        
        // Validate that the theme exists
        const themeExists = predefinedThemes.some(t => t.id === previewTheme);
        if (themeExists) {
          setEffectiveThemeId(previewTheme);
          setIsPreviewMode(true);
        } else {
          console.error(`[Theme Error] Theme with ID "${previewTheme}" not found in predefined themes`);
          setEffectiveThemeId(themeId);
          setIsPreviewMode(false);
        }
      } else {
        console.log(`[Theme Preview] Using default theme: ${themeId}`);
        setEffectiveThemeId(themeId);
        setIsPreviewMode(false);
      }
    } catch (error) {
      console.error('[Theme Error]', error);
      setEffectiveThemeId(themeId);
      setIsPreviewMode(false);
    }
  }, [themeId, isClient]);

  // In the render function
  return (
    <ThemeProvider initialThemeId={effectiveThemeId}>
      <div className="flex min-h-screen flex-col">
        <Header 
          propertyName={propertyName} 
          propertySlug={propertySlug} 
          menuItems={menuItems}
          logoSrc={logoSrc}
          logoAlt={logoAlt}
        />
        
        {/* Space for fixed header */}
        <div className="h-16"></div>
        
        {/* Theme Preview Banner */}
        {isPreviewMode && (
          <div 
            className="w-full bg-primary text-primary-foreground text-center text-sm py-2 px-4"
            id="theme-preview-banner"
          >
            <span className="font-medium">Theme Preview:</span> You are viewing the <strong className="font-semibold">{predefinedThemes.find(t => t.id === effectiveThemeId)?.name || effectiveThemeId}</strong> theme
            <div className="flex gap-2 justify-center mt-1">
              <button 
                onClick={() => window.location.reload()}
                className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-xs font-medium"
              >
                Reload Preview
              </button>
              <button 
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('preview_theme');
                  window.location.href = url.toString();
                }}
                className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-xs font-medium"
              >
                Exit Preview
              </button>
            </div>
          </div>
        )}
        
        {/* Main Content */}
        <main className="flex-grow" id="main-content">
          {templatePage.blocks.map(renderBlock)}
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  );
}
```

## 6. Property Form Integration

The theme selector is integrated into the property form:

```tsx
// src/app/admin/properties/_components/property-form.tsx (excerpt)

import { ThemeSelector } from "@/components/ui/theme-selector";
import { DEFAULT_THEME_ID } from "@/lib/themes/theme-definitions";

// ...

// In defaultValues
defaultValues: {
  // ...other fields
  themeId: initialData?.themeId ?? DEFAULT_THEME_ID,
  // ...other fields
}

// In the JSX form
<Separator className="my-6" />
<h3 className="text-lg font-medium border-b pb-2">Website Theme</h3>
<FormField
  control={form.control}
  name="themeId"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Choose a design theme for your property website</FormLabel>
      <FormControl>
        <ThemeSelector
          selectedThemeId={field.value}
          onThemeChange={field.onChange}
        />
      </FormControl>
      <FormDescription>
        The selected theme will determine the colors, typography, and styling of your property website.
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

## 7. Timestamp Serialization

When working with Firestore data in Next.js server components, we needed to handle timestamp serialization to prevent errors:

```typescript
// src/lib/property-utils.ts (excerpt)

/**
 * Helper function to serialize timestamps in a property object for client components
 * @param property The property object containing potential timestamp fields
 * @returns A new object with all timestamps serialized to ISO strings
 */
export function serializePropertyTimestamps(property: Property): Property {
  if (!property) return property;
  
  const result = { ...property };
  
  // Helper function to serialize a single timestamp
  const serializeTimestamp = (timestamp: SerializableTimestamp | undefined | null): string | null => {
    if (!timestamp) return null;
    if (timestamp instanceof Timestamp) return timestamp.toDate().toISOString();
    if (timestamp instanceof Date) return timestamp.toISOString();
    if (typeof timestamp === 'string') return timestamp;
    
    // Handle Firestore-like objects with seconds and nanoseconds
    if (typeof timestamp === 'object' && 
        ('seconds' in timestamp || '_seconds' in timestamp) && 
        ('nanoseconds' in timestamp || '_nanoseconds' in timestamp)) {
      try {
        const seconds = Number('seconds' in timestamp ? timestamp.seconds : timestamp._seconds);
        const nanoseconds = Number('nanoseconds' in timestamp ? timestamp.nanoseconds : timestamp._nanoseconds);
        if (!isNaN(seconds) && !isNaN(nanoseconds)) {
          return new Date(seconds * 1000 + nanoseconds / 1000000).toISOString();
        }
      } catch (error) {
        console.error("Error converting timestamp:", error);
        return null;
      }
    }
    
    // Last resort - try as is
    try {
      return new Date(timestamp as any).toISOString();
    } catch (error) {
      console.error("Invalid timestamp format:", timestamp);
      return null;
    }
  };
  
  // Serialize specific timestamp fields
  if (result.createdAt) result.createdAt = serializeTimestamp(result.createdAt);
  if (result.updatedAt) result.updatedAt = serializeTimestamp(result.updatedAt);
  
  return result;
}

/**
 * Retrieves property data by slug from Firestore
 * @param slug The property slug
 * @param serializeTimestamps Whether to serialize timestamps to ISO strings (default true)
 * @returns The property data or null if not found
 */
export async function getPropertyBySlug(
  slug: string, 
  serializeTimestamps: boolean = true
): Promise<Property | null> {
  // ... existing implementation
  
  // Serialize timestamps if needed
  return serializeTimestamps ? serializePropertyTimestamps(property) : property;
}
```

## 8. Property Page Integration

The theme is applied to property pages through the ThemeProvider:

```tsx
// src/components/property/property-page-renderer.tsx (excerpt)

import { ThemeProvider } from '@/contexts/ThemeContext';
import { DEFAULT_THEME_ID } from '@/lib/themes/theme-definitions';

// In the component interface
interface PropertyPageRendererProps {
  template: WebsiteTemplate;
  overrides: PropertyOverrides;
  propertyName: string;
  propertySlug: string;
  pageName: string; // Which page to render (e.g., homepage, details, etc.)
  themeId?: string; // The theme ID to use for this property
}

// In the renderer component
export function PropertyPageRenderer({
  template,
  overrides,
  propertyName,
  propertySlug,
  pageName,
  themeId = DEFAULT_THEME_ID,
}: PropertyPageRendererProps) {
  // ...existing implementation
  
  return (
    <ThemeProvider initialThemeId={themeId}>
      <div className="flex min-h-screen flex-col">
        <Header 
          propertyName={propertyName} 
          propertySlug={propertySlug} 
          menuItems={menuItems}
          logoSrc={logoSrc}
          logoAlt={logoAlt}
        />
        <main className="flex-grow pt-16">
          {templatePage.blocks.map(renderBlock)}
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  );
}
```

## 9. Firestore Integration

The theme ID is stored in the property document in Firestore. We updated the Firestore security rules to allow updating the themeId field:

```
// In firestore.rules
match /properties/{propertySlug} {
  allow read: if true; // Publicly readable
  allow create, update, delete: if isOwner(propertySlug) || isAdmin();
}
```

## 10. Technical Decisions & Implementation Notes

1. **CSS Variables vs. Component Props**
   - We chose CSS variables for theme application because they allow seamless integration with Tailwind CSS and provide better performance than prop-based styling.

2. **Client vs. Server Components**
   - The theme system is designed to work with both client and server components. The ThemeProvider is a client component, but it can be used in server components as a wrapper.

3. **Timestamp Serialization**
   - Firestore timestamps are converted to ISO strings before being passed to client components to prevent "Only plain objects can be passed to Client Components from Server Components" errors.

4. **Theme Selector UI Enhancements**
   - The ThemeSelector component includes extensive visual feedback to make the currently selected theme obvious and show which theme is being hovered.
   - Visual indicators include checkmarks, labels, borders, scaling, and shadow effects.

5. **Fallback Theme**
   - A default theme (Airbnb) is used if no theme ID is specified or if the specified theme ID doesn't match any predefined theme.

6. **Font Loading**
   - Fonts are loaded dynamically when a theme is applied, ensuring that the typography matches the selected theme without requiring all fonts to be loaded upfront.

7. **Theme Persistence**
   - The selected theme ID is stored in the property document in Firestore, ensuring that the theme is applied consistently across all pages and for all users.

## 11. Conclusion

The theme system provides a flexible and efficient way for property owners to customize the visual appearance of their property websites. By storing only the theme ID in the database and defining the themes in code, we maintain a small storage footprint while providing rich customization options.

The system is designed to be maintainable, with clear separation of concerns and well-defined interfaces. New themes can be added easily by creating new theme definition objects and adding them to the predefined themes array.