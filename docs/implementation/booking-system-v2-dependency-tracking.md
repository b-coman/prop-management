# Booking System v2 - Dependency Tracking Strategy

## Purpose
Track all files used by v2 to clearly distinguish between:
- ✅ Active v2 dependencies (keep)
- ❌ Legacy code not used by v2 (can be removed after migration)

## Marking System

### 1. Files Created for v2
```typescript
/**
 * @fileoverview [Description]
 * @module booking-v2/[path]
 * @v2-role: CORE
 * @v2-created: 2024-12-29
 */
```

### 2. Existing Files Used by v2
```typescript
/**
 * @fileoverview [Description]
 * @module [path]
 * @v2-dependency: ACTIVE
 * @v2-usage: Used by booking-v2 for API calls
 * @v2-first-used: 2024-12-29
 * @legacy-status: STABLE
 */
```

### 3. Files Being Replaced by v2
```typescript
/**
 * @fileoverview [Description]
 * @module [path]
 * @v2-replaces: This file is replaced by booking-v2/contexts/BookingContext
 * @v2-migration-status: IN_PROGRESS
 * @legacy-status: DEPRECATED
 * @removal-date: 2025-03-01
 */
```

## V2 Dependency Categories

### CORE (Created specifically for v2)
- `booking-v2/contexts/BookingContext.tsx`
- `booking-v2/containers/BookingContainer.tsx`
- `booking-v2/components/*`

### SHARED (Used by both v1 and v2)
- `services/availabilityService.ts` - @v2-dependency: ACTIVE
- `services/pricingService.ts` - @v2-dependency: ACTIVE
- `lib/firebase.ts` - @v2-dependency: ACTIVE
- `components/ui/*` - @v2-dependency: ACTIVE

### LEGACY (Not used by v2)
- `contexts/BookingContext.tsx` - @v2-replaces: booking-v2/contexts/BookingContext
- `components/booking/container/*` - @v2-replaces: booking-v2/containers/*

## Implementation Steps

### Step 1: Mark All v2 Core Files
```bash
# All files in booking-v2 directory automatically get v2-role: CORE
src/components/booking-v2/**/*
```

### Step 2: Track Dependencies Script
```typescript
// scripts/track-v2-dependencies.ts
/**
 * @fileoverview Analyzes v2 imports and marks all dependencies
 */

async function trackV2Dependencies() {
  // 1. Find all v2 core files
  const v2Files = glob('src/components/booking-v2/**/*.{ts,tsx}');
  
  // 2. Analyze imports recursively
  const dependencies = new Set<string>();
  
  for (const file of v2Files) {
    analyzeDependencies(file, dependencies);
  }
  
  // 3. Update headers with @v2-dependency
  for (const dep of dependencies) {
    if (!dep.includes('booking-v2')) {
      addV2DependencyHeader(dep);
    }
  }
  
  // 4. Generate report
  generateV2DependencyReport(dependencies);
}
```

### Step 3: V2 Dependency Report
```json
{
  "v2-dependencies": {
    "core": [
      "booking-v2/contexts/BookingContext.tsx",
      "booking-v2/containers/BookingContainer.tsx"
    ],
    "shared": {
      "services": [
        { "path": "services/availabilityService.ts", "usage": "API calls" },
        { "path": "services/pricingService.ts", "usage": "Pricing API calls" }
      ],
      "components": [
        { "path": "components/ui/calendar.tsx", "usage": "Date picker" },
        { "path": "components/ui/button.tsx", "usage": "UI elements" }
      ],
      "libs": [
        { "path": "lib/firebase.ts", "usage": "Database access" },
        { "path": "lib/logger.ts", "usage": "Logging" }
      ]
    },
    "not-used-by-v2": [
      "contexts/BookingContext.tsx",
      "components/booking/availability-check.tsx"
    ]
  }
}
```

## Usage Examples

### Example 1: Existing Service Used by v2
```typescript
// services/availabilityService.ts
/**
 * @fileoverview Service for checking property availability
 * @module services/availabilityService
 * 
 * @v2-dependency: ACTIVE
 * @v2-usage: Core availability checking for booking-v2
 * @v2-first-used: 2024-12-29
 * 
 * @legacy-status: STABLE
 * @shared-by: v1 and v2 booking systems
 */
```

### Example 2: Legacy File Being Replaced
```typescript
// contexts/BookingContext.tsx
/**
 * @fileoverview Legacy booking state management
 * @module contexts/BookingContext
 * 
 * @v2-replaces: booking-v2/contexts/BookingContext.tsx
 * @v2-migration-status: IN_PROGRESS
 * 
 * @legacy-status: DEPRECATED
 * @deprecation-date: 2024-12-29
 * @removal-date: 2025-03-01
 */
```

### Example 3: UI Component Shared
```typescript
// components/ui/calendar.tsx
/**
 * @fileoverview Calendar component for date selection
 * @module components/ui/calendar
 * 
 * @v2-dependency: ACTIVE
 * @v2-usage: Date picker in booking flow
 * @v2-first-used: 2024-12-29
 * 
 * @shared-by: Multiple features including booking-v2
 */
```

## Tracking Commands

```bash
# Track all v2 dependencies
npm run track-v2-deps

# Check if file is used by v2
npm run check-v2-usage -- src/services/emailService.ts

# List all files NOT used by v2
npm run find-non-v2-files

# Generate v2 dependency graph
npm run v2-dep-graph
```

## Benefits

1. **Clear Separation**: Know exactly what v2 uses
2. **Safe Cleanup**: Can remove non-v2 files after migration
3. **No Accidents**: Won't break v2 by removing a dependency
4. **Progress Tracking**: See migration status at a glance
5. **Documentation**: Headers explain why file exists

## Migration Workflow

1. **Build v2** → Files get @v2-role: CORE
2. **Import existing** → Files get @v2-dependency: ACTIVE
3. **Complete feature** → Old files get @v2-replaces
4. **Test thoroughly** → Verify no v1 dependencies
5. **Cleanup** → Remove files with no @v2-dependency

## Visual Indicator in VS Code

```json
// .vscode/settings.json
{
  "files.associations": {
    "**/booking-v2/**": "typescriptreact"
  },
  "explorer.decorations.badges": true,
  "explorer.decorations.colors": true,
  "workbench.colorCustomizations": {
    "gitDecoration.modifiedResourceForeground": "#00ff00" // Green for v2 files
  }
}
```

This system ensures we always know:
- What files are part of v2 (CORE)
- What existing files v2 depends on (ACTIVE)
- What files are being replaced (DEPRECATED)
- What files are safe to remove (no v2 markers)