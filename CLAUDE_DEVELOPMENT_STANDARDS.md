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
*This file should be consulted for all development work on the RentalSpot project*