# Using Page Headers Guide

This guide covers how to use and customize page headers in the RentalSpot Builder application. Page headers provide visual section breaks and titles for different pages in a multi-page property layout.

## Basic Usage

The `PageHeader` component is used to display page titles with optional background images. It works seamlessly with the fixed transparent header system to ensure proper positioning and visual appearance.

```tsx
import { PageHeader } from '@/components/property/page-header';
import { PageHeaderBlock } from '@/lib/overridesSchemas-multipage';

// Basic usage
const headerContent: PageHeaderBlock = {
  title: "Property Details",
  subtitle: "Discover everything about your perfect vacation home",
  backgroundImage: "/images/property-hero.jpg"
};

<PageHeader content={headerContent} />
```

## Properties and Configuration

The `PageHeader` component accepts a single `content` prop with the following structure:

```typescript
interface PageHeaderBlock {
  title: string;               // Main title of the page
  subtitle?: string;           // Optional subtitle for additional context
  backgroundImage?: string;    // Optional background image URL
  overlay?: boolean;           // Whether to apply dark overlay (defaults to true)
  customClasses?: string;      // Additional CSS classes for styling
}
```

### Property Descriptions

- **title**: The main heading displayed in the page header
- **subtitle**: Additional descriptive text below the title
- **backgroundImage**: URL for a background image (absolute or relative path)
- **overlay**: Controls the dark overlay for better text readability
- **customClasses**: CSS classes for custom styling

## Dynamic Positioning System

The page header uses a sophisticated positioning system that ensures content displays correctly with the fixed transparent header.

### How It Works

1. **Automatic Header Detection**: The system detects the fixed header height
2. **Content Centering**: Title and subtitle are vertically centered in the visible area
3. **Responsive Adjustments**: Positioning updates on window resize and font loading
4. **Performance Optimized**: Uses ResizeObserver and requestAnimationFrame for smooth updates

### Implementation Details

The positioning is handled by `page-header-helper.ts`:

```typescript
// The system automatically:
// 1. Measures the header height
// 2. Calculates available space
// 3. Centers content in the visible area
// 4. Adjusts for mobile devices
// 5. Updates on resize/font load
```

## Integration with Fixed Header

The page header is designed to work with the fixed navigation header using the `slides-under-header` class.

### CSS Classes

```css
/* The header includes these classes */
.has-transparent-header    /* Marks sections that interact with transparent header */
.slides-under-header      /* Slides content under the fixed header */
.page-header             /* Identifies the page header section */
```

### Visual Behavior

- The page header slides under the fixed navigation
- Background images extend to the top of the viewport
- Content is positioned below the fixed header
- Dark overlay ensures text readability

## Customization Options

### 1. Theme-Based Styling

Page headers respect the current theme:

```tsx
// In your theme configuration
const theme = {
  colors: {
    pageHeaderOverlay: 'rgba(0, 0, 0, 0.6)',
    pageHeaderText: '#ffffff'
  }
};
```

### 2. Background Configurations

```tsx
// Full-width background
<PageHeader content={{
  title: "Gallery",
  backgroundImage: "/images/gallery-hero.jpg",
  overlay: true  // Dark overlay for readability
}} />

// No background (solid color)
<PageHeader content={{
  title: "Contact Us",
  overlay: false
}} />
```

### 3. Custom CSS Classes

```tsx
// Add custom styling
<PageHeader content={{
  title: "Special Page",
  customClasses: "gradient-background special-header"
}} />
```

## Best Practices

### 1. Content Guidelines

- Keep titles concise and descriptive
- Use subtitles for additional context, not essential information
- Ensure text contrast with background images

### 2. Image Selection

- Use high-quality images (minimum 1920px width)
- Consider mobile display (images should work at all aspect ratios)
- Optimize file sizes for performance
- Use the dark overlay for better text readability

### 3. Responsive Design

- Test headers on various screen sizes
- Ensure text remains readable on mobile
- Consider shorter titles for mobile displays

### 4. Performance

