# Using the Multilingual System

This guide covers the multilingual system in the RentalSpot Builder application, with special focus on the `tc()` (text children) function and its proper usage.

## Overview

The multilingual system supports English and Romanian languages for all guest-facing content. It uses URL-based routing where:
- English (default): `/properties/mountain-chalet`
- Romanian: `/properties/mountain-chalet/ro`

## Architecture

### Core Components

1. **Language Hook** (`useLanguage`)
   - Manages language state
   - Provides translation functions (`t` and `tc`)
   - Handles language switching

2. **Language Context**
   - Global language state management
   - Automatic language detection
   - Persistence via localStorage

3. **Translation Files**
   - `/locales/en.json` - English translations
   - `/locales/ro.json` - Romanian translations

4. **URL Routing**
   - Middleware for language detection
   - Dynamic route handling

5. **Normalized Collections**
   - `/amenities` - Multilingual amenity definitions
   - `/features` - Multilingual feature definitions
   - All with built-in translation support

## The tc() Function - Critical for React Components

### Purpose of tc()

The `tc()` function (text children) is a critical utility that:
- Converts multilingual text objects to strings based on the current language
- Ensures React components receive strings instead of objects
- Prevents the "Objects are not valid as React child" error
- Provides fallback values if translation keys are missing

### When to Use tc()

Use `tc()` in these situations:
1. **Form input values and placeholders**
2. **ARIA labels and accessibility attributes**
3. **String concatenation operations**
4. **Select component placeholders**
5. **Anywhere React expects a string but you have a translation object**

### Code Examples - Before and After

#### Problem: "Objects are not valid as React child" Error

**Before (Error-prone):**
```typescript
const ContactHostForm = () => {
  const { t } = useLanguage();
  
  return (
    <Input 
      placeholder={t.contactForm.subject.placeholder} // ❌ Error: Object used as child
    />
  );
};
```

**After (Fixed with tc()):**
```typescript
const ContactHostForm = () => {
  const { t, tc } = useLanguage();
  
  return (
    <Input 
      placeholder={tc(t.contactForm.subject.placeholder)} // ✅ String returned
    />
  );
};
```

### Common Pattern Examples

#### Form Inputs
```typescript
<Input
  id="subject"
  value={subject}
  onChange={(e) => setSubject(e.target.value)}
  placeholder={tc(t.contactForm.subject.placeholder)}
  aria-label={tc(t.contactForm.subject.label)}
/>
```

#### Select Components
```typescript
<SelectTrigger>
  <SelectValue placeholder={tc(t.common.select)} />
</SelectTrigger>
```

#### String Concatenation
```typescript
const dynamicTitle = `${tc(t.property.title)} - ${propertyName}`;
```

#### Currency Display
```typescript
<span>
  {tc(t.currency[selectedCurrency])} ({rates[selectedCurrency].symbol})
</span>
```

### Implementation in useLanguage Hook

The `tc()` function is implemented in the `useLanguage` hook:

```typescript
// src/hooks/useLanguage.ts
export function useLanguage() {
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en');
  
  const tc = useCallback((text: string | { [key in Language]?: string }): string => {
    if (typeof text === 'string') return text;
    return text[currentLanguage] || text.en || Object.values(text)[0] || '';
  }, [currentLanguage]);

  return {
    t: texts,
    tc,
    currentLanguage,
    setCurrentLanguage,
    languages
  };
}
```

### Migration Guide for tc()

When updating existing components to use `tc()`:

1. **Import both t and tc:**
   ```typescript
   const { t, tc } = useLanguage();
   ```

2. **Identify problematic usages:**
   - Look for places where `t.` values are used directly in string contexts
   - Check form inputs, placeholders, ARIA labels
   - Review string concatenations

3. **Wrap with tc():**
   ```typescript
   // Before
   placeholder={t.form.email.placeholder}
   
   // After
   placeholder={tc(t.form.email.placeholder)}
   ```

### Recent Component Fixes

The following components have been updated to properly use `tc()`:

#### CurrencySwitcher
```typescript
// Fixed currency display
<span>{tc(t.currency[value])}</span>
```

