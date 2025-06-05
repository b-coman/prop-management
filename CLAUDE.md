# Claude AI Notes and Documentation

## General Guidelines

1. Only update documentation files when explicitly requested by the user.
2. Focus on code changes and avoid modifying documentation unless specifically asked.
3. **Development Standards**: Always consult CLAUDE_DEVELOPMENT_STANDARDS.md for file headers, logging, documentation standards, and best practices.

## Coding Principles

- Do not hardcode data, do not use mock data inside of the scripts or code
- Avoid creating duplicate component implementations for the same functionality
- When refactoring, ensure old components are properly marked as obsolete and have migration paths
- Focus on modifying existing components rather than creating new versions with slightly different names

## File Management Standards

### File Versioning - CRITICAL RULES:
- **NEVER use version suffixes** in filenames (no .v2, .old, .backup, .new, .copy)
- **ALWAYS modify existing files** instead of creating new versions
- **ONE active file per component** - no BookingForm.tsx AND BookingFormV2.tsx
- When replacing files, mark old as `@file-status: DEPRECATED` with migration path
- Use feature flags for v1/v2 logic, not separate files

### File Headers:
- **MANDATORY**: All new files must include comprehensive headers per template
- Use `@fileoverview`, `@module`, `@description` at minimum
- Reference: `docs/implementation/file-header-template.md`

## Current System Status

### Booking System
- **V2.3 booking system is FULLY IMPLEMENTED** - Do not recreate or duplicate components
- **Architecture validated** - Modify existing components rather than creating new versions
- Technical details: See `docs/implementation/booking-system-v2-specification.md`

### Availability System  
- **Single-source architecture completed** - Uses availability collection only
- **Legacy dual-storage removed** - All migration work finished in June 2025
- Technical details: See `docs/architecture/availability-system.md`

## User Keywords and Commands

The following keywords trigger specific behaviors when used:

- **$nc** - No coding mode: Only investigate, research, analyze, and think through solutions. Do not write or modify any code until explicitly asked.
- **$quick** - Give brief, concise answers without extensive explanation.
- **$explain** - Provide detailed explanations with examples and context.
- **$plan** - Create a detailed implementation plan before any coding work.

When these keywords are used, follow the associated behavior pattern throughout the interaction.

## GitHub Issues Integration

### Issue Management Workflow

I should work closely with GitHub issues as the single source of truth for bug tracking and improvements:

1. **When I identify a bug or enhancement**: 
   - First ASK the user: "Should I create a GitHub issue for [describe the issue]?"
   - Wait for approval before creating the issue
   - Use descriptive titles and detailed descriptions
   - Include code snippets, error messages, and reproduction steps

2. **Creating Issues**:
   ```bash
   gh issue create --title "[TYPE]: Brief description" --body "Detailed description" --label "appropriate-label"
   ```
   - Types: Bug, Enhancement, Critical, Documentation, Performance
   - Always include: Problem, Current Behavior, Expected Behavior, Impact
   - **IMPORTANT**: Never use emojis in GitHub issues (titles, descriptions, comments)

3. **Available GitHub Labels**:
   - **Issue Types**: `bug`, `enhancement`, `documentation`, `question`
   - **Priority**: `critical`, `high-priority`, `medium-priority`, `low-priority`
   - **Categories**: `architecture`, `data-integrity`, `performance`, `tech-debt`, `deployment`
   - **Status**: `duplicate`, `invalid`, `wontfix`, `help wanted`, `good first issue`
   
   **Label Selection Guide**:
   - Use `critical` + `high-priority` for data loss or revenue impact
   - Use `architecture` for system design changes
   - Use `data-integrity` for data consistency issues
   - Use `tech-debt` for cleanup/refactoring work
   - Always include at least one type label (bug/enhancement) and one priority label

4. **Before working on any issue**:
   - First perform DEEP ANALYSIS without making changes
   - Present findings: root cause, impact, potential solutions
   - ASK: "Based on this analysis, should I proceed with fixing issue #X?"
   - Wait for explicit approval before making ANY code changes
   - Use $nc mode for investigation phase

5. **When fixing issues**:
   - Only proceed after user approval
   - Reference the issue number in commits
   - After fix is complete, ask: "Should I close issue #X?"
   - Close with a descriptive comment about the fix

6. **Regular Tasks**:
   - Check open issues at start of sessions: `gh issue list`
   - Track issue status throughout work
   - Update issues with progress comments when relevant
   - Link related issues together

7. **Issue Templates**:
   - **Bug**: Problem, Steps to Reproduce, Expected vs Actual, Priority
   - **Enhancement**: Current State, Proposed Change, Benefits, Implementation Plan
   - **Critical**: Immediate Impact, Affected Systems, Temporary Workaround, Fix Strategy

### Acceptance Criteria (AC) Standards

**MANDATORY**: Every issue MUST include specific, testable acceptance criteria before any work begins.

