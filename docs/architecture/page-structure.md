# Page Structure Architecture

## Overview

The page structure architecture describes the unified routing system using Next.js optional catch-all routes, providing a single entry point for all property pages while maintaining flexibility and performance.

## Route Pattern

### File Structure
```
src/app/properties/[slug]/[[...path]]/page.tsx
```

This single file handles all property-related routes using the optional catch-all pattern `[[...path]]`.

### URL Patterns

The system handles these URL patterns:

1. **Homepage**
   ```
   /properties/property-name
   ```
   - `slug`: property-name
   - `path`: undefined/empty

2. **Subpages**
   ```
   /properties/property-name/location
   /properties/property-name/gallery
   ```
   - `slug`: property-name
   - `path`: ['location'] or ['gallery']

3. **Multilingual Routes**
   ```
   /properties/property-name/ro
   /properties/property-name/ro/location
   ```
   - `slug`: property-name
   - `path`: ['ro'] or ['ro', 'location']

## Route Processing Logic

### 1. Language Detection

```typescript
let language = DEFAULT_LANGUAGE;
let actualPath = path || [];

if (actualPath.length > 0 && SUPPORTED_LANGUAGES.includes(actualPath[0])) {
  language = actualPath[0];
  actualPath = actualPath.slice(1);
}
```

### 2. Page Name Determination

```typescript
let pageName = 'homepage';

if (actualPath.length > 0) {
  const pathString = actualPath.join('/');
  
  // Map common paths to page names
  if (pathString === 'details') {
    pageName = 'details';
  } else if (pathString === 'location') {
    pageName = 'location';
  }
  // ... more mappings
}
```

### 3. Rendering Decision

The component makes rendering decisions based on:
- Page name (homepage vs. subpage)
- Language (default vs. specific)

```typescript
// Homepage with default language - no LanguageProvider
if (pageName === 'homepage' && language === DEFAULT_LANGUAGE) {
  return <PropertyPageRenderer ... />;
}

// All other cases - wrap in LanguageProvider
return (
  <LanguageProvider initialLanguage={language}>
    <PropertyPageRenderer ... />
  </LanguageProvider>
);
```

## Component Hierarchy

### 1. Page Component
- Handles route parsing
- Manages error states
- Fetches necessary data
- Decides rendering strategy

### 2. PropertyPageRenderer
- Renders the actual page content
- Maps blocks to components
- Handles theme application
- Manages header/footer

### 3. Block Components
- Individual content sections
- Hero, Gallery, Location, etc.
- Support multilingual content
- Theme-aware styling

## Data Flow

1. **Route Parameters**
   ```
   { slug: 'property-name', path: ['ro', 'location'] }
   ```

2. **Language Extraction**
   ```
   language = 'ro'
   actualPath = ['location']
   ```

3. **Page Determination**
   ```
   pageName = 'location'
   ```

4. **Data Fetching**
   - Property data
   - Template configuration
   - Property overrides

5. **Rendering**
   - With or without LanguageProvider
   - Correct page from template
   - Applied overrides

## Error Handling

The system includes comprehensive error handling:

1. **Missing Slug**
   - Custom error page
   - Clear error message
   - Error reference code

2. **Property Not Found**
   - Specific error message
   - Suggestions for user
   - Error tracking

3. **Template Issues**
   - Configuration error handling
   - Fallback rendering
   - Admin notifications

4. **Invalid Pages**
   - 404 for non-existent pages
   - Visibility checks
   - Proper redirects

## Migration Benefits

### From Dual Files
Previously:
- `[slug]/page.tsx` - Homepage only
- `[slug]/[...path]/page.tsx` - Subpages

### To Single File
Now:
- `[slug]/[[...path]]/page.tsx` - All pages

### Advantages
1. **Reduced Duplication**
   - Single source of truth
   - Consistent behavior
   - Easier maintenance

2. **Better Performance**
   - Single build output
   - Optimized bundle
   - Faster deployments

3. **Simpler Logic**
   - Unified error handling
   - Consistent data flow
   - Clear patterns

## Implementation Guidelines

### Adding New Pages

1. Update template configuration:
   ```json
   "pages": {
     "new-page": {
       "path": "/new-page",
       "title": "New Page",
       "blocks": [...]
     }
   }
   ```

2. Add route mapping:
   ```typescript
   else if (pathString === 'new-page') {
     pageName = 'new-page';
   }
   ```

3. Create block components as needed

### Customizing Behavior

1. **Language-specific logic**
   ```typescript
   if (language === 'ro') {
     // Romanian-specific behavior
   }
   ```

2. **Page-specific rendering**
   ```typescript
   if (pageName === 'booking') {
     // Special booking page logic
   }
   ```

3. **Dynamic routing**
   ```typescript
   // Handle dynamic segments
   if (actualPath[0] === 'dynamic') {
     const dynamicId = actualPath[1];
     // Process dynamic content
   }
   ```

## Best Practices

1. **Keep route logic simple**
   - Clear mappings
   - Explicit patterns
   - Good defaults

2. **Handle edge cases**
   - Empty paths
   - Invalid languages
   - Missing pages

3. **Maintain consistency**
   - Same patterns everywhere
   - Clear naming conventions
   - Documented decisions

4. **Test thoroughly**
   - All route combinations
   - Error conditions
   - Language switching

## Future Enhancements

1. **Dynamic Page Types**
   - Blog posts
   - News updates
   - Event pages

2. **Advanced Routing**
   - Query parameters
   - Hash fragments
   - Redirects

3. **Performance Optimizations**
   - Route prefetching
   - Lazy loading
   - Cache strategies