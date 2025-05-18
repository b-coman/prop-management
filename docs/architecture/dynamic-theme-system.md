# Dynamic Theme System - RentalSpot Builder

## 📌 Purpose

The Dynamic Theme System allows property owners to customize the visual appearance of their property websites by selecting from predefined themes. This enhances brand differentiation while maintaining a consistent and professional user experience. The system controls colors, typography, spacing, border radii, and component styling through a centralized theme definition structure.

This document defines the architecture, implementation, and usage of the theming system within RentalSpot.

---

## 🎨 1. **Theme System Overview**

The theme system allows customization of:

- **Colors:** Primary, secondary, accent, and UI element colors
- **Typography:** Font families, weights, and sizes
- **Border Radii:** Rounded corners for cards, buttons, and UI elements
- **Spacing Scales:** Consistent spacing for padding and margins
- **Component Styling:** Button appearances, card designs, input fields

Key features:

- **Predefined Themes:** A set of professionally designed themes that property owners can select from
- **Dynamic Application:** Themes are applied at runtime using CSS variables
- **Component Integration:** UI components automatically adapt to the selected theme
- **Property-Specific:** Each property can have its own theme
- **Maintainer Extendable:** New themes can be easily added by developers

Implementation approach:

- **CSS Variables:** Theme values are applied as CSS variables at the document root
- **Tailwind Integration:** Works with the existing Tailwind CSS setup
- **Minimal Database Footprint:** Only the theme ID is stored in the property document
- **Server Components Compatible:** Works with both client and server components
- **Performance Optimized:** No theme flickering during page load

---

## 🗂️ 2. **Theme Definition Structure**

Each theme is defined as a TypeScript object following a consistent structure:

```typescript
// src/lib/themes/theme-definitions.ts

export interface Theme {
  id: string;              // Unique identifier
  name: string;            // Display name
  description: string;     // Brief description
  // Colors
  colors: {
    background: string;    // Main background (HSL format for CSS variables)
    foreground: string;    // Main text color
    primary: string;       // Primary action/brand color
    secondary: string;     // Secondary UI color
    accent: string;        // Highlight/accent color
    muted: string;         // Subdued background
    border: string;        // Border color
  };
  // Typography
  typography: {
    fontFamily: string;    // Main font family
    fontFamilyUrl: string; // Google Fonts URL
    headingWeight: number; // Font weight for headings
    bodyWeight: number;    // Font weight for body text
  };
  // Sizing and spacing
  sizing: {
    borderRadius: string;  // Default border radius
    buttonRadius: string;  // Button-specific radius
    cardRadius: string;    // Card-specific radius
    inputRadius: string;   // Input-specific radius
    spacing: string;       // Base spacing unit
  };
  // Component styling
  components: {
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
  };
  // Preview image
  previewImage: string;
}
```

### Example Theme Definition

```typescript
// Example of the Airbnb-inspired theme
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
```

### Collection of Predefined Themes

The system includes multiple predefined themes:

```typescript
// Export all available themes in an array
export const predefinedThemes: Theme[] = [
  airbnbTheme,
  oceanTheme,
  forestTheme,
  modernTheme,
  // Additional themes can be added here
];

// Helper function to get a theme by ID
export function getThemeById(id: string): Theme {
  return predefinedThemes.find(theme => theme.id === id) || airbnbTheme;
}
```

---

## 💾 3. **Theme Storage and Application**

### Storage in Firestore

Only the theme ID is stored in the property document, not the entire theme definition:

```javascript
// Example property document in Firestore
{
  "name": "Prahova Mountain Chalet",
  "slug": "prahova-mountain-chalet",
  "description": "Cozy mountain retreat with amazing views",
  "themeId": "forest",  // <- This is the only theme data stored
  "location": { ... },
  "amenities": [ ... ],
  // Other property fields
}
```

### Theme Provider Component

A React context provider applies the selected theme:

