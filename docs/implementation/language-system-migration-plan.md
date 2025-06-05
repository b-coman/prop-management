# Language System Migration Plan

## Overview

This document outlines the complete migration from the current fragmented language system to a unified, performant language architecture, following the proven methodology used in the availability data migration.

**MIGRATION STATUS UPDATE - 2025-06-04**:
- ✅ **Phase 1 - Analysis & Planning**: Completed
- ✅ **Phase 2 - Unified System Implementation**: Completed  
- 🔄 **Phase 3 - Dual-Check Validation**: Ready to begin
- ⏸️ **Phase 4 - Migration Execution**: Pending Phase 3
- ⏸️ **Phase 5 - Legacy Cleanup**: Pending Phase 4

**Phase 2 Implementation**: Complete unified language system delivered in `src/lib/language-system/` with comprehensive test suite and backwards compatibility validation.

## Current State Analysis

### Problems Identified
1. **Multiple Overlapping Systems**: LanguageContext, useLanguage hook, useOptimizedLanguage hook, server-language-utils
2. **Inconsistent Language Storage**: URL paths, query parameters, localStorage, browser detection
3. **Hydration Issues**: Server/client mismatches causing React hydration errors
4. **Performance Overhead**: Multiple language detection systems running simultaneously
5. **Maintenance Complexity**: Changes require updates across multiple systems

### Impact Assessment
- **Booking Pages**: Query parameter language switching broken
- **Property Pages**: Multiple language systems causing conflicts
- **Performance**: Redundant language detection and translation loading
- **Developer Experience**: Complex debugging across multiple language systems

## Migration Strategy

### Phase-Based Approach (Feature Flags)
Following the availability migration pattern:

1. **LEGACY Mode** - Current mixed system (baseline, zero risk)
2. **DUAL_CHECK Mode** - Run both old and new systems, compare results
3. **UNIFIED Mode** - New unified system only (target state)
4. **CLEANUP Mode** - Remove all legacy code and feature flags

### Feature Flag Control
```bash
# Environment variable control for instant rollback
LANGUAGE_SYSTEM_MODE=legacy|dual_check|unified|cleanup
```

### Safety Mechanisms
- **Instant Rollback**: Environment variable toggle (no deployment)
- **Comprehensive Fallback**: Automatic fallback to legacy on errors
- **Continuous Validation**: Compare old vs new system outputs
- **Automated Monitoring**: Real-time health checks

## Technical Architecture

### New Unified System Design
```typescript
// Single Language Provider (Following file-header-template.md)
LanguageProvider
  ├── Smart detection with priority order
  ├── Efficient translation caching
  ├── SSR-compatible initialization
  ├── Unified API for all use cases
  ├── Centralized logging (loggers.languageSystem)
  └── Performance optimizations

// Single Hook for All Components
useLanguage()
  ├── currentLang: string
  ├── t(key: string): string
  ├── tc(content: any): string
  ├── switchLanguage(lang: string): void
  ├── isLoading: boolean
  └── Performance timing utilities
```

### Standards Compliance
- **File Headers**: All files follow file-header-template.md with full sections
- **Logging**: Centralized logger with namespace `language-system:*`
- **File Management**: No version suffixes, proper @file-status markings
- **Import Tracking**: Automated validation before archival

### Detection Priority Order
1. URL path segments (`/properties/[slug]/[lang]`)
2. Query parameters (`?language=`)
3. localStorage (`preferredLanguage`)
4. Browser preference (`navigator.language`)
5. Default (`en`)

### Storage Strategy
- **Property Pages**: URL path-based (`/properties/slug/lang`)
- **Booking Pages**: Query parameter-based (`?language=`)
- **Other Pages**: URL prefix-based (`/lang/page`)
- **Persistence**: localStorage for user preference

## Migration Phases

### Phase 1: Analysis & Planning ✅ IN PROGRESS
- [x] Create migration documentation structure
- [ ] Analyze current language system usage
- [ ] Map all language-related components and files
- [ ] Create testing infrastructure
- [ ] Design new unified architecture
- [ ] Create GitHub issues for tracking

### Phase 2: New System Development
- [ ] Implement new LanguageProvider with feature flags
- [ ] Create comprehensive test suite
- [ ] Build migration analysis tools
- [ ] Set up performance benchmarks
- [ ] Create rollback procedures

