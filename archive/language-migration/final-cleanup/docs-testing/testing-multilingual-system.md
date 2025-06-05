# Testing the Multilingual System

This guide provides comprehensive information about testing the multilingual functionality in RentalSpot-Builder.

## Overview

The multilingual system includes several testing tools to ensure proper functionality across languages, validate translations, and monitor performance impact.

## Available Testing Scripts

### 1. Browser-Based UI Testing

#### `browser-test-multilingual-flow.js`
Interactive browser test that validates the entire multilingual flow.

**Location**: `/scripts/browser-test-multilingual-flow.js` and `/public/scripts/`

**Features**:
- Tests initial page load and language detection
- Validates language switching functionality
- Checks URL routing with language segments
- Verifies content updates when language changes
- Tests persistence of language preference
- Validates translation loading and fallbacks

**Usage**:
```bash
# Method 1: Run directly
node scripts/browser-test-multilingual-flow.js

# Method 2: Use in browser
# 1. Start development server: npm run dev
# 2. Navigate to any page
# 3. Open browser console
# 4. Script auto-runs and logs results
```

**Test Scenarios**:
- Initial language detection from browser preferences
- Language switching via selector
- URL-based language routing (/ro paths)
- Content translation updates
- Language preference persistence in localStorage

### 2. Email Template Testing

#### `test-email-multilingual.ts`
Tests bilingual email templates without sending actual emails.

**Location**: `/scripts/test-email-multilingual.ts`

**Features**:
- Validates booking confirmation emails in both languages
- Tests cancellation email templates
- Checks inquiry response templates
- Verifies proper bilingual content structure
- Tests dynamic content insertion

**Usage**:
```bash
npx tsx scripts/test-email-multilingual.ts
```

**Expected Output**:
- Confirmation that both EN and RO content exists
- Validation of template structure
- Any missing translations flagged

### 3. Translation Validation

#### `validate-translations.ts`
Comprehensive validation of translation files for completeness and consistency.

**Location**: `/scripts/validate-translations.ts`

**Features**:
- Identifies missing keys between languages
- Detects empty translation values
- Finds untranslated content (same in both languages)
- Checks for type mismatches
- Reports structural differences

**Usage**:
```bash
npx tsx scripts/validate-translations.ts
```

**Validation Checks**:
1. Missing keys in either language file
2. Empty string values
3. Identical values (possible untranslated content)
4. Type mismatches between languages
5. Extra keys in one language

### 4. Performance Analysis

#### `analyze-multilingual-performance.ts`
Analyzes the performance impact of the multilingual system.

**Location**: `/scripts/analyze-multilingual-performance.ts`

**Features**:
- Measures translation file sizes (original and gzipped)
- Counts total translation keys
- Identifies duplicate content
- Calculates bundle size impact
- Provides optimization recommendations

**Usage**:
```bash
npx tsx scripts/analyze-multilingual-performance.ts
```

**Metrics Reported**:
- File sizes for each language
- Compression ratios
- Number of translation keys
- Duplicate content analysis
- Total system overhead

### 5. Firestore Multilingual Validation

#### `check-firestore-multilingual.ts`
Validates multilingual content in Firestore documents.

**Location**: `/scripts/check-firestore-multilingual.ts`

**Features**:
- Scans all collections for multilingual fields
- Identifies missing translations in documents
- Validates structure consistency
- Reports coverage statistics

**Usage**:
```bash
npx tsx scripts/check-firestore-multilingual.ts
```

**Collections Checked**:
- properties
- propertyOverrides
- websiteTemplates
- amenities
- features
- seasonalPricing
- dateOverrides

### 6. Translation Helper

#### `translation-helper.ts`
Interactive tool for managing and improving translations.

**Location**: `/scripts/translation-helper.ts`

**Features**:
- Interactive mode for adding translations
- Batch suggestions for common terms
- Report generation for translation status
- Smart suggestions based on patterns

**Usage**:
```bash
# Interactive mode
npx tsx scripts/translation-helper.ts

# Batch apply suggestions
npx tsx scripts/translation-helper.ts --batch

# Generate report
npx tsx scripts/translation-helper.ts --report
```

