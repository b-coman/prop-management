# Booking System v2.0 Migration Plan

**Document Version**: 1.0  
**Last Updated**: May 31, 2025 
**Status**: Planning Phase  

## Migration Objectives

1. **Preserve All Working Functionality** - APIs, Stripe, forms, themes, languages
2. **Fix State Management Issues** - Circular dependencies, storage clearing, double mounting
3. **Zero Downtime** - Gradual migration with fallback options
4. **Risk Mitigation** - Each phase is independently testable and rollback-able

---

## Current State Analysis

### ✅ **Working Systems (DO NOT TOUCH)**
```
APIs/
├── /api/check-availability     ✅ Perfect - keep as-is
├── /api/check-pricing          ✅ Perfect - keep as-is  
├── /api/webhooks/stripe        ✅ Perfect - keep as-is
└── All server actions          ✅ Perfect - keep as-is

Forms/
├── BookingForm.tsx             ✅ Stripe integration works
├── HoldForm.tsx                ✅ Hold flow works
└── ContactHostForm.tsx         ✅ Inquiry works

Services/
├── availabilityService.ts      ✅ API calls work
├── Theme system                ✅ Working
├── Language system             ✅ Working
├── Currency system             ✅ Working
└── Hero image fetching         ✅ Working

UI Components/
├── BookingSummary              ✅ Pricing display works
├── Mobile/desktop layouts      ✅ Responsive works
└── All form validation         ✅ Working
```

### ❌ **Broken Systems (NEEDS FIXING)**
```
State Management/
├── BookingContext.tsx          ❌ Circular dependencies
├── BookingContainer.tsx        ❌ Complex orchestration
├── AvailabilityContainer.tsx   ❌ Double mounting, storage issues
├── BookingStorageInitializer   ❌ Clears data incorrectly
└── Component coordination      ❌ Timing issues
```

---

## Migration Strategy: Side-by-Side Development

### Phase 0: Preparation (Day 1)
**Objective**: Set up migration infrastructure

#### Tasks:
1. **Create v2 directories**:
   ```
   src/components/booking-v2/
   ├── contexts/
   ├── containers/
   ├── components/
   └── types/
   ```

2. **Copy working components to v2 (symlinks)**:
   ```bash
   # Keep references to working code
   ln -s ../booking/forms booking-v2/forms
   ln -s ../booking/booking-summary.tsx booking-v2/
   ```

3. **Create feature flag**:
   ```typescript
   // src/config/features.ts
   export const FEATURES = {
     BOOKING_V2: process.env.NEXT_PUBLIC_BOOKING_V2 === 'true'
   };
   ```

#### Deliverables:
- [ ] v2 directory structure
- [ ] Feature flag system
- [ ] Development environment with v2 enabled

#### Testing:
- [ ] Verify feature flag toggles between v1/v2
- [ ] Confirm symlinks work correctly

#### Rollback: 
- Remove v2 directories, no impact on production

---

### Phase 1: Clean State Management (Days 2-5)
**Objective**: Create simplified BookingProvider that works with existing components

> **Technical Details**: See `booking-system-v2-specification.md` Section 6.1 for complete interface definitions

#### 1.1: BookingContextV2 (Day 2)
**Tasks:**
- [ ] Create new BookingProvider with simplified state structure
- [ ] Implement property-specific sessionStorage strategy
- [ ] Add URL parameter parsing (including currency/language fallbacks)
- [ ] Remove all circular dependencies from state management

**Acceptance Criteria:**
- Provider can be mounted without infinite re-renders
- URL parameters correctly populate initial state
- Currency/language integration works with existing contexts
- All sessionStorage keys are property-specific

#### 1.2: Storage Management (Day 3)
**Tasks:**
- [ ] Implement clean sessionStorage strategy without aggressive clearing
- [ ] Add property-specific storage keys (no conflicts between properties)
- [ ] Preserve user data during session, clear only on property change

> **Technical Details**: See `booking-system-v2-specification.md` Section 6.1 "SessionStorage Strategy"

**Acceptance Criteria:**
- Storage doesn't clear unexpectedly during normal usage
- Different properties have isolated storage
- Page refresh preserves booking state

#### 1.3: URL Parameter Handling (Day 4)
**Tasks:**
- [ ] Parse URL parameters on mount (checkIn, checkOut, guests, currency, language)
- [ ] Implement currency/language fallback chain
- [ ] Handle invalid parameter formats gracefully

> **Technical Details**: See `booking-system-v2-specification.md` Section 6.1 "URL Parameter Handling"
**Acceptance Criteria:**
- All URL parameters parse correctly or fallback appropriately
- Currency defaults to property.baseCurrency when not specified
- Language defaults to browser language when not specified

#### 1.4: Integration Layer (Day 5)
**Tasks:**
- [ ] Create BookingProviderV2 wrapper component
- [ ] Ensure compatibility with existing forms and components
- [ ] Add comprehensive error handling and logging
- [ ] Validate required property fields on mount