#### AC Format Requirements:
```markdown
## Acceptance Criteria
- [ ] **AC1**: [Specific, measurable behavior] 
  - **Test**: [How to verify this behavior]
  - **Expected**: [What should happen]
  - **Edge Cases**: [What shouldn't happen]

- [ ] **AC2**: [Another specific behavior]
  - **Test**: [Verification method]
  - **Expected**: [Expected outcome]
  - **Edge Cases**: [Failure scenarios to test]
```

#### AC Writing Guidelines:
1. **Specific & Measurable**: Avoid vague terms like "improve" or "better"
2. **User-Focused**: Write from user perspective when possible
3. **Testable**: Each AC must have a clear pass/fail test
4. **Independent**: Each AC should be testable separately
5. **Complete**: Cover all main scenarios, error cases, and edge cases

#### AC Examples:
**Good AC:**
- [ ] **AC1**: User can sign in with Google and access admin dashboard
  - **Test**: Click "Sign in with Google" → Complete Google auth → Verify redirect to `/admin`
  - **Expected**: User authenticated, session cookie created, redirected to admin dashboard
  - **Edge Cases**: Popup blocked, auth failed, network error

**Bad AC:**
- [ ] "Fix authentication system" (not specific or testable)
- [ ] "Make login better" (vague, no measurable criteria)

### Testing Requirements

**MANDATORY**: Every acceptance criteria MUST include corresponding test requirements.

#### Testing Categories:
1. **Unit Tests**: For individual functions/components
2. **Integration Tests**: For component interactions  
3. **E2E Tests**: For complete user workflows
4. **Manual Tests**: For UI/UX verification

#### Test Implementation Requirements:
- **Before fixing**: Write failing tests for each AC
- **During development**: Ensure tests pass as AC are completed
- **Before closing**: All tests must pass, including edge cases
- **Test naming**: Must clearly reference the AC being tested

#### Test Example Structure:
```typescript
// For AC1: User can sign in with Google
describe('AC1: Google Sign-in Authentication', () => {
  it('should authenticate user and create session cookie', async () => {
    // Test implementation
  });
  
  it('should redirect to admin dashboard after auth', async () => {
    // Test implementation  
  });
  
  it('should handle auth popup blocked error', async () => {
    // Edge case test
  });
});
```

### Definition of Done (DoD) by Issue Category

#### Bug Issues DoD:
- [ ] Root cause identified and documented
- [ ] Fix implemented addressing the root cause (not just symptoms)
- [ ] All acceptance criteria met and tested
- [ ] Regression tests added to prevent recurrence  
- [ ] No new bugs introduced (verified by existing test suite)
- [ ] Edge cases covered and tested
- [ ] Documentation updated if behavior changed
- [ ] Code reviewed and approved
- [ ] Deployed to staging and verified
- [ ] Original reporter confirmed fix

#### Enhancement Issues DoD:
- [ ] All acceptance criteria implemented and tested
- [ ] New functionality fully tested (unit + integration + E2E)
- [ ] Performance impact assessed (no degradation)
- [ ] Security implications reviewed
- [ ] Accessibility requirements met
- [ ] Mobile responsiveness verified
- [ ] Browser compatibility tested
- [ ] Documentation updated (user-facing and technical)
- [ ] Code reviewed and approved
- [ ] Deployed to staging and user-tested
- [ ] Rollback plan prepared

#### Critical Issues DoD:
- [ ] Immediate impact mitigated (hotfix if needed)
- [ ] Root cause analysis completed
- [ ] Permanent fix implemented and tested
- [ ] All affected systems verified functional
- [ ] Post-incident review conducted
- [ ] Prevention measures implemented
- [ ] Monitoring/alerting improved to catch similar issues
- [ ] Documentation updated with lessons learned
- [ ] Stakeholders notified of resolution

#### Architecture Issues DoD:
- [ ] Design document created and approved
- [ ] Impact on existing systems assessed
- [ ] Migration plan created (if needed)
- [ ] All acceptance criteria implemented
- [ ] Comprehensive testing across affected components
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Documentation updated (technical specs + ADRs)
- [ ] Team training conducted (if needed)
- [ ] Monitoring and observability in place

#### Tech Debt Issues DoD:
- [ ] Current technical debt documented and quantified
- [ ] Refactoring completed without breaking existing functionality
- [ ] Test coverage maintained or improved
- [ ] Performance maintained or improved
- [ ] Code complexity reduced (measurable)
- [ ] Documentation updated
- [ ] Knowledge sharing completed with team
- [ ] Future maintenance burden reduced

### DoD Verification Checklist

Before closing ANY issue:
1. **AC Verification**: All acceptance criteria checked off with evidence
2. **Test Verification**: All required tests passing in CI/CD
3. **Code Quality**: Linting, type checking, and code review passed
4. **Documentation**: All required docs updated and reviewed
5. **Deployment**: Changes successfully deployed to target environment
6. **User Verification**: Stakeholder/user acceptance confirmed

This ensures all bugs, fixes, and improvements are properly tracked, tested, and documented in GitHub.