```typescript
// src/contexts/ThemeContext.tsx
"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Theme, getThemeById } from "@/lib/themes/theme-definitions";

type ThemeContextType = {
  theme: Theme;
  setTheme: (id: string) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ 
  children, 
  initialThemeId = "airbnb" 
}: { 
  children: ReactNode; 
  initialThemeId?: string;
}) {
  const [theme, setThemeState] = useState<Theme>(getThemeById(initialThemeId));
  
  const setTheme = (id: string) => {
    const newTheme = getThemeById(id);
    setThemeState(newTheme);
    localStorage.setItem("theme", id);
  };
  
  // Apply theme when it changes
  useEffect(() => {
    // Apply CSS variables to document root
    const root = document.documentElement;
    
    // Set color variables
    root.style.setProperty("--background", theme.colors.background);
    root.style.setProperty("--foreground", theme.colors.foreground);
    root.style.setProperty("--primary", theme.colors.primary);
    root.style.setProperty("--secondary", theme.colors.secondary);
    root.style.setProperty("--accent", theme.colors.accent);
    root.style.setProperty("--muted", theme.colors.muted);
    root.style.setProperty("--border", theme.colors.border);
    
    // Set typography variables
    root.style.setProperty("--font-family", theme.typography.fontFamily);
    
    // Set sizing variables
    root.style.setProperty("--radius", theme.sizing.borderRadius);
    root.style.setProperty("--button-radius", theme.sizing.buttonRadius);
    root.style.setProperty("--card-radius", theme.sizing.cardRadius);
    root.style.setProperty("--input-radius", theme.sizing.inputRadius);
    root.style.setProperty("--spacing", theme.sizing.spacing);
    
    // Set component-specific variables
    root.style.setProperty("--button-padding", theme.components.button.padding);
    root.style.setProperty("--button-shadow", theme.components.button.shadow);
    root.style.setProperty("--card-shadow", theme.components.card.shadow);
    root.style.setProperty("--card-border-width", theme.components.card.borderWidth);
    root.style.setProperty("--card-padding", theme.components.card.padding);
    root.style.setProperty("--input-border-width", theme.components.input.borderWidth);
    root.style.setProperty("--input-padding", theme.components.input.padding);
    
    // Load font if needed
    const fontLink = document.getElementById("theme-font");
    if (fontLink) {
      document.head.removeChild(fontLink);
    }
    
    const link = document.createElement("link");
    link.id = "theme-font";
    link.rel = "stylesheet";
    link.href = theme.typography.fontFamilyUrl;
    document.head.appendChild(link);
    
  }, [theme]);
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
```

### Usage in Property Pages

The theme provider wraps the property page components, applying the property's selected theme:

```tsx
// In src/app/properties/[slug]/page.tsx
import { ThemeProvider } from "@/contexts/ThemeContext";

// Inside the component, after fetching property data
return (
  <ThemeProvider initialThemeId={property.themeId || "airbnb"}>
    <div className="min-h-screen bg-background text-foreground">
      {/* Property content */}
      <Header />
      <main>
        {/* Other components */}
      </main>
      <Footer />
    </div>
  </ThemeProvider>
);
```

---

## 🔧 4. **Tailwind Integration**

The theme system integrates with Tailwind CSS by using CSS variables that Tailwind references:

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    // ...content config
  ],
  theme: {
    extend: {
      colors: {
        // Direct color definitions are maintained for backward compatibility
        'airbnb-red': '#FF5A5F',
        'airbnb-pink': '#FF385C',
        'airbnb-dark-gray': '#222222',
        'airbnb-light-gray': '#717171',
        
        // Dynamic theme colors from CSS variables
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(0 0% 100%)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(0 0% 100%)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--foreground))',
        },
        border: 'hsl(var(--border))',
      },
      borderRadius: {
        'airbnb': '32px', // Maintained for backward compatibility
        DEFAULT: 'var(--radius)',
        sm: 'calc(var(--radius) - 0.125rem)',
        md: 'calc(var(--radius) - 0.0625rem)',
        lg: 'calc(var(--radius) + 0.0625rem)',
        xl: 'calc(var(--radius) + 0.125rem)',
        button: 'var(--button-radius)',
        card: 'var(--card-radius)',
        input: 'var(--input-radius)',
      },
      fontFamily: {
        sans: ['var(--font-family)', 'sans-serif'],
      },
      boxShadow: {
        button: 'var(--button-shadow)',
        card: 'var(--card-shadow)',
      },
      padding: {
        button: 'var(--button-padding)',
        card: 'var(--card-padding)',
        input: 'var(--input-padding)',
      },
      borderWidth: {
        card: 'var(--card-border-width)',
        input: 'var(--input-border-width)',
      },
      // Other extensions...
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