#### ContactHostForm
```typescript
// Fixed form inputs and placeholders
<Input
  placeholder={tc(t.contactForm.name.placeholder)}
  aria-label={tc(t.contactForm.name.label)}
/>
```

#### BookingForm & HoldForm
```typescript
// Fixed form validation messages and labels
<Label htmlFor="email">{tc(t.bookingForm.email.label)}</Label>
<Input placeholder={tc(t.bookingForm.email.placeholder)} />
```

#### HeroSection
```typescript
// Fixed booking summary text
<span>{tc(t.hero.guestsPlaceholder)}</span>
```

### Best Practices for Using tc()

1. **Always use tc() for string contexts:**
   - Input placeholders
   - ARIA labels
   - Select default values
   - String concatenations

2. **Direct usage without tc():**
   - React children that render text directly
   - Component content between tags

3. **Type safety:**
   - The `tc()` function accepts both strings and translation objects
   - It always returns a string, making it safe for string-only contexts

4. **Fallback handling:**
   - `tc()` provides multiple fallbacks: current language → English → first available → empty string
   - This ensures the UI never shows undefined or object references

## Using Translations in Components

### Basic Usage

```typescript
import { useLanguage } from '@/hooks/useLanguage';

export function MyComponent() {
  const { t, tc, lang, setLang } = useLanguage();
  
  return (
    <div>
      {/* Static UI translations - no tc() needed for direct children */}
      <h1>{t.common.welcome}</h1>
      
      {/* Form inputs - tc() required */}
      <Input placeholder={tc(t.form.placeholder)} />
      
      {/* Dynamic content translations */}
      <p>{tc(propertyData.description, 'main')}</p>
      
      {/* Current language */}
      <span>Language: {lang}</span>
      
      {/* Language switcher */}
      <button onClick={() => setLang(lang === 'en' ? 'ro' : 'en')}>
        Switch Language
      </button>
    </div>
  );
}
```

### Translation Functions

- `t` - The translation object containing all UI strings
- `tc(text)` - Converts translation objects to strings for the current language
- `lang` - Current language code ('en' or 'ro')
- `setLang` - Function to change the current language

## Common Patterns and Examples

### Dynamic Text with Variables
```typescript
const welcomeMessage = `${tc(t.welcome.greeting)}, ${userName}!`;
```

### Conditional Text
```typescript
const statusText = isAvailable 
  ? tc(t.status.available) 
  : tc(t.status.unavailable);
```

### Array Mapping
```typescript
{options.map(option => (
  <option key={option.value} value={option.value}>
    {tc(option.label)}
  </option>
))}
```

## Adding New Translations

### Adding UI Strings

1. Add the key to both `/locales/en.json` and `/locales/ro.json`:

```json
// en.json
{
  "newFeature": {
    "title": "New Feature",
    "description": "This is a new feature"
  }
}

// ro.json
{
  "newFeature": {
    "title": "Funcție Nouă",
    "description": "Aceasta este o funcție nouă"
  }
}
```

2. Use in your component:

```typescript
const title = t.newFeature.title; // For React children
const placeholder = tc(t.newFeature.title); // For string contexts
```

### Adding Dynamic Content

For content stored in Firestore, use the multilingual structure:

```json
{
  "title": {
    "en": "Mountain Chalet",
    "ro": "Cabană Montană"
  },
  "description": {
    "en": "Beautiful mountain retreat",
    "ro": "Refugiu montan frumos"
  }
}
```

## Debugging tc() Issues

1. **Check for object usage:**
   - If you see `[object Object]` in the UI, you're missing a `tc()` wrapper
   - Browser console will show "Objects are not valid as React child" errors

2. **Verify translations exist:**
   - Use browser dev tools to inspect the translation object
   - Check that all language keys are present

3. **Test language switching:**
   - Switch languages to ensure all tc() calls update properly
   - Look for any hardcoded strings that don't change

## Language Selector Component

The language selector is available as a reusable component:

```typescript
import { LanguageSelector } from '@/components/language-selector';

// In your component
<LanguageSelector />
```

## Email Templates

Emails are sent in bilingual format (both languages side by side):

