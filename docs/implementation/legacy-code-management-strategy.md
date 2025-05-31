# RentalSpot - Legacy Code Management Strategy

## Overview
As we build v2 systems and establish new standards, we need a systematic approach to manage and gradually modernize legacy code without disrupting operations.

## Legacy Code Classification

### 1. **Code Health Levels**
```typescript
/**
 * @legacy-status: CRITICAL
 * @migration-priority: HIGH
 * @technical-debt: Circular dependencies, no tests
 * @migration-target: booking-v2
 */

// Legacy Status Levels:
// - HEALTHY: Meets current standards
// - STABLE: Works well, minor improvements needed
// - OUTDATED: Works but uses old patterns
// - PROBLEMATIC: Has issues but still functional
// - CRITICAL: Needs urgent replacement
```

### 2. **Migration Priority Matrix**

| Business Impact | Code Health | Priority | Action |
|----------------|-------------|----------|---------|
| High | Critical | 🔴 URGENT | Replace immediately (v2) |
| High | Problematic | 🟠 HIGH | Plan replacement |
| High | Stable | 🟡 MEDIUM | Gradual improvement |
| Low | Critical | 🟡 MEDIUM | Replace when touched |
| Low | Stable | 🟢 LOW | Document and monitor |

## Implementation Strategy

### Phase 1: Inventory and Classification (Week 1-2)

#### 1.1 Automated Legacy Scanner
```typescript
// scripts/analyze-legacy-code.ts
/**
 * @fileoverview Analyzes codebase to identify and classify legacy code
 * @module scripts/analyze-legacy-code
 */

interface LegacyAnalysis {
  file: string;
  health: 'HEALTHY' | 'STABLE' | 'OUTDATED' | 'PROBLEMATIC' | 'CRITICAL';
  issues: string[];
  dependencies: string[];
  lastModified: Date;
  complexity: number;
  testCoverage: number;
}

function analyzeLegacyCode(): LegacyReport {
  // Check for:
  // - Missing headers
  // - console.log usage
  // - No TypeScript
  // - Complex circular dependencies
  // - No tests
  // - High cyclomatic complexity
  // - Deprecated patterns
  // - Hard-coded values
}
```

#### 1.2 Legacy Tracking
```typescript
// .legacy-tracker.json
{
  "files": {
    "src/contexts/BookingContext.tsx": {
      "status": "CRITICAL",
      "issues": ["circular-deps", "no-header", "complex-state"],
      "migrationTarget": "booking-v2",
      "priority": "HIGH",
      "owner": "booking-team"
    },
    "src/components/booking/availability-check.tsx": {
      "status": "PROBLEMATIC",
      "issues": ["console-logs", "no-tests"],
      "migrationTarget": "booking-v2",
      "priority": "MEDIUM"
    }
  },
  "stats": {
    "total": 245,
    "critical": 12,
    "problematic": 48,
    "outdated": 85,
    "stable": 100
  }
}
```

### Phase 2: Gradual Modernization Strategy

#### 2.1 The "Strangle Fig" Pattern
```typescript
/**
 * @fileoverview [LEGACY] Old booking form - replaced by v2
 * @deprecated Use booking-v2/components/BookingForm instead
 * @legacy-status: OUTDATED
 * @migration-target: booking-v2/components/BookingForm
 * @removal-date: 2025-03-01
 */

// Add deprecation warnings
if (process.env.NODE_ENV === 'development') {
  console.warn('[DEPRECATION] BookingForm v1 is deprecated. Use v2 instead.');
}
```

#### 2.2 Progressive Enhancement Rules

**When Touching Legacy Code:**
1. **Minimal Touch** (Bug fixes):
   - Fix the bug only
   - Add a basic header with `@legacy-status`
   - Log the technical debt

2. **Minor Enhancement** (Small features):
   - Add proper header
   - Replace console.log with logger
   - Add basic TypeScript types
   - Document issues for future

3. **Major Enhancement** (Significant changes):
   - Full modernization required
   - Add comprehensive header
   - Add tests
   - Update to current patterns

### Phase 3: Legacy Code Markers

#### 3.1 In-Code Markers
```typescript
/**
 * @legacy-status: PROBLEMATIC
 * @technical-debt: 
 *   - Uses class components (should be functional)
 *   - Direct DOM manipulation
 *   - No error boundaries
 * @migration-notes:
 *   - Convert to functional component
 *   - Use React hooks instead of lifecycle methods
 *   - Add proper error handling
 */

// TODO: [LEGACY] This entire component needs refactoring
// HACK: [LEGACY] Temporary fix for race condition
// FIXME: [LEGACY] Memory leak in event listeners
```