- Lazy load background images when possible
- Use optimized image formats (WebP, AVIF)
- Implement placeholder backgrounds while loading

## Examples in Different Contexts

### 1. Property Details Page

```tsx
<PageHeader content={{
  title: "Property Amenities",
  subtitle: "Everything you need for a perfect stay",
  backgroundImage: "/images/amenities-bg.jpg"
}} />
```

### 2. Location Page

```tsx
<PageHeader content={{
  title: "Explore the Area",
  subtitle: "Discover nearby attractions and activities",
  backgroundImage: "/images/location-map.jpg"
}} />
```

### 3. Gallery Page

```tsx
<PageHeader content={{
  title: "Photo Gallery",
  subtitle: "Browse through our collection",
  backgroundImage: "/images/gallery-preview.jpg"
}} />
```

### 4. Contact Page

```tsx
<PageHeader content={{
  title: "Get in Touch",
  subtitle: "We'd love to hear from you"
  // No background image for a cleaner look
}} />
```

## Troubleshooting Common Issues

### 1. Header Not Displaying Correctly

**Problem**: Content appears behind or overlaps with the fixed header.

**Solution**: Ensure the page includes proper CSS classes:
```html
<section class="has-transparent-header slides-under-header page-header">
```

### 2. Background Image Not Showing

**Problem**: Background image doesn't appear.

**Solution**: 
- Verify the image path is correct
- Check if the image is accessible (not 404)
- Ensure the image URL is properly formatted

### 3. Text Not Readable

**Problem**: Text is hard to read against the background.

**Solution**:
- Enable the overlay (default behavior)
- Adjust overlay opacity in theme settings
- Choose images with less contrast in the center

### 4. Positioning Issues on Mobile

**Problem**: Content doesn't center properly on mobile devices.

**Solution**:
- The positioning system handles mobile automatically
- Ensure viewport meta tag is set correctly
- Check for CSS conflicts with custom styles

### 5. Performance Issues

**Problem**: Page header causes layout shifts or slow loading.

**Solution**:
- Preload critical background images
- Use appropriate image formats and sizes
- Implement loading states for images

## Advanced Customization

### 1. Custom Positioning Logic

```typescript
// Create a custom positioning helper
export function customPageHeaderPositioning() {
  // Your custom logic here
  const header = document.querySelector('.page-header');
  // Custom positioning calculations
}
```

### 2. Theme-Specific Headers

```tsx
// Use different headers based on theme
const themedHeader = {
  title: "Property Details",
  backgroundImage: theme === 'luxury' 
    ? '/images/luxury-header.jpg' 
    : '/images/standard-header.jpg'
};
```

### 3. Dynamic Content

```tsx
// Generate header content based on property data
const dynamicHeader = {
  title: property.name,
  subtitle: `Located in ${property.location}`,
  backgroundImage: property.headerImage
};
```

## Integration with Multi-Page Architecture

Page headers are essential components in the multi-page architecture:

1. **Consistent Navigation**: Headers provide visual consistency across pages
2. **Page Identification**: Help users understand which page they're viewing
3. **Visual Hierarchy**: Create clear separation between navigation and content
4. **Responsive Design**: Adapt to different screen sizes automatically

## Related Documentation

- [Multi-Page Architecture Guide](/docs/architecture/multipage-architecture.md)
- [Dynamic Theme System](/docs/guides/using-property-themes.md)
- [Performance Optimization](/docs/implementation/performance-optimization.md)
- [Debugging Form Positions](/docs/guides/debugging-form-positions.md)

## Future Enhancements

Planned improvements for the page header system:

1. **Animation Support**: Entrance animations for title and subtitle
2. **Video Backgrounds**: Support for background videos
3. **Parallax Effects**: Optional parallax scrolling for backgrounds
4. **A/B Testing**: Built-in support for header variations
5. **Accessibility**: Enhanced screen reader support

## Summary

The page header system provides a flexible, performant way to add visual headers to your property pages. By following the guidelines in this document, you can create engaging, responsive headers that enhance the user experience while maintaining consistency with the overall design system.