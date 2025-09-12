# Critical Implementation Guidelines - MUST READ FIRST

**⚠️ MANDATORY: These guidelines MUST be followed for EVERY task in the specification**

---

## Core Implementation Principles

### 1. PRESERVE EXISTING FUNCTIONALITY
**CRITICAL:** The current V2 booking system is live and functional. ANY changes must:
- ✅ Keep all existing features working
- ✅ Maintain backward compatibility
- ✅ Use feature flags for new functionality
- ❌ NEVER break existing user flows
- ❌ NEVER remove existing code without migration path

### 2. INCREMENTAL ENHANCEMENT OVER REWRITE
**APPROACH:** Add new capabilities alongside existing ones:
```typescript
// ✅ CORRECT: Add V3 alongside V2
if (useV3ErrorSystem) {
  return <BookingErrorDisplayV3 />;
} else {
  return <PricingStatusDisplay />; // Keep existing
}

// ❌ WRONG: Replace existing functionality
return <BookingErrorDisplayV3 />; // Breaking change!
```

### 3. CONTEXT GATHERING REQUIREMENTS

**BEFORE implementing ANY task, you MUST:**

#### Step 1: Analyze Current Implementation
```bash
# 1. Read ALL files that will be modified
# 2. Understand current data flow
# 3. Identify all dependencies
# 4. Document current behavior
```

#### Step 2: Review Related Systems
```bash
# 1. Check components that consume the modified code
# 2. Verify API endpoints that interact with changes
# 3. Understand state management implications
# 4. Review existing error handling patterns
```

#### Step 3: Assess Impact
```bash
# 1. List all files that import modified components
# 2. Identify potential breaking changes
# 3. Plan migration strategy if needed
# 4. Consider mobile vs desktop implications
```

---

## Task-Specific Context Gathering Instructions

### For EVERY Task Implementation:

```markdown
## 📋 PRE-IMPLEMENTATION CHECKLIST (MANDATORY)

### Context Gathering Phase
- [ ] Read current implementation of ALL files mentioned in task
- [ ] Identify ALL components/functions that use the code being modified
- [ ] Review git history for recent changes in these files
- [ ] Understand current error handling flow end-to-end
- [ ] Document current behavior before making changes

### Dependency Analysis
- [ ] List all imports/exports that will be affected
- [ ] Check for TypeScript interface changes
- [ ] Identify API contract modifications
- [ ] Review mobile-specific implementations

### Preservation Strategy
- [ ] Confirm existing functionality remains intact
- [ ] Add feature flags for new functionality
- [ ] Keep old code paths available as fallback
- [ ] Ensure no breaking changes to public APIs

### Implementation Approach
- [ ] Start with non-breaking additions
- [ ] Test existing functionality after each change
- [ ] Use incremental commits for easy rollback
- [ ] Add comprehensive logging for debugging
```

---

## AI Coding Assistant Instructions

### FOR AI ASSISTANTS: Context Retrieval Commands

**BEFORE starting ANY task, execute these commands:**

```typescript
// 1. Understand current implementation
READ_FILES: [
  "src/contexts/BookingContext.tsx",
  "src/components/booking-v2/components/DateAndGuestSelector.tsx",
  "src/components/booking-v2/containers/BookingPageV2.tsx",
  "src/app/api/check-pricing/route.ts"
]

// 2. Analyze dependencies
SEARCH_PATTERN: "import.*from.*BookingContext"
SEARCH_PATTERN: "pricingError"
SEARCH_PATTERN: "fetchPricing"

// 3. Check for recent modifications
GIT_LOG: --oneline -n 20 [file_path]

// 4. Identify usage patterns
GREP: "BookingContext" --include="*.tsx" --include="*.ts"
```

### Context Analysis Requirements

**AI MUST analyze and document:**
1. **Current State**: How does the feature currently work?
2. **Dependencies**: What other code relies on this?
3. **Side Effects**: What might break if this changes?
4. **Migration Path**: How to transition without breaking existing code?

---

## Task Implementation Pattern

### STANDARD IMPLEMENTATION FLOW

```typescript
/**
 * Task: [Task Name]
 * 
 * STEP 1: PRESERVE EXISTING FUNCTIONALITY
 * - Keep all current exports and interfaces
 * - Add new functionality alongside existing
 * - Use feature flags for new behavior
 */

// Example: Adding V3 error system to BookingContext

// PRESERVE: Keep existing V2 interface
export interface BookingContextType {
  // Existing V2 properties (DO NOT REMOVE)
  pricingError: string | null;
  fetchPricing: () => Promise<void>;
  
  // NEW V3 additions (SAFE TO ADD)
  bookingErrors?: BookingErrorV3[];  // Optional for backward compatibility
  useV3ErrorSystem?: boolean;         // Feature flag
}

// PRESERVE: Keep existing error handling
const handleError = (error: any) => {
  // Existing V2 logic (KEEP WORKING)
  setPricingError(error.message);
  
  // NEW V3 logic (ONLY IF ENABLED)
  if (useV3ErrorSystem && bookingErrorFactory) {
    const v3Error = bookingErrorFactory.fromApiResponse(error);
    addBookingError(v3Error);
  }
};
```

