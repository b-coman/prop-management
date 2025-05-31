# File Versioning and Cleanup Strategy

## The Problem
- Multiple versions of the same component (v1, v2, backup, old, new, etc.)
- Unclear which files are actually in use
- File proliferation making navigation difficult
- AI assistants creating new files instead of modifying existing ones

## Solution: Active File Management

### 1. **File Status Classification**

```typescript
/**
 * @file-status: ACTIVE | DEPRECATED | ARCHIVED | DELETED
 * @replaces: path/to/old/file.tsx
 * @replaced-by: path/to/new/file.tsx
 * @deprecation-date: 2024-12-01
 * @removal-date: 2025-01-01
 * @usage-count: 0  // Track if still imported anywhere
 */
```

### 2. **Naming Convention - NO VERSION SUFFIXES**

❌ **AVOID:**
```
BookingContext.tsx
BookingContextV2.tsx
BookingContext.old.tsx
BookingContext.backup.tsx
BookingContext-new.tsx
BookingContext-final.tsx
BookingContext-final-final.tsx
```

✅ **INSTEAD:**
```
BookingContext.tsx         // The ONE active file
_archive/                  // Archived versions
  BookingContext-2024-12-01.tsx
```

### 3. **File Lifecycle Management**

#### Stage 1: Active Development
```typescript
// BookingContext.tsx
/**
 * @file-status: ACTIVE
 * @fileoverview Current booking state management
 */
```

#### Stage 2: Deprecation (When Replacing)
```typescript
// BookingContext.tsx
/**
 * @file-status: DEPRECATED
 * @replaced-by: components/booking-v2/contexts/BookingContext.tsx
 * @deprecation-date: 2024-12-01
 * @removal-date: 2025-01-01
 * @migration-guide: See docs/migration/booking-v2.md
 */

console.warn('[DEPRECATED] BookingContext is deprecated. Use booking-v2/contexts/BookingContext');
```

#### Stage 3: Archival
```bash
# Move to archive with date stamp
mv src/contexts/BookingContext.tsx archive/contexts/BookingContext-2024-12-01.tsx
```

#### Stage 4: Deletion
```bash
# After removal date and confirming zero usage
git rm archive/contexts/BookingContext-2024-12-01.tsx
```

### 4. **Import Tracking Script**

```typescript
// scripts/track-file-usage.ts
/**
 * @fileoverview Tracks which files import deprecated modules
 * @module scripts/track-file-usage
 */

async function trackFileUsage() {
  const deprecatedFiles = findFilesWithStatus('DEPRECATED');
  
  for (const file of deprecatedFiles) {
    const importers = findImporters(file);
    
    if (importers.length === 0) {
      console.log(`✅ ${file} - Safe to archive (no imports)`);
    } else {
      console.log(`⚠️  ${file} - Still used by:`);
      importers.forEach(imp => console.log(`    - ${imp}`));
    }
  }
}
```

### 5. **Archive Structure**

```
src/
├── components/          # Active components only
├── contexts/           # Active contexts only
└── _archive/           # Old versions (git ignored after 6 months)
    ├── 2024-11/
    │   ├── BookingContext.tsx
    │   └── README.md   # Why archived
    └── 2024-12/
        ├── availability-check.tsx
        └── README.md
```

### 6. **Modification Rules for AI/Developers**

#### ALWAYS Try to Modify First:
1. Check if file exists
2. Read current implementation
3. Modify in place
4. Only create new if fundamentally different purpose

#### Decision Tree:
```
Need to change functionality?
├── Small change (bug fix, minor feature)
│   └── MODIFY existing file
├── Medium change (refactoring, new patterns)
│   └── MODIFY existing file + update header
└── Complete rewrite (different architecture)
    ├── Create new file in new location
    ├── Mark old as DEPRECATED
    └── Add migration guide
```

### 7. **Cleanup Commands**

```bash
# Find all deprecated files
npm run find-deprecated

# Check file usage
npm run check-usage -- src/contexts/BookingContext.tsx

# Archive old files (interactive)
npm run archive-deprecated

# Clean archive (remove >6 months)
npm run clean-archive

# Find duplicate functionality
npm run find-duplicates
```

### 8. **Git Cleanup Strategy**

```bash
# Before archiving, create a tag
git tag archive/booking-v1 -m "Archiving booking v1 components"

# Then safe to remove
git rm src/components/booking/*.old.tsx
git rm src/components/booking/*.backup.tsx
```

### 9. **Preventing File Proliferation**

#### Pre-commit Hook:
```bash
# Check for version suffixes
if git diff --cached --name-only | grep -E '\.(old|backup|v[0-9]+|new|copy)\.(tsx?|jsx?)$'; then
  echo "❌ Don't use version suffixes in filenames!"
  echo "Use @file-status and @replaced-by in headers instead"
  exit 1
fi
```

#### Code Review Checklist:
- [ ] No version suffixes in filenames
- [ ] Old files marked as DEPRECATED
- [ ] Migration path documented
- [ ] No duplicate functionality

### 10. **Example Migration**

#### Step 1: Start Migration
```typescript
// OLD: src/contexts/BookingContext.tsx
/**
 * @file-status: DEPRECATED
 * @replaced-by: components/booking-v2/contexts/BookingContext.tsx
 * @deprecation-date: 2024-12-29
 * @removal-date: 2025-02-01
 */
```

#### Step 2: Update Imports Gradually
```typescript
// In components using old context
import { BookingContext } from '@/contexts/BookingContext'; // Will show deprecation warning
```

#### Step 3: Archive When Safe
```bash
npm run check-usage -- src/contexts/BookingContext.tsx
# Output: ✅ Safe to archive (0 imports)

npm run archive-file -- src/contexts/BookingContext.tsx
# Moved to: src/_archive/2024-12/BookingContext.tsx
```

## Benefits

1. **Clear Active Set**: Only one version of each component
2. **Safe Deprecation**: Can't delete files still in use
3. **Clean Navigation**: No confusion about which file to use
4. **Git History**: Preserved through moves and tags
5. **Reversible**: Can restore from archive if needed

## For AI Assistants

### Instructions:
1. **ALWAYS check existing files first**
2. **MODIFY rather than create when possible**
3. **Use feature flags for v1/v2, not separate files**
4. **Mark deprecated files properly**
5. **Never use version suffixes**

### Example:
```typescript
// ❌ DON'T DO THIS:
// Create BookingFormV2.tsx

// ✅ DO THIS:
// 1. Modify BookingForm.tsx with feature flag
if (FEATURES.BOOKING_V2) {
  // New implementation
} else {
  // Old implementation
}

// OR if completely different:
// 2. Create in new namespace
// components/booking-v2/BookingForm.tsx
// Mark old as deprecated
```

## Summary

This strategy ensures:
- One source of truth per component
- Clear migration paths
- No file explosion
- Easy navigation
- Automated cleanup

The key is discipline: modify first, create only when necessary, and always clean up after migrations.