> **Technical Details**: See `booking-system-v2-specification.md` Section 6.6 "Error Handling Strategy"

#### Deliverables:
- [ ] BookingContextV2 with clean state management
- [ ] Storage management without clearing issues
- [ ] URL parameter handling
- [ ] Provider wrapper component

#### Testing:
- [ ] Unit tests for new context
- [ ] Storage persistence tests  
- [ ] URL parameter parsing tests
- [ ] Mock integration with existing forms

#### Rollback:
- Feature flag to v1, no production impact

---

### Phase 2: Component Integration (Days 6-10)
**Objective**: Integrate V2 state management with existing working components

> **Technical Details**: See `booking-system-v2-specification.md` Sections 6.2-6.5 for component specifications

#### 2.1: DateAndGuestSelector Integration (Days 6-7)
**Tasks:**
- [ ] Update DateAndGuestSelector to use new BookingProvider interface
- [ ] Add minimum stay calendar validation 
- [ ] Implement check-in change handling (clear checkout on violations)
- [ ] Add theme-aware visual feedback for date ranges

**Acceptance Criteria:**
- Calendar shows minimum stay restrictions correctly
- Check-in changes clear invalid checkout dates
- Visual feedback uses theme colors (no hardcoded values)
- "Check Price" button states work as before

#### 2.2: Preserve Working Components (Days 8-9)
**Tasks:**
- [ ] Connect existing BookingActions to V2 provider (NO REBUILDING)
- [ ] Connect existing BookingForms to V2 provider (NO REBUILDING)
- [ ] Ensure Stripe integration continues working perfectly
- [ ] Test all form validation and submission flows

**Acceptance Criteria:**
- All existing booking, hold, and contact flows work identically
- Stripe integration completely unchanged and functional
- Form validation and error handling preserved
- Success/error states display correctly

#### 2.3: Layout & Theme Integration (Day 10)
**Tasks:**
- [ ] Integrate V2 provider with existing layout components
- [ ] Ensure theme switching continues working
- [ ] Preserve mobile/desktop responsive layouts
- [ ] Test hero image fetching integration

#### Deliverables:
- [ ] DateAndGuestSelector with minimum stay validation
- [ ] Preserved BookingActions and BookingForms (fully functional)
- [ ] Theme and layout integration maintained
- [ ] All existing Stripe flows working

#### Testing:
- [ ] Minimum stay calendar validation edge cases
- [ ] Complete booking flow testing (Book Now, Hold, Contact)
- [ ] Stripe payment processing verification
- [ ] Theme switching and responsive layout testing
- [ ] Currency/language context integration testing

#### Rollback:
- Feature flag to v1, all existing functionality preserved

---

### Phase 3: End-to-End Integration Testing (Days 11-13)
**Objective**: Verify complete booking flows work with V2 state management

> **Note**: All APIs, services, and forms remain unchanged - only state management layer is V2

#### 3.1: Complete Flow Testing (Day 11)
**Tasks:**
- [ ] Test complete "Book Now" flow (selection → pricing → payment → success)
- [ ] Test complete "Hold Booking" flow with Stripe hold fee processing
- [ ] Test complete "Contact Host" flow with inquiry submission
- [ ] Verify all existing error handling continues working

**Acceptance Criteria:**
- All three booking flows complete successfully
- Stripe integration processes payments correctly
- Error messages display appropriately
- Success pages function as before

#### 3.2: Multi-Context Integration (Day 12)
**Tasks:**
- [ ] Test currency switching during booking flow
- [ ] Test language switching during booking flow  
- [ ] Test theme switching during booking flow
- [ ] Verify URL parameter scenarios (direct links vs homepage navigation)

**Acceptance Criteria:**
- Currency changes reflect in pricing display
- Language switching works without losing booking state
- Theme changes apply correctly to all components
- URL parameters populate state correctly on direct visits

#### 3.3: Edge Case & Error Scenarios (Day 13)
**Tasks:**
- [ ] Test network failure recovery
- [ ] Test session timeout scenarios
- [ ] Test invalid property data scenarios (missing required fields)
- [ ] Test browser refresh at various stages of booking flow

**Acceptance Criteria:**
- Network failures show appropriate retry options
- Session data persists through page refreshes
- Missing property fields show clear error messages
- Graceful degradation occurs for invalid scenarios

#### Deliverables:
- [ ] Complete booking flows verified (Book, Hold, Contact)
- [ ] Multi-context integration confirmed (currency, language, theme)
- [ ] Edge case handling validated
- [ ] Error recovery scenarios tested

#### Critical Success Metrics:
- [ ] 100% of existing functionality preserved
- [ ] Zero Stripe payment processing issues
- [ ] All theme/language/currency switching works
- [ ] No data loss during session management

#### Rollback:
- Feature flag to v1 if any critical flow breaks

---

### Phase 4: Production Readiness Validation (Days 14-16)
**Objective**: Validate V2 meets production quality standards