In component JSX, these Tailwind classes are used as normal:

```jsx
<button className="bg-primary text-white rounded-button shadow-button p-button">
  Book Now
</button>

<div className="bg-background text-foreground p-4">
  <div className="bg-muted rounded-card shadow-card p-card border border-card">
    Property content
  </div>
</div>

<input 
  className="border border-input rounded-input p-input focus:border-primary"
  type="text" 
  placeholder="Enter your name"
/>
```

---

## 🖥️ 5. **Theme Selection for Property Owners**

Property owners select a theme through the admin interface:

### Theme Selector Component

```tsx
// src/components/ui/theme-selector.tsx
"use client"

import { useState } from "react";
import Image from "next/image";
import { useTheme } from "@/contexts/ThemeContext";
import { predefinedThemes } from "@/lib/themes/theme-definitions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface ThemeSelectorProps {
  selectedThemeId: string;
  onThemeChange: (id: string) => void;
}

export function ThemeSelector({ selectedThemeId, onThemeChange }: ThemeSelectorProps) {
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
          <Label htmlFor={themeOption.id} className="cursor-pointer">
            <Card className={`overflow-hidden ${selectedThemeId === themeOption.id ? 'ring-2 ring-primary' : ''}`}>
              <div className="aspect-video relative">
                <Image 
                  src={themeOption.previewImage}
                  alt={themeOption.name}
                  fill
                  className="object-cover"
                />
              </div>
              <CardHeader>
                <h3 className="font-medium">{themeOption.name}</h3>
                <p className="text-sm text-muted-foreground">{themeOption.description}</p>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex gap-2">
                  <div 
                    className="w-6 h-6 rounded-full" 
                    style={{ backgroundColor: `hsl(${themeOption.colors.primary})` }}
                  />
                  <div 
                    className="w-6 h-6 rounded-full" 
                    style={{ backgroundColor: `hsl(${themeOption.colors.accent})` }}
                  />
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

### Property Form Integration

The theme selector is integrated into the property edit form:

```tsx
// In src/app/admin/properties/[slug]/edit/page.tsx or the property form component
import { ThemeSelector } from "@/components/ui/theme-selector";
import { useState } from "react";

// Inside the form component
const [formData, setFormData] = useState({
  // ...other property fields
  themeId: property.themeId || "airbnb",
});

// In the JSX
<div className="space-y-4 mt-8">
  <h2 className="text-xl font-semibold">Website Style</h2>
  <p className="text-muted-foreground">Choose a design style for your property website</p>
  <ThemeSelector 
    selectedThemeId={formData.themeId} 
    onThemeChange={(id) => setFormData({...formData, themeId: id})}
  />