#### 3.2 Legacy Dashboard
```markdown
# Legacy Code Dashboard

## Overview
- Total Files: 1,245
- Legacy Files: 245 (19.6%)
- Critical Issues: 12
- This Month's Progress: 8 files modernized

## Critical Files (Immediate Action)
1. BookingContext.tsx - Circular dependencies
2. availability-check.tsx - Race conditions
3. payment-handler.js - No TypeScript

## Recent Improvements
- ✅ Migrated PropertyCard to TypeScript
- ✅ Added headers to 45 components
- ✅ Replaced console.logs in services/

## Planned This Sprint
- [ ] Complete booking v2 migration
- [ ] Add headers to remaining services
- [ ] Convert 5 JS files to TypeScript
```

### Phase 4: Enforcement and Prevention

#### 4.1 Pre-commit Hooks
```bash
#!/bin/sh
# .husky/pre-commit

# Check if modifying legacy code without updating header
legacy_files=$(git diff --cached --name-only | xargs grep -l "@legacy-status" 2>/dev/null)

for file in $legacy_files; do
  if ! git diff --cached "$file" | grep -q "@legacy-status"; then
    echo "⚠️  Warning: Modifying legacy file without updating status: $file"
    echo "Please update the @legacy-status in the file header"
  fi
done
```

#### 4.2 CI/CD Checks
```yaml
# .github/workflows/legacy-management.yml
name: Legacy Code Management

on: [push, pull_request]

jobs:
  legacy-check:
    runs-on: ubuntu-latest
    steps:
      - name: Analyze Legacy Changes
        run: |
          npm run analyze-legacy-code
          npm run generate-legacy-report
          
      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const report = require('./legacy-report.json');
            const comment = `
            ## Legacy Code Impact
            - Files touched: ${report.touchedFiles}
            - Legacy debt increased: ${report.debtIncreased}
            - Improvements made: ${report.improvements}
            `;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              body: comment
            });
```

### Phase 5: Incentives and Tracking

#### 5.1 Technical Debt Sprints
- Dedicate 20% of each sprint to legacy code
- "Legacy Friday" - focus on improvements
- Track metrics and celebrate progress

#### 5.2 Gamification
```typescript
// Legacy Code Leaderboard
const leaderboard = {
  "developers": [
    { name: "Dev1", filesModernized: 15, headersAdded: 45 },
    { name: "Dev2", filesModernized: 12, headersAdded: 38 }
  ],
  "achievements": [
    "🏆 Legacy Slayer - Modernized 10+ files",
    "📝 Documentation Hero - Added 50+ headers",
    "🧹 Code Janitor - Removed 100+ console.logs"
  ]
};
```

## Migration Patterns

### Pattern 1: Side-by-Side Migration (Current - Booking v2)
```typescript
// Old file marks its replacement
/**
 * @deprecated Use booking-v2/contexts/BookingContext
 * @legacy-status: CRITICAL
 * @removal-date: 2025-02-01
 */

// New file references what it replaces
/**
 * @replaces contexts/BookingContext
 * @migration-from: v1
 */
```

### Pattern 2: Incremental Refactoring
```typescript
// Step 1: Add header and types
// Step 2: Convert to functional component
// Step 3: Add tests
// Step 4: Modernize patterns
// Step 5: Mark as HEALTHY
```

### Pattern 3: Wrapper Pattern
```typescript
/**
 * @fileoverview Modern wrapper for legacy PropertyAPI
 * @description
 * Provides modern async/await interface for legacy callback-based API.
 * Allows gradual migration without breaking existing code.
 */
export class PropertyServiceV2 {
  private legacyAPI: LegacyPropertyAPI;
  
  async getProperty(id: string): Promise<Property> {
    return new Promise((resolve, reject) => {
      this.legacyAPI.getProperty(id, (err, data) => {
        if (err) reject(err);
        else resolve(this.modernizePropertyData(data));
      });
    });
  }
}
```

## Success Metrics

### Monthly Tracking
- Legacy file count trend
- Critical issues resolved
- Test coverage increase
- Header adoption rate
- TypeScript conversion rate

### Quarterly Goals
- Q1: 100% headers on touched files
- Q2: 50% TypeScript conversion
- Q3: Zero critical legacy files
- Q4: 80% test coverage

## Tools and Commands

```bash
# Analyze legacy code
npm run analyze-legacy

# Generate legacy report
npm run legacy-report

# Find files without headers
npm run find-headerless

# Convert JS to TS with guidance
npm run js-to-ts -- src/components/MyComponent.js

# Mark file as legacy
npm run mark-legacy -- src/old-component.tsx --status=OUTDATED
```

## Key Principles

1. **No Big Bang Rewrites** - Gradual improvement
2. **Document Everything** - Future devs need context
3. **Test Before Modernizing** - Ensure behavior preserved
4. **Measure Progress** - Track improvements
5. **Celebrate Wins** - Motivation matters

## Summary

This strategy ensures:
- ✅ Legacy code is identified and tracked
- ✅ Clear migration paths exist
- ✅ Progress is measurable
- ✅ New legacy code is prevented
- ✅ Team stays motivated
- ✅ Business continuity maintained

The goal is not perfection, but continuous improvement. Every file touched should be left better than found.