---

## Specific Preservation Requirements by Component

### BookingContext.tsx
**MUST PRESERVE:**
- All existing state variables
- Current fetchPricing logic
- Existing error state management
- All exported functions and types

**SAFE TO ADD:**
- New state variables with default values
- Additional helper functions
- Optional parameters to existing functions
- New context properties as optional

### DateAndGuestSelector.tsx
**MUST PRESERVE:**
- Current calendar functionality
- Guest selection logic
- Existing error display (PricingStatusDisplay)
- Mobile responsive behavior

**SAFE TO ADD:**
- Alternative error display with feature flag
- Additional props with default values
- New event handlers that don't override existing ones

### API Endpoints
**MUST PRESERVE:**
- Current request/response format
- Existing error response structure
- All current validation rules
- Response status codes

**SAFE TO ADD:**
- Additional optional fields in responses
- New endpoints for new functionality
- Extended error information in responses

---

## Integration Testing Requirements

### AFTER EACH TASK IMPLEMENTATION:

```typescript
// Required Integration Tests
describe('Backward Compatibility', () => {
  it('should maintain existing V2 booking flow', () => {
    // Test that old flow still works
  });
  
  it('should handle V2 error display when V3 disabled', () => {
    // Verify fallback behavior
  });
  
  it('should not break existing API contracts', () => {
    // Test API compatibility
  });
  
  it('should preserve mobile functionality', () => {
    // Test mobile-specific features
  });
});
```

---

## Common Breaking Changes to AVOID

### ❌ DO NOT:
1. Remove or rename existing exported functions
2. Change existing TypeScript interfaces (only extend)
3. Modify existing API response structures
4. Delete existing error handling code
5. Change existing component props without defaults
6. Remove existing state variables from contexts
7. Modify existing URL patterns or routes
8. Change existing translation keys

### ✅ INSTEAD DO:
1. Add new functions alongside existing ones
2. Extend interfaces with optional properties
3. Add new fields to API responses as optional
4. Add new error handling alongside existing
5. Add new optional props with defaults
6. Add new state variables without removing old ones
7. Create new routes for new functionality
8. Add new translation keys without changing existing

---

## Rollback Strategy

### EVERY IMPLEMENTATION MUST SUPPORT:

```typescript
// Feature flag for easy rollback
const FEATURE_FLAGS = {
  useV3ErrorSystem: process.env.NEXT_PUBLIC_USE_V3_ERRORS === 'true',
  useSmartSuggestions: process.env.NEXT_PUBLIC_USE_SUGGESTIONS === 'true',
  useMobileErrorDrawer: process.env.NEXT_PUBLIC_USE_MOBILE_DRAWER === 'true'
};

// Gradual rollout support
if (FEATURE_FLAGS.useV3ErrorSystem && userInTestGroup()) {
  // New implementation
} else {
  // Existing implementation (MUST KEEP WORKING)
}
```

---

## Final Verification Checklist

### BEFORE MARKING ANY TASK AS COMPLETE:

- [ ] Existing V2 booking flow works unchanged
- [ ] All existing error messages still display
- [ ] Mobile functionality preserved
- [ ] No TypeScript errors in existing code
- [ ] All existing tests still pass
- [ ] New functionality behind feature flag
- [ ] Rollback tested and working
- [ ] No console errors in browser
- [ ] Performance not degraded
- [ ] Memory leaks checked

---

## AI Assistant Acknowledgment

**FOR AI ASSISTANTS:** 
Before implementing any task, you MUST:
1. State that you have read these guidelines
2. Confirm you will preserve existing functionality
3. List the files you will read for context
4. Describe your incremental approach
5. Identify potential breaking changes to avoid

**Example AI Response:**
```
"I acknowledge the implementation guidelines. Before implementing Task X.X, I will:
1. Read existing implementations in [list files]
2. Preserve all current functionality
3. Add new features behind feature flags
4. Ensure no breaking changes
5. Test backward compatibility

My approach will be incremental:
- First, I'll analyze current implementation
- Then, add new functionality alongside existing
- Finally, integrate with feature flags for safe rollout"
```

---

**⚠️ REMEMBER: The system is LIVE. Every change must be safe, incremental, and reversible.**