### 7. Interactive Test Page

#### Multilingual Test Page
A dedicated page for manual testing of multilingual features.

**Location**: `/multilingual-test`

**Features**:
- Language selector component
- Real-time language switching
- Translation function testing
- Debug information display
- Browser test script integration

**Usage**:
1. Start development server: `npm run dev`
2. Navigate to: `http://localhost:3000/multilingual-test`
3. Use the interface to test language switching
4. Check browser console for debug logs

## Testing Checklist

### Pre-Deployment Testing

Before deploying multilingual features, ensure:

1. **Translation Completeness**
   ```bash
   npx tsx scripts/validate-translations.ts
   ```
   - [ ] No missing keys
   - [ ] No empty values
   - [ ] Minimal untranslated content

2. **UI Functionality**
   ```bash
   node scripts/browser-test-multilingual-flow.js
   ```
   - [ ] Language selector works
   - [ ] URL routing functions correctly
   - [ ] Content updates properly
   - [ ] Language preference persists

3. **Email Templates**
   ```bash
   npx tsx scripts/test-email-multilingual.ts
   ```
   - [ ] All templates have bilingual content
   - [ ] Dynamic content inserts correctly
   - [ ] Formatting is preserved

4. **Data Integrity**
   ```bash
   npx tsx scripts/check-firestore-multilingual.ts
   ```
   - [ ] All documents have required translations
   - [ ] Structure is consistent
   - [ ] References are valid

5. **Performance**
   ```bash
   npx tsx scripts/analyze-multilingual-performance.ts
   ```
   - [ ] Bundle size impact is acceptable
   - [ ] No excessive duplication
   - [ ] Compression is effective

## Common Issues and Solutions

### Issue: Missing Translations
**Symptom**: Keys showing instead of translated text
**Solution**: 
1. Run `validate-translations.ts` to identify missing keys
2. Use `translation-helper.ts` to add missing translations
3. Rebuild translation files

### Issue: Language Not Persisting
**Symptom**: Language resets on page reload
**Solution**: 
1. Check localStorage is not blocked
2. Verify language context is properly initialized
3. Check middleware language detection

### Issue: Wrong Language Displayed
**Symptom**: Content shows in unexpected language
**Solution**: 
1. Check URL for language segment
2. Verify browser language preferences
3. Test with language selector

### Issue: Performance Degradation
**Symptom**: Slow page loads with translations
**Solution**: 
1. Run performance analysis
2. Check for duplicate translations
3. Implement code splitting if needed

## Automated Testing

For CI/CD pipelines, create a test script:

```bash
#!/bin/bash
# test-multilingual.sh

echo "Running multilingual system tests..."

# Validate translations
npx tsx scripts/validate-translations.ts
if [ $? -ne 0 ]; then
  echo "Translation validation failed"
  exit 1
fi

# Check Firestore data
npx tsx scripts/check-firestore-multilingual.ts
if [ $? -ne 0 ]; then
  echo "Firestore validation failed"
  exit 1
fi

# Analyze performance
npx tsx scripts/analyze-multilingual-performance.ts

echo "All multilingual tests passed!"
```

## Best Practices

1. **Regular Testing**
   - Run validation scripts before each deployment
   - Test all languages after content updates
   - Monitor performance metrics

2. **Translation Management**
   - Keep translations synchronized
   - Use consistent terminology
   - Document context for translators

3. **Performance Monitoring**
   - Track bundle size changes
   - Monitor translation file growth
   - Optimize duplicate content

4. **User Experience**
   - Test with native speakers
   - Verify cultural appropriateness
   - Ensure proper formatting (dates, numbers)

## Future Enhancements

Consider implementing:
1. Automated translation quality checks
2. Visual regression testing for different languages
3. A/B testing for language preferences
4. Translation crowdsourcing tools

## Support

For issues or questions:
1. Check error logs in browser console
2. Review test script output
3. Consult `/docs/guides/using-multilingual-system.md`
4. Run diagnostic scripts for detailed reports