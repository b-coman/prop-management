# Claude AI Development Standards - RentalSpot Project

## Core Development Principles (Entire Project)

### 1. Documentation Standards
- **All documentation files** should have clear, descriptive names indicating their purpose
- **All code files** must have comprehensive headers following the template
- **Headers must be updated** when making significant changes to files
- **V2-specific docs** should be prefixed with `booking-system-v2-` for organization

### 2. File Header Requirements
Every file in the project SHOULD have a header containing:
```typescript
/**
 * @fileoverview [One-line description]
 * @module [module-path]
 * 
 * @description
 * [2-3 sentences about purpose and responsibilities]
 * 
 * @architecture
 * [Where it fits in the system]
 * 
 * [Other sections as needed: @dependencies, @migration-notes, etc.]
 */
```

### 3. Header Maintenance
When modifying v2 files:
1. **Read the existing header first**
2. **Analyze what changed in the code**
3. **Update relevant header sections**:
   - Add import → Update `@dependencies`
   - Change API → Update `@description` and `@relationships`
   - Add state → Add/update `@state-management`
   - Breaking change → Update `@migration-notes`
4. **Run validation**: `npm run validate-v2-headers -- [file]`

### 4. Logging Standards
- Use the centralized logger: `import { loggers } from '@/lib/logger'`
- Choose appropriate namespace: `loggers.bookingContext`, `loggers.bookingAPI`, etc.
- Include structured metadata in logs
- Never use `console.log` directly - always use the logger for better control

### 5. Migration Strategy
- **Preserve all working code** (APIs, forms, Stripe integration)
- **Only rebuild broken parts** (state management, containers)
- **Use feature flags** for v1/v2 toggling
- **Maintain compatibility** with existing storage keys and APIs

### 6. Code Organization

#### General Pattern:
```
feature/
├── contexts/       # State management
├── containers/     # Smart components
├── components/     # UI components
├── hooks/         # Custom hooks
├── services/      # API and business logic
└── types/         # TypeScript definitions
```

#### Example - Booking v2:
```
src/components/booking-v2/
├── contexts/       # BookingContext, etc.
├── containers/     # BookingContainer, etc.
├── components/     # DatePicker, etc.
├── hooks/         # useBookingStorage, etc.
├── services/      # availabilityService, etc.
└── types/         # BookingState, etc.
```

### 7. Development Workflow
1. **Before creating a file**: Check if similar file exists first
2. **When modifying**: Update header if needed
3. **Before committing**: Validate headers
4. **In PR description**: Note any header updates

### 8. File Management Rules
1. **ALWAYS modify existing files** rather than create new versions
2. **NO version suffixes** (v2, .old, .backup, .new)
3. **Use feature flags** for v1/v2 behavior, not separate files
4. **Mark deprecated files** with @file-status header
5. **Archive old files** to _archive/ directory
6. **One active version** per component/service

### 9. Testing Requirements
- Unit tests for all new v2 components
- Integration tests for state management
- E2E tests for complete flows
- Performance benchmarks vs v1

### 10. Performance Guidelines
- Zero overhead logging when disabled
- Lazy loading for heavy components
- Memoization for expensive calculations
- Session storage debouncing

### 11. Key Commands
```bash
# Validate headers
npm run validate-headers          # For all files
npm run validate-v2-headers       # For v2 files only

# Enable debug logging
# In browser: ?debug=booking:*
# In console: LoggerConfig.enableDebug('booking:*')

# Check feature flags
# In console: FEATURES.BOOKING_V2
```

## Project-Wide Best Practices

### File Headers
- Start with the header template when creating new files
- Update headers when functionality changes significantly
- Use headers as living documentation
- Add `@legacy-status` to existing files when touched

### Code Quality
- Write self-documenting code with clear variable names
- Add inline comments for complex logic
- Keep functions focused and single-purpose
- Replace console.log with logger
- Convert JavaScript to TypeScript progressively

### Testing
- Write tests alongside implementation
- Test edge cases and error scenarios
- Maintain test coverage above 80%
- Add tests before refactoring legacy code

### Legacy Code Management
- Never do big-bang rewrites
- Document technical debt in headers
- Leave code better than you found it
- Track progress with analyze-legacy script

## V2-Specific Standards

### V2 Dependency Tracking
All files used by v2 must be marked:

1. **V2 Core Files** (in booking-v2/):
   ```typescript
   * @v2-role: CORE
   ```

2. **Existing Files Used by V2**:
   ```typescript
   * @v2-dependency: ACTIVE
   * @v2-usage: [How v2 uses this]
   * @v2-first-used: [Date]
   ```

3. **Files Replaced by V2**:
   ```typescript
   * @v2-replaces: [Path to v2 replacement]
   * @legacy-status: DEPRECATED
   ```

This ensures clear separation between v2 dependencies and legacy code.

## V2 Architecture Decisions

### State Management
- Single BookingProvider (no circular dependencies)
- User-triggered API calls only
- Clear data flow: UI → Action → API → State → UI