#### 4.1: Performance Benchmarking (Day 14)
**Tasks:**
- [ ] Compare V2 vs V1 page load times
- [ ] Measure API call efficiency (should be identical)
- [ ] Monitor memory usage patterns
- [ ] Analyze bundle size impact

**Acceptance Criteria:**
- Page load times ≤ V1 performance
- No additional API calls introduced
- Memory usage stable or improved
- Bundle size increase < 5KB

#### 4.2: Cross-Browser & Device Testing (Day 15)
**Tasks:**
- [ ] Test on Chrome, Firefox, Safari, Edge
- [ ] Test on mobile devices (iOS Safari, Android Chrome)
- [ ] Test tablet responsiveness
- [ ] Verify accessibility standards maintained

**Acceptance Criteria:**
- All browsers function identically to V1
- Mobile experience preserved
- No new accessibility issues
- Touch interactions work properly

#### 4.3: Stress Testing & Edge Cases (Day 16)
**Tasks:**
- [ ] Test rapid user interactions (fast clicking, form submission)
- [ ] Test poor network conditions (slow, intermittent connectivity)
- [ ] Test concurrent booking attempts on same property
- [ ] Test browser back/forward navigation

**Acceptance Criteria:**
- No race conditions or double bookings
- Graceful degradation on poor connections
- Navigation doesn't break state
- Rapid interactions don't cause errors

#### Deliverables:
- [ ] Performance benchmark report (V2 vs V1)
- [ ] Cross-browser compatibility confirmation
- [ ] Stress testing results
- [ ] Production readiness certification

#### Go/No-Go Decision Criteria:
- [ ] Performance equal or better than V1
- [ ] Zero critical bugs identified
- [ ] All acceptance criteria met
- [ ] Stakeholder sign-off obtained

#### Rollback:
- Feature flag to V1 if any performance regression or critical issues

---

### Phase 5: Production Migration (Days 17-20)
**Objective**: Gradually migrate production traffic to v2

#### 5.1: Staging Deployment (Day 17)
- [ ] Deploy v2 to staging
- [ ] Full staging testing
- [ ] Performance validation
- [ ] Security review

#### 5.2: Canary Release (Day 18)
- [ ] 10% of traffic to v2
- [ ] Monitor error rates
- [ ] Monitor performance
- [ ] Collect user feedback

#### 5.3: Gradual Rollout (Day 19)
- [ ] 50% traffic to v2 (if 10% successful)
- [ ] 100% traffic to v2 (if 50% successful)
- [ ] Monitor all metrics

#### 5.4: Cleanup (Day 20)
- [ ] Remove v1 code (if 100% successful)
- [ ] Remove feature flags
- [ ] Update documentation
- [ ] Archive old components

#### Deliverables:
- [ ] Production v2 deployment
- [ ] Monitoring dashboards
- [ ] Incident response plan
- [ ] Cleanup completion

#### Rollback:
- Feature flag back to v1 at any point

---

## Risk Mitigation

### Technical Risks
1. **API Compatibility**: APIs remain unchanged, low risk
2. **Form Functionality**: Forms reused as-is, low risk  
3. **Stripe Integration**: No changes to Stripe code, low risk
4. **Performance Regression**: Benchmark at each phase, medium risk

### Mitigation Strategies
1. **Feature Flags**: Instant rollback capability
2. **Side-by-Side Development**: No disruption to working code
3. **Gradual Migration**: Each phase independently validated
4. **Comprehensive Testing**: Automated and manual testing at each phase

### Rollback Plans
- **Phase 1-4**: Feature flag to v1, no production impact
- **Phase 5**: Traffic percentage rollback via feature flag
- **Emergency**: Instant rollback to v1 codebase

---

## Success Metrics

### Functionality Metrics
- [ ] 100% feature parity with v1
- [ ] All booking flows working
- [ ] All integrations working (Stripe, APIs, etc.)
- [ ] Zero regression bugs

### Performance Metrics  
- [ ] Page load time ≤ v1 baseline
- [ ] API calls reduced by 50%+ (goal)
- [ ] Memory usage ≤ v1 baseline
- [ ] Zero layout shifts

### Quality Metrics
- [ ] Code complexity reduced (cyclomatic complexity)
- [ ] Test coverage ≥ 80%
- [ ] Zero critical security issues
- [ ] Documentation updated

---

## Timeline Summary

| Phase | Duration | Focus | Risk Level |
|-------|----------|-------|------------|
| 0 | 1 day | Setup | Low |
| 1 | 4 days | State Management | Medium |
| 2 | 5 days | Containers | Medium |  
| 3 | 3 days | API Integration | Low |
| 4 | 3 days | Testing | Low |
| 5 | 4 days | Production | High |
| **Total** | **20 days** | **Complete Migration** | **Managed** |

## Next Steps

1. **Review and approve migration plan**
2. **Set up development environment with feature flags**
3. **Begin Phase 0: Preparation**
4. **Establish daily check-ins for progress tracking**

This migration plan ensures we preserve all working functionality while systematically fixing the state management issues that are causing problems.