```typescript
// Email template structure
Subject: Booking Confirmation | Confirmare Rezervare

English:
--------
Dear John,
Your booking is confirmed.

Română:
-------
Dragă John,
Rezervarea ta este confirmată.
```

## Best Practices

### 1. Consistent Key Naming

Use dot notation for nested keys:
```
common.button.submit
property.amenities.wifi
booking.form.guestName
```

### 2. tc() Usage Rules

- Use `tc()` for all string-only contexts
- Don't use `tc()` for direct React children
- Always use `tc()` for attributes and props that expect strings

### 3. Placeholder Handling

Ensure placeholders match in both languages:
```json
"welcome": "Welcome, {name}!",
"welcome": "Bun venit, {name}!"
```

### 4. Missing Translations

The system falls back to English if a Romanian translation is missing.

## Development Tools

### Translation Validation

```bash
# Validate all translations
npx tsx scripts/validate-translations.ts

# Interactive translation helper
npx tsx scripts/translation-helper.ts

# Batch apply suggestions
npx tsx scripts/translation-helper.ts --batch
```

### Performance Analysis

```bash
# Analyze multilingual performance
npx tsx scripts/analyze-multilingual-performance.ts
```

### Testing

```bash
# Browser test for multilingual flow
# Navigate to /multilingual-test in development
```

## URL Structure

The system maintains language in URLs:

- Homepage: `/` or `/ro`
- Property: `/properties/[slug]` or `/properties/[slug]/ro`
- Multipage: `/properties/[slug]/amenities` or `/properties/[slug]/ro/amenities`

## Troubleshooting

### Language Not Switching

1. Check localStorage for `preferred-language`
2. Verify URL structure is correct
3. Ensure middleware is running

### Missing Translations

1. Run validation script to find missing keys
2. Check browser console for warnings
3. Verify JSON file syntax

### Performance Issues

1. Use optimized language hook
2. Implement React.memo for static components
3. Enable translation caching

## Working with Normalized Collections

### Amenities and Features

The normalized amenities and features collections have built-in multilingual support:

```typescript
// Amenity document structure
{
  "id": "high-speed-wifi",
  "name": {
    "en": "High-Speed WiFi",
    "ro": "WiFi de Mare Viteză"
  },
  "icon": "Wifi",
  "category": {
    "en": "Indoor",
    "ro": "Interior"
  }
}

// Using in components - tc() is essential here
import { useLanguage } from '@/hooks/useLanguage';

const { tc } = useLanguage();
const amenityName = tc(amenity.name); // Automatically selects current language
```

### Properties Reference Amenities

Properties now use amenity IDs instead of embedded data:

```typescript
// Before (embedded)
{
  "amenities": {
    "en": ["WiFi", "Kitchen"],
    "ro": ["WiFi", "Bucătărie"]
  }
}

// After (normalized)
{
  "amenities": ["wifi", "kitchen"]
}
```

## Summary

The `tc()` function is essential for the multilingual system to work correctly with React. It bridges the gap between our translation object structure and React's requirement for string values in certain contexts. Always use `tc()` when:

- Setting input placeholders
- Providing ARIA labels
- Concatenating translated strings
- Using translations in any string-only context

By following these guidelines, you can ensure a smooth, error-free multilingual experience throughout the application. Remember: when in doubt, if React expects a string, use `tc()`!

## Migration Guide

If you have existing content, use the migration scripts:

```bash
# Migrate JSON files
npx tsx scripts/migrate-to-multilingual.ts

# Migrate Firestore data
npx tsx scripts/backup-and-migrate-firestore.ts

# Create normalized amenities/features
npx tsx scripts/create-normalized-collections.ts
```

## Testing

For comprehensive testing of the multilingual system, see the [Testing Multilingual System](testing-multilingual-system.md) guide.

Key testing scripts:
- `validate-translations.ts` - Validate translation completeness
- `browser-test-multilingual-flow.js` - Test UI functionality
- `test-email-multilingual.ts` - Test email templates
- `check-firestore-multilingual.ts` - Validate database content

## Future Enhancements

Potential improvements for the multilingual system:

1. Additional language support
2. Automatic translation integration
3. Translation management UI
4. Regional variations (en-US, en-GB)
5. RTL language support