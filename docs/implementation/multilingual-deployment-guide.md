# Multilingual System Deployment Guide

This guide covers the deployment of the multilingual functionality to production.

## Prerequisites

- Firebase Admin SDK configured
- Environment variables set
- All migrations completed
- Tests passing

## Deployment Checklist

### 1. Pre-deployment Preparation

- [ ] Run translation validation
  ```bash
  npx tsx scripts/validate-translations.ts
  ```

- [ ] Test multilingual flow locally
  ```bash
  npm run dev
  # Visit /multilingual-test
  ```

- [ ] Verify all environment variables
  ```bash
  # Check .env.production or set directly
  export FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH=/path/to/serviceAccountKey.json
  # Or ensure it's in your .env file
  ```

### 2. Data Migration

- [ ] Backup existing Firestore data
  ```bash
  # Create backup first
  npx tsx scripts/backup-firestore.ts
  ```

- [ ] Run Firestore migration
  ```bash
  # Ensure environment variable is set
  export FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH=/path/to/serviceAccountKey.json
  
  # Run migration with backup
  npx tsx scripts/backup-and-migrate-firestore.ts
  ```

- [ ] Verify migrated data in Firebase Console

### 3. Build and Deploy

- [ ] Build the application
  ```bash
  npm run build
  ```

- [ ] Test production build locally
  ```bash
  npm run start
  ```

- [ ] Deploy to Firebase Hosting
  ```bash
  firebase deploy --only hosting
  ```

### 4. Post-deployment Verification

- [ ] Test language switching on production
- [ ] Verify email templates are bilingual
- [ ] Check booking flow in both languages
- [ ] Monitor error logs for issues

## Environment Configuration

### Required Environment Variables

```env
# Firebase Admin
FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH=/path/to/service-account.json

# Public Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Optional: Default language
NEXT_PUBLIC_DEFAULT_LANGUAGE=en
```

## Rollback Plan

If issues occur after deployment:

1. **Immediate Rollback**
   ```bash
   # Deploy previous version
   firebase hosting:rollback
   ```

2. **Data Rollback**
   ```bash
   # Restore from backup
   npx tsx scripts/restore-firestore-backup.ts
   ```

3. **Feature Toggle**
   - Disable language selector temporarily
   - Force default language in middleware

## Performance Monitoring

### Key Metrics to Track

1. **Page Load Time**
   - Monitor initial load with translations
   - Track language switching speed

2. **Bundle Size**
   - Check increase from translation files
   - Monitor lazy loading effectiveness

3. **User Behavior**
   - Language selection patterns
   - Bounce rates per language

### Monitoring Tools

```javascript
// Add to your analytics
window.gtag('event', 'language_switch', {
  from_language: currentLang,
  to_language: newLang,
  page_location: window.location.pathname
});
```

## Troubleshooting Production Issues

### Common Issues and Solutions

1. **Language Not Persisting**
   - Check middleware configuration
   - Verify localStorage is accessible
   - Review cookie settings

2. **Missing Translations**
   - Check build logs for missing files
   - Verify JSON syntax is valid
   - Ensure proper file permissions

3. **Performance Degradation**
   - Enable translation caching
   - Implement code splitting
   - Use CDN for static translations

### Debug Mode

Enable debug logging in production:

```typescript
// Add to your app
if (process.env.NEXT_PUBLIC_DEBUG_TRANSLATIONS) {
  console.log('Language:', currentLang);
  console.log('Missing key:', key);
}
```

## Maintenance Tasks

### Regular Updates

1. **Weekly**
   - Review missing translation logs
   - Update Romanian translations
   - Monitor performance metrics

2. **Monthly**
   - Run full translation validation
   - Optimize bundle size
   - Review user feedback

3. **Quarterly**
   - Evaluate additional language needs
   - Update translation workflow
   - Performance optimization

### Translation Workflow

1. **Adding New Content**
   ```bash
   # Add to translation files
   npx tsx scripts/add-translation.ts --key "newFeature.title"
   
   # Validate
   npx tsx scripts/validate-translations.ts
   ```

2. **Updating Existing Content**
   ```bash
   # Update both languages
   npx tsx scripts/update-translation.ts --key "common.welcome"
   ```

## Security Considerations

1. **Input Sanitization**
   - Sanitize all user inputs
   - Validate language codes
   - Prevent XSS in translations

2. **Access Control**
   - Restrict translation file access
   - Validate Firebase permissions
   - Monitor for suspicious activity

## Support and Resources

- **Documentation**: `/docs/guides/using-multilingual-system.md`
- **Issues**: Track in GitHub Issues
- **Monitoring**: Firebase Console & Analytics
- **Testing**: `/multilingual-test` page

## Deployment Timeline

**Phase 1: Preparation (1 day)**
- Environment setup
- Data backup
- Final testing

**Phase 2: Migration (2-4 hours)**
- Run migration scripts
- Verify data integrity
- Test functionality

**Phase 3: Deployment (1 hour)**
- Build and deploy
- Monitor rollout
- Quick verification

**Phase 4: Monitoring (ongoing)**
- Track metrics
- Gather feedback
- Iterate improvements