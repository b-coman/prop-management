# RentalSpot-Builder Scripts

This directory contains utility scripts for managing and maintaining the RentalSpot-Builder application.

## Multilingual Migration Scripts

### Prerequisites

Before running any Firestore migration scripts, ensure:

1. You have the Firebase service account key file available

2. Add the path to your `.env.local` file:
   ```
   FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH=/path/to/your/serviceAccountKey.json
   ```

   Note: The scripts automatically load environment variables from `.env.local` and `.env` files.

3. Alternatively, you can set the environment variable directly:
   ```bash
   export FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH="/path/to/your/serviceAccountKey.json"
   ```

### Available Migration Scripts

#### `migrate-firestore-to-multilingual.ts`

Direct migration script that uploads multilingual JSON files to Firestore.

```bash
npx tsx scripts/migrate-firestore-to-multilingual.ts
```

This script:
- Uploads properties from `/firestore/properties/`
- Uploads property overrides from `/firestore/propertyOverrides/`
- Uploads website templates from `/firestore/websiteTemplates/`
- Uploads other collections (inquiries, seasonal pricing, etc.)

#### `backup-and-migrate-firestore.ts`

Safer migration script that creates a backup before migrating.

```bash
# Run migration with backup
npx tsx scripts/backup-and-migrate-firestore.ts

# Restore from backup if needed
npx tsx scripts/backup-and-migrate-firestore.ts --restore /path/to/backup/directory
```

This script:
- Creates a timestamped backup of all Firestore data
- Runs the same migration as above
- Provides restore capability if issues occur

### Other Scripts

#### `test-email-templates.ts`

Tests the bilingual email templates without sending actual emails.

```bash
npx tsx scripts/test-email-templates.ts
```

#### `validate-translations.ts`

Validates translation files for completeness and consistency.

```bash
npx tsx scripts/validate-translations.ts
```

#### `translation-helper.ts`

Interactive tool for managing translations.

```bash
# Interactive mode
npx tsx scripts/translation-helper.ts

# Batch apply suggestions
npx tsx scripts/translation-helper.ts --batch

# Show report
npx tsx scripts/translation-helper.ts --report
```

#### `analyze-multilingual-performance.ts`

Analyzes the performance impact of the multilingual system.

```bash
npx tsx scripts/analyze-multilingual-performance.ts
```

## Browser Test Scripts

Located in `/public/scripts/`:

- `browser-test-multilingual.js` - Tests multilingual functionality
- `browser-test-api.js` - Tests API endpoints
- `browser-test-ui.js` - Tests UI components
- `browser-test-simple.js` - Basic functionality tests

To use browser tests:
1. Start the development server: `npm run dev`
2. Navigate to a page where you want to test
3. Open browser console
4. The scripts auto-run or can be triggered manually

## Property Management Scripts

#### `load-properties.ts`

Loads property data from JSON files into Firestore.

```bash
npx tsx scripts/load-properties.ts
```

#### `generate-price-calendars.ts`

Generates price calendar data for properties.

```bash
npx tsx scripts/generate-price-calendars.ts
```

## Database Scripts

#### `initialize-price-calendars.ts`

Initializes price calendars for all properties.

```bash
npx tsx scripts/initialize-price-calendars.ts
```

#### `update-property-pricing-schema.ts`

Updates property documents to include pricing schema.

```bash
npx tsx scripts/update-property-pricing-schema.ts
```

## Testing Scripts

### Multilingual Testing

#### `browser-test-multilingual-flow.js`

Comprehensive browser test for the entire multilingual system.

```bash
# Run directly
node scripts/browser-test-multilingual-flow.js

# Or load in browser console for interactive testing
```

**Tests**:
- Language detection and switching
- URL-based routing (/ro paths)
- Translation loading and updates
- Language persistence

#### `test-email-multilingual.ts`

Tests bilingual email templates.

```bash
npx tsx scripts/test-email-multilingual.ts
```

**Tests**:
- Booking confirmation emails
- Cancellation emails
- Inquiry responses
- Template structure validation

#### `validate-translations.ts`

Validates translation file completeness.

```bash
npx tsx scripts/validate-translations.ts
```

**Checks**:
- Missing translation keys
- Empty values
- Untranslated content
- Type mismatches

#### `analyze-multilingual-performance.ts`

Analyzes performance impact of translations.

```bash
npx tsx scripts/analyze-multilingual-performance.ts
```

**Reports**:
- File sizes (original and gzipped)
- Translation key counts
- Duplicate content
- Bundle size impact

#### `check-firestore-multilingual.ts`

Validates multilingual content in Firestore.

```bash
npx tsx scripts/check-firestore-multilingual.ts
```

**Validates**:
- Document structure
- Missing translations
- Language coverage

### Pricing Testing

#### `test-pricing-api.ts`

Tests the pricing API endpoints.

```bash
npx tsx scripts/test-pricing-api.ts
```

#### `test-pricing-availability.ts`

Tests pricing and availability calculations.

```bash
npx tsx scripts/test-pricing-availability.ts
```

## Environment Setup

Most scripts require environment variables. Create a `.env` file:

```env
# Firebase Admin
FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH=/path/to/serviceAccountKey.json

# Public Firebase Config (for client-side scripts)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

## Best Practices

1. Always backup data before running migration scripts
2. Test scripts in development environment first
3. Use the `--dry-run` flag when available
4. Monitor console output for errors
5. Keep Firebase Admin SDK credentials secure

## Troubleshooting

### Script won't run
- Check if TypeScript is installed: `npm install -g typescript`
- Ensure tsx is available: `npm install -g tsx`
- Verify Node.js version is 18+

### Firebase errors
- Verify service account path is correct
- Check Firebase project permissions
- Ensure network connectivity

### Migration issues
- Use backup-and-migrate script for safety
- Check Firestore rules allow writes
- Verify JSON files are valid