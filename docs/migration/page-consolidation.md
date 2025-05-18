# Page Consolidation Migration Guide

## Overview

This guide documents the migration from separate page files to a unified page structure using Next.js optional catch-all routes. The migration consolidates functionality while preserving critical behaviors, especially header positioning.

## Migration Timeline

**Date**: May 2024  
**Version**: 1.0  
**Status**: Completed

## Before Migration

### File Structure
```
src/app/properties/
├── [slug]/
│   ├── page.tsx             # Homepage only
│   └── [...path]/
│       └── page.tsx         # All subpages
```

### Issues
- Code duplication between files
- Inconsistent behavior
- Maintenance overhead
- Different error handling approaches

## After Migration

### File Structure
```
src/app/properties/
├── [slug]/
│   ├── [[...path]]/
│   │   └── page.tsx         # All pages (consolidated)
│   ├── page.tsx.disabled    # Original homepage (archived)
│   └── [...path]/
│       └── page.tsx.disabled # Original subpages (archived)
```

### Benefits
- Single source of truth
- Consistent behavior across all pages
- Easier maintenance
- Unified error handling

## Migration Steps

### 1. Create New Consolidated File

```bash
# Create new directory structure
mkdir -p src/app/properties/[slug]/[[...path]]

# Create new consolidated page
touch src/app/properties/[slug]/[[...path]]/page.tsx
```

### 2. Merge Functionality

The new file combines:
- Error handling from `[slug]/page.tsx`
- Route parsing from `[...path]/page.tsx`
- Serialization utilities (using better version)
- Debug logging from homepage

### 3. Preserve Critical Behaviors

**Most Important**: Header positioning from homepage
```typescript
// Homepage with default language - exact pattern from original
if (pageName === 'homepage' && language === DEFAULT_LANGUAGE) {
  return (
    <Suspense fallback={<div>Loading property details...</div>}>
      <PropertyPageRenderer
        template={template}
        overrides={overrides}
        propertyName={typeof property.name === 'string' ? property.name : (property.name.en || property.name.ro || 'Property')}
        propertySlug={slug}
        pageName="homepage"
        themeId={property.themeId}
      />
    </Suspense>
  );
}
```

### 4. Test All Routes

Test these critical paths:
1. `/properties/property-name` - Homepage
2. `/properties/property-name/location` - Subpage
3. `/properties/property-name/ro` - Multilingual homepage
4. `/properties/property-name/ro/location` - Multilingual subpage

### 5. Disable Original Files

```bash
# Rename original files to disable them
mv src/app/properties/[slug]/page.tsx src/app/properties/[slug]/page.tsx.disabled
mv 'src/app/properties/[slug]/[...path]/page.tsx' 'src/app/properties/[slug]/[...path]/page.tsx.disabled'
```

## Rollback Plan

If issues are discovered:

### 1. Quick Rollback
```bash
# Restore original files
mv src/app/properties/[slug]/page.tsx.disabled src/app/properties/[slug]/page.tsx
mv 'src/app/properties/[slug]/[...path]/page.tsx.disabled' 'src/app/properties/[slug]/[...path]/page.tsx'

# Remove new consolidated file
rm -rf src/app/properties/[slug]/[[...path]]
```

### 2. Verify Restoration
- Test all routes again
- Check header positioning
- Verify error handling

## Code Comparison

### Key Differences

1. **Route Handling**
   ```typescript
   // Old: Two separate files with different logic
   // New: Single file with unified logic
   const { slug, path = [] } = resolvedParams;
   ```

2. **Language Support**
   ```typescript
   // Old: Only in [...path]/page.tsx
   // New: Available for all routes
   if (actualPath.length > 0 && SUPPORTED_LANGUAGES.includes(actualPath[0])) {
     language = actualPath[0];
   }
   ```

3. **Error Handling**
   ```typescript
   // Old: Different approaches in each file
   // New: Consistent error pages from [slug]/page.tsx
   ```

## Testing Checklist

### Visual Tests
- [ ] Header positioning on homepage
- [ ] Header transparency effects
- [ ] Content sliding under header
- [ ] Responsive behavior

### Functional Tests
- [ ] All routes load correctly
- [ ] Language switching works
- [ ] Error pages display properly
- [ ] Data fetching succeeds

### Performance Tests
- [ ] Page load times
- [ ] Bundle size impact
- [ ] Build time comparison

## Common Issues and Solutions

### Issue 1: Routes Not Matching
**Symptom**: 404 errors on valid routes  
**Solution**: Check path parsing logic in consolidated file

### Issue 2: Header Positioning Wrong
**Symptom**: Content not sliding under header  
**Solution**: Verify exact homepage rendering pattern is preserved

### Issue 3: Language Detection Failing
**Symptom**: Wrong language displayed  
**Solution**: Check language extraction logic order

## Long-term Maintenance

### Adding New Pages
1. Update template configuration
2. Add route mapping in consolidated file
3. Test all language combinations

### Modifying Behavior
1. Make changes in single file
2. Test impact on all route types
3. Update documentation

### Performance Monitoring
1. Track build times
2. Monitor bundle sizes
3. Check runtime performance

## Conclusion

The migration to a consolidated page structure simplifies the codebase while maintaining all critical functionality. The optional catch-all route pattern provides flexibility for future enhancements while reducing maintenance overhead.