</div>
```

### Server Action for Saving Theme Choice

When a property is updated, the theme ID is saved to Firestore:

```typescript
// In src/app/admin/properties/actions.ts
export async function updateProperty(propertyData) {
  try {
    const propertyRef = doc(db, 'properties', propertyData.id);
    
    await updateDoc(propertyRef, {
      // ...other property fields
      themeId: propertyData.themeId,
      updatedAt: serverTimestamp(),
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error updating property:", error);
    return { success: false, error: error.message };
  }
}
```

---

## 🧩 6. **Component Style Adaptation**

UI components use the theme values:

### Button Component Example

```tsx
// src/components/ui/button.tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-button text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary/90 shadow-button",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "p-button",
        sm: "h-9 px-3 py-2 text-xs",
        lg: "h-11 px-8 py-3 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

### Card Component Example

```tsx
// src/components/ui/card.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-card shadow-card border border-card bg-card text-card-foreground p-card",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

// ... other card subcomponents
```

### Input Component Example

```tsx
// src/components/ui/input.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-input border border-input bg-background p-input text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
```

---

## 📁 7. **Adding New Themes (For Maintainers)**

To add a new theme:

1. Create a new theme object in `src/lib/themes/theme-definitions.ts`:

```typescript
// New theme example
export const luxuryTheme: Theme = {
  id: "luxury",
  name: "Luxury Estate",
  description: "Sophisticated dark design with gold accents for upscale properties",
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
    spacing: "1.25rem",              // Slightly larger spacing (20px)
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
```

2. Add the theme to the `predefinedThemes` array:

```typescript
export const predefinedThemes: Theme[] = [
  airbnbTheme,
  oceanTheme,
  forestTheme,
  // Add your new theme here
  luxuryTheme,
];
```

3. Create a preview image and add it to the `/public/images/themes/` directory.

4. Test the theme by selecting it in the admin interface for a property.

---

## 🛠️ 8. **Implementation Timeline**

The dynamic theme system implementation is divided into phases:

| Phase | Description | Duration |
|-------|-------------|----------|
| 1 | Theme Definition & Structure | 2-3 days |
| 2 | Theme Provider & CSS Integration | 2-3 days |
| 3 | Admin UI for Theme Selection | 1-2 days |
| 4 | Component Adaptation & Testing | 3-4 days |
| | **Total** | **8-12 days** |

### Detailed breakdown:

1. **Theme Definition & Structure** (2-3 days)
   - Create `/src/lib/themes/` directory structure
   - Define theme interface types
   - Create base predefined themes
   - Set up Firestore property schema update

2. **Theme Provider & CSS Integration** (2-3 days)
   - Create ThemeContext provider
   - Implement CSS variable application
   - Update Tailwind configuration
   - Create theme utility functions

3. **Admin UI for Theme Selection** (1-2 days)
   - Create ThemeSelector component
   - Integrate with property edit form
   - Update server action for saving theme ID

4. **Component Adaptation & Testing** (3-4 days)
   - Update base UI components to use theme variables
   - Test on multiple properties with different themes
   - Create theme preview images
   - Fix any edge cases and inconsistencies

---

## 🔍 9. **Future Enhancements**

Potential future improvements for the theme system:

1. **Dark Mode Toggle:** Allow toggling between light and dark versions of the same theme.

2. **Theme Editor:** Create a visual editor for properties to customize specific theme aspects within limits.

3. **Custom Colors:** Allow property owners to select custom primary colors while maintaining design cohesion.

4. **Theme Marketplace:** Allow third-party designers to submit themes for the platform.

5. **AI Theme Suggestions:** Use AI to suggest themes based on property photos or description.

6. **Seasonal Themes:** Allow properties to schedule different themes for different seasons or events.

7. **Analytics Integration:** Track conversion rates per theme to suggest higher-performing options.

---

## 📋 10. **Documentation and Best Practices**

### When using the theme system:

1. **Always use Tailwind classes** based on theme variables instead of hardcoding colors.

2. **Test components with multiple themes** to ensure they look good with different color schemes and typography.

3. **Add an appropriate preview image** for each new theme to help property owners visualize the style.

4. **Keep consistent spacing** by using the theme spacing variables.

5. **Validate color contrast** for accessibility with each theme, especially for text on colored backgrounds.

6. **Use semantic color names** in components (e.g., `bg-primary` not `bg-red-500`).

7. **Follow the theme structure** when adding new themes to ensure all necessary variables are defined.