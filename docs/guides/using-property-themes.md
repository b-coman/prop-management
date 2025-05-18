# Using Property Themes

This guide explains how to use the property theme system in RentalSpot Builder to customize the look and feel of your property websites.

## Overview of the Theme System

The RentalSpot Builder uses a robust theme system centered around the `ThemeContext`, which provides:

- **Pre-defined themes** with distinct visual styles
- **Dynamic theme switching** for different properties
- **CSS variable integration** for consistent styling
- **Font and typography management**
- **Component-specific styling rules**

## Architecture

The theme system consists of several key components:

```
src/
  contexts/
    ThemeContext.tsx    # Main context provider for theme management
  lib/
    themes/
      theme-types.ts    # TypeScript interfaces for themes
      theme-definitions.ts  # Pre-defined theme configurations
      theme-utils.ts    # Utility functions for theme manipulation
    theme-utils.ts      # Additional theme utilities (HSL color handling)
  components/
    ui/
      theme-selector.tsx   # Admin UI for theme selection
    theme-switcher.tsx     # Development tool for testing themes
```

## Available Themes

RentalSpot Builder includes five professionally designed themes:

### 1. Airbnb Theme (Default)
- **ID**: `airbnb`
- **Description**: Clean modern design with Airbnb's signature pink accent
- **Primary Color**: Pink (#FF385C)
- **Font**: Inter (sans-serif)
- **Style**: Minimal with subtle shadows

### 2. Ocean Blue
- **ID**: `ocean`
- **Description**: Calming blues inspired by coastal destinations
- **Primary Color**: Blue (#00A0F0)
- **Font**: Montserrat (sans-serif)
- **Style**: Rounded corners, prominent shadows

### 3. Forest Green
- **ID**: `forest`
- **Description**: Natural, earthy greens for a calming atmosphere
- **Primary Color**: Green (#3B9A63)
- **Font**: Lora (serif)
- **Style**: Square corners, minimal shadows

### 4. Modern Minimal
- **ID**: `modern`
- **Description**: Clean, minimal design with ample whitespace
- **Primary Color**: Bright Blue (#0078FF)
- **Font**: DM Sans (sans-serif)
- **Style**: Spacious layout, subtle shadows

### 5. Luxury Estate
- **ID**: `luxury`
- **Description**: Sophisticated dark design with gold accents
- **Primary Color**: Gold (#FFC000)
- **Font**: Playfair Display (serif)
- **Style**: Dark backgrounds, sharp corners

## How Themes Work

### 1. Theme Structure

Each theme defines:

```typescript
interface Theme {
  id: string;              // Unique identifier
  name: string;            // Display name
  description: string;     // Brief description
  colors: ThemeColors;     // Color definitions
  typography: ThemeTypography; // Typography settings
  sizing: ThemeSizing;     // Size and spacing settings
  components: ThemeComponents; // Component-specific styling
  previewImage: string;    // Path to preview image
}
```

### 2. Color System

Colors are defined in HSL format for better manipulation:

```typescript
colors: {
  background: "0 0% 100%",    // White
  foreground: "240 10% 3.9%", // Almost black
  primary: "358 100% 62%",    // Airbnb pink
  secondary: "240 4.8% 95.9%", // Light gray
  accent: "358 100% 67%",     // Accent color
  muted: "240 4.8% 95.9%",    // Muted backgrounds
  border: "240 5.9% 90%",     // Border color
}
```

### 3. Typography

Each theme specifies:

```typescript
typography: {
  fontFamily: "'Inter', sans-serif",
  fontFamilyUrl: "https://fonts.googleapis.com/...",
  headingWeight: 600,
  bodyWeight: 400,
}
```

### 4. Component Styling

Themes define specific styles for UI components:

```typescript
components: {
  button: {
    padding: "0.625rem 1.25rem",
    shadow: "none",
    hoverEffect: "darken",
  },
  card: {
    shadow: "0 1px 3px rgba(0,0,0,0.12)",
    borderWidth: "1px",
    padding: "1.5rem",
  },
  // ... more components
}
```

## Property-Specific Theme Configuration

### 1. Setting Theme in Admin Interface

When creating or editing a property:

1. Navigate to the property form in the admin panel
2. Locate the "Website Theme" section
3. Use the `ThemeSelector` component to choose a theme
4. Preview the theme before saving

### 2. Storing Theme Configuration

Properties store their theme ID in the `themeId` field:

```typescript
interface Property {
  // ... other fields
  themeId?: string;  // Theme identifier
}
```

### 3. Loading Theme for Property Pages

The theme is loaded in the property page renderer:

```tsx
<PropertyPageRenderer
  template={template}
  overrides={overrides}
  propertyName={property.name}
  propertySlug={slug}
  pageName="homepage"
  themeId={property.themeId}  // Pass theme ID
/>
```

## Theme Customization Options

### 1. Using CSS Variables

Themes apply CSS variables that can be used throughout the application:

```css
/* Example usage in components */
.my-component {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border));
}

.primary-button {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}
```

### 2. Dynamic Color Manipulation

Use theme utilities for dynamic color adjustments:

```typescript
import { getHSLFromCSSVariable, modifyHSL, hslToString } from '@/lib/theme-utils';

// Get primary color and make it darker
const primaryColor = getHSLFromCSSVariable('primary');
const darkerPrimary = modifyHSL(primaryColor, { l: primaryColor.l - 10 });
const colorString = hslToString(darkerPrimary);
```

### 3. Component-Level Theming

Components can access the current theme:

```tsx
import { useTheme } from '@/contexts/ThemeContext';

function MyComponent() {
  const { theme } = useTheme();
  
  return (
    <div style={{
      fontFamily: theme.typography.fontFamily,
      borderRadius: theme.sizing.borderRadius,
    }}>
      Themed content
    </div>
  );
}
```

## Integration with Header Positioning

The theme system integrates with header behavior to create cohesive designs:

### 1. Transparent Header Effect

When not scrolled, headers adapt to the theme's primary color:

```typescript
// Applied dynamically in theme-utils.ts
header {
  background-color: hsla(primary-color, 0.7);
  backdrop-filter: blur(4px);
}
```

### 2. Text Color Adaptation

Headers automatically adjust text color based on theme brightness:

- Light themes → Dark text
- Dark themes → Light text

### 3. Hero Section Integration

Hero sections work with the theme system:

```tsx
<section className="has-transparent-header slides-under-header">
  {/* Hero content */}
</section>
```

## CSS Variables and Styling

### Core CSS Variables

Themes set these root variables:

```css
:root {
  /* Colors */
  --background: /* theme value */;
  --foreground: /* theme value */;
  --primary: /* theme value */;
  --secondary: /* theme value */;
  --accent: /* theme value */;
  --muted: /* theme value */;
  --border: /* theme value */;
  
  /* Typography */
  --font-family: /* theme value */;
  
  /* Sizing */
  --radius: /* theme value */;
  --button-radius: /* theme value */;
  --card-radius: /* theme value */;
  --input-radius: /* theme value */;
  --spacing: /* theme value */;
  
  /* Components */
  --button-padding: /* theme value */;
  --button-shadow: /* theme value */;
  --card-shadow: /* theme value */;
  --card-border-width: /* theme value */;
  --card-padding: /* theme value */;
  --input-border-width: /* theme value */;
  --input-padding: /* theme value */;
}
```

### Using Variables in Tailwind

Tailwind classes automatically use theme variables:

```tsx
<div className="bg-background text-foreground border-border">
  <button className="bg-primary text-primary-foreground rounded-[var(--button-radius)]">
    Themed Button
  </button>
</div>
```

## Theme Selection in Admin Interface

### 1. ThemeSelector Component

The admin interface provides a visual theme selector:

- Grid layout with theme previews
- Live preview of colors and typography
- Instant visual feedback on selection
- Preview button to test themes on property pages

### 2. Theme Preview Mode

Test themes before committing:

```typescript
// Append to property URL for preview
/properties/my-property?preview_theme=ocean
```

Features:
- Non-destructive preview
- Preview banner indicator
- Easy exit from preview mode

## Examples of Theme Usage

### 1. Basic Property Setup

```typescript
// In property creation/update
const propertyData = {
  name: "Mountain Retreat",
  slug: "mountain-retreat",
  themeId: "forest", // Select forest theme
  // ... other properties
};
```

### 2. Conditional Styling

```tsx
function PropertyCard({ property }) {
  const isDarkTheme = property.themeId === 'luxury';
  
  return (
    <Card className={isDarkTheme ? 'bg-black text-white' : ''}>
      {/* Card content */}
    </Card>
  );
}
```

### 3. Dynamic Theme Loading

```tsx
// In PropertyPageRenderer
const [effectiveThemeId, setEffectiveThemeId] = useState(property.themeId);

// Support preview parameter
useEffect(() => {
  const url = new URL(window.location.href);
  const previewTheme = url.searchParams.get('preview_theme');
  
  if (previewTheme && predefinedThemes.find(t => t.id === previewTheme)) {
    setEffectiveThemeId(previewTheme);
  }
}, []);
```

## Best Practices for Theme Implementation

### 1. Always Use CSS Variables

```css
/* Good */
.component {
  background: hsl(var(--primary));
}

/* Avoid */
.component {
  background: #FF385C; /* Hard-coded color */
}
```

### 2. Respect Theme Typography

```tsx
// Use theme fonts
<h1 style={{ fontFamily: 'var(--font-family)' }}>
  Heading
</h1>
```

### 3. Handle Theme Transitions

```css
/* Smooth theme transitions */
* {
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

### 4. Test All Themes

Always test components with all available themes:

```typescript
const themes = ['airbnb', 'ocean', 'forest', 'modern', 'luxury'];
themes.forEach(theme => {
  // Test with each theme
});
```

### 5. Consider Accessibility

Ensure sufficient contrast ratios across all themes:

```typescript
// Use theme utilities to check contrast
const bgColor = getHSLFromCSSVariable('background');
const fgColor = getHSLFromCSSVariable('foreground');
// Verify contrast ratio meets WCAG standards
```

## How Themes Affect Hero Sections and Headers

### 1. Hero Section Styling

Hero sections adapt to the current theme:

- Background overlays use theme colors
- Text automatically adjusts for readability
- Booking forms inherit theme styling

### 2. Header Behavior

Headers dynamically respond to themes:

- **Transparent mode**: Uses theme primary color with transparency
- **Scrolled mode**: Reverts to default styling
- **Logo adaptation**: Adjusts based on background lightness

### 3. Navigation Elements

Navigation components respect theme settings:

```tsx
// Currency switcher adapts to theme
<Select data-theme-aware="true">
  {/* Options */}
</Select>
```

## Troubleshooting

### Common Issues

1. **Theme not applying**: Check that `ThemeProvider` wraps your component
2. **Colors look wrong**: Verify HSL format (no commas in CSS variables)
3. **Fonts not loading**: Ensure Google Fonts URL is accessible
4. **Preview not working**: Confirm theme ID exists in `predefinedThemes`

### Debugging Tips

```typescript
// Log current theme
const { theme } = useTheme();
console.log('Current theme:', theme);

// Check applied CSS variables
const styles = getComputedStyle(document.documentElement);
console.log('Primary color:', styles.getPropertyValue('--primary'));
```

## Extending the Theme System

### Adding New Themes

1. Define the theme in `theme-definitions.ts`:

```typescript
export const myCustomTheme: Theme = {
  id: "custom",
  name: "My Custom Theme",
  // ... theme configuration
};
```

2. Add to `predefinedThemes` array:

```typescript
export const predefinedThemes: Theme[] = [
  // ... existing themes
  myCustomTheme,
];
```

### Custom Theme Properties

Extend the `Theme` interface for additional properties:

```typescript
interface CustomTheme extends Theme {
  animations?: {
    duration: string;
    easing: string;
  };
}
```

## Conclusion

The RentalSpot Builder theme system provides powerful customization options while maintaining consistency across property websites. By following these guidelines, you can effectively use themes to create unique, professional-looking property pages that align with your brand identity.

For more technical details, refer to:
- `/src/lib/themes/` - Theme implementation files
- `/src/contexts/ThemeContext.tsx` - Theme context provider
- `/docs/implementation/theme-system-implementation.md` - Implementation details