### Phase 3: Dual-Check Validation
- [ ] Deploy with DUAL_CHECK mode
- [ ] Validate new system against legacy
- [ ] Monitor for discrepancies
- [ ] Fix any compatibility issues
- [ ] Performance testing and optimization

### Phase 4: Migration Execution
- [ ] Switch to UNIFIED mode
- [ ] Monitor system health
- [ ] Address any issues immediately
- [ ] Performance validation
- [ ] User acceptance testing

### Phase 5: Cleanup
- [ ] Remove legacy language systems
- [ ] Clean up feature flags
- [ ] Update documentation
- [ ] Final performance validation
- [ ] Migration completion report

## Risk Mitigation

### Rollback Strategies
1. **Level 1 (Instant)**: Environment variable toggle
2. **Level 2 (Quick)**: Code deployment rollback
3. **Level 3 (Recovery)**: Full system restoration if needed

### Testing Strategy
- **Unit Tests**: All feature flag modes
- **Integration Tests**: Language switching workflows
- **E2E Tests**: Complete user journeys
- **Performance Tests**: Translation loading benchmarks
- **SSR Tests**: Server-side rendering validation

### Success Metrics
- **Zero Breaking Changes**: All existing functionality preserved
- **Performance Improvement**: Faster language detection and switching
- **Code Reduction**: Eliminate redundant language systems
- **Maintainability**: Single source of truth for language management
- **Developer Experience**: Simplified language system usage

## Timeline

- **Week 1**: Analysis, planning, and infrastructure setup
- **Week 2**: New system development and testing
- **Week 3**: Dual-check validation and optimization
- **Week 4**: Migration execution and cleanup

## Dependencies

### Critical Files to Preserve
- All existing translation files (`/locales/*.json`)
- Current component language functionality
- Existing URL structures and routing
- User language preferences

### Migration Tools
- **analyze-language-system.ts** - Current system mapping and conflict detection
- **track-language-usage.ts** - Import usage validation for safe archival (following file-versioning-and-cleanup-strategy.md)
- **validate-language-consistency.ts** - Cross-phase consistency validation
- **performance-benchmark.ts** - Performance comparison utilities
- **language-rollback.sh** - Emergency rollback automation
- **File header validation** - Ensures compliance with file-header-template.md
- **Centralized logging** - Following booking-system-v2-logging-strategy.md patterns

## GitHub Issues as Living Documentation

### Real-Time Progress Tracking
All migration progress, deviations, discoveries, and lessons learned MUST be documented as GitHub issue comments:

#### Required Comment Types
```markdown
## 🎯 Achievement Update
- **What accomplished**: [Specific milestone reached]
- **Evidence**: [Links, screenshots, test results]
- **Impact**: [How this affects next steps]

## ⚠️ Deviation from Plan
- **Original plan**: [What was planned]
- **Actual approach**: [What was done instead]
- **Reason**: [Why deviation was necessary]
- **Impact on timeline**: [Delays or accelerations]

## 💡 Discovery/Learning
- **Finding**: [What was discovered]
- **Implication**: [How this affects migration]
- **Action required**: [Changes needed to plan]

## 🔄 Blockers/Issues Encountered
- **Issue**: [Problem description]
- **Investigation**: [Steps taken to resolve]
- **Resolution**: [How it was solved]
- **Prevention**: [How to avoid in future]
```

#### Comment Frequency Requirements
- **Daily progress updates** during active development phases
- **Immediate comments** for any plan deviations or discoveries
- **Real-time updates** for blockers or unexpected issues
- **Achievement comments** when acceptance criteria items are completed
- **Lesson learned comments** at end of each phase

#### Example Comment Timeline
```
Day 1: 🎯 Achievement - Analysis script completed ahead of schedule
Day 2: 💡 Discovery - Found additional legacy hook not in original analysis
Day 3: ⚠️ Deviation - Added import tracking script (not in original plan)
Day 4: 🔄 Blocker - Centralized logger namespace conflicts resolved
Day 5: 🎯 Achievement - Phase 1 completed with enhanced standards compliance
```

---

**Last Updated**: 2025-06-04
**Status**: Phase 1 - Analysis & Planning
**Migration Mode**: PLANNING