### Storage Strategy
- Property-specific keys: `booking_${propertySlug}_${key}`
- Selective persistence (not everything)
- No aggressive clearing

### API Integration
- Keep all existing endpoints unchanged
- Maintain request/response formats
- Use existing services where possible

### Form Handling
- Reuse existing form components
- Keep validation rules
- Maintain Stripe integration

## Remember
- **Documentation lives with code** - headers are part of the implementation
- **Validate before committing** - catch header drift early
- **Think architecture first** - update headers before coding
- **Log everything** - but with zero production overhead
- **Preserve working code** - only fix what's broken

---

## Lessons Learned from Language Migration (June 2025)

### Critical Learning: Test-Driven Reality vs Documentation-Driven Fiction

**The Problem:** During Phase 4 of the language migration, I fell into a pattern of:
1. Making changes to code
2. Writing elaborate success documentation
3. Marking tasks as complete
4. Never actually running the code to verify it worked

**The Consequences:**
- Build errors went unnoticed (`useSearchParams` SSR issues)
- Runtime errors were ignored (translation loading failures)
- Test suites had syntax errors but were marked "complete"
- Created false confidence with "success theater" documentation

### New Development Workflow Standards

#### 1. Incremental Verification Requirement
**After EVERY code change:**
```bash
# Step 1: Check if it builds
npm run build

# Step 2: Run development server
npm run dev

# Step 3: Test actual functionality
# Visit the page, click buttons, verify behavior

# Step 4: Fix any issues found
# Only then move to next change
```

#### 2. Task Completion Definition
A task is ONLY complete when:
- ✅ Code changes made
- ✅ Build succeeds without errors
- ✅ Dev server runs without crashes
- ✅ Functionality tested manually
- ✅ Edge cases checked
- ✅ Documentation reflects actual state (not wished state)

#### 3. Error Handling Protocol
When seeing an error:
1. **STOP** - Don't proceed to next task
2. **READ** - Understand what the error says
3. **FIX** - Address the root cause, not symptoms
4. **VERIFY** - Test that fix actually works
5. **DOCUMENT** - Note the issue and solution

Common errors to watch for:
- `useSearchParams() should be wrapped in a suspense boundary` → SSR compatibility issue
- `Failed to parse URL from /path` → Relative vs absolute URL issue
- `Module not found` → Import path or missing export issue

#### 4. Documentation Honesty Standards
**❌ WRONG:** "Migration completed successfully"  
**✅ CORRECT:** "Migration functional with known issues: X, Y, Z need fixes"

**❌ WRONG:** "All tests passing"  
**✅ CORRECT:** "Core functionality works, test suite has syntax errors preventing automation"

#### 5. Migration-Specific Checklist
Before claiming any migration phase complete:
- [ ] Previous phase actually tested and working
- [ ] Build process completes without errors
- [ ] Development server starts successfully
- [ ] Manual functionality test performed
- [ ] Known issues documented honestly
- [ ] Rollback capability verified

### Common Anti-Patterns to Avoid

1. **"It Should Work" Syndrome**
   - Making changes based on theory
   - Not testing actual behavior
   - Assuming correctness without verification

2. **"Success Theater"**
   - Writing elaborate completion reports
   - Creating migration summaries
   - Never running the actual code

3. **"Checkbox Driven Development"**
   - Focusing on marking tasks done
   - Prioritizing todo list completion
   - Ignoring actual functionality

4. **"Documentation Over Verification"**
   - Spending time writing plans
   - Creating detailed reports
   - Not spending time testing code

### SSR-Specific Learnings

1. **Hook Usage in SSR Context**
   ```typescript
   // ❌ WRONG - Breaks SSR
   const searchParams = useSearchParams();
   
   // ✅ CORRECT - SSR safe
   const [searchParams, setSearchParams] = useState<URLSearchParams | null>(null);
   useEffect(() => {
     if (typeof window !== 'undefined') {
       setSearchParams(new URLSearchParams(window.location.search));
     }
   }, []);
   ```

2. **URL Construction for Isomorphic Code**
   ```typescript
   // ❌ WRONG - Fails in SSR
   fetch('/api/data')
   
   // ✅ CORRECT - Works everywhere
   const baseUrl = typeof window !== 'undefined' 
     ? window.location.origin 
     : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
   fetch(`${baseUrl}/api/data`)
   ```

### Personal Accountability Protocol

When mistakes happen:
1. **Acknowledge immediately** - Don't hide or minimize
2. **Analyze root cause** - Was it rushing? Lack of testing? Poor planning?
3. **Fix properly** - No bandaids or hacks
4. **Document learning** - Add to this standards file
5. **Apply to future work** - Break the pattern

**Key Principle:** It's better to deliver working code slowly than broken code with great documentation.

---
*This file should be consulted for all development work on the RentalSpot project*
*Last updated with real learnings from language migration - June 2025*