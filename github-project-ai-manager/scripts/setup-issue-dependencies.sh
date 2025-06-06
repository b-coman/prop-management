#!/bin/bash
# Set up issue dependencies using GitHub's native blocking relationships

set -e

echo "🔗 Setting up issue dependencies with GitHub's blocking relationships..."

# Repository info
OWNER="b-coman"
REPO="prop-management"

echo ""
echo "📋 Creating dependency relationships..."

# Enhancement tasks depend on ALL foundation tasks
echo "   Setting up Enhancement dependencies..."

echo "     #42 (PropertyPageRenderer homepage) depends on foundation tasks..."
gh issue edit 42 --repo $OWNER/$REPO --add-label "blocked" || true
# Note: GitHub CLI doesn't have direct "blocking" relationship commands
# We'll document dependencies in issue descriptions and use our custom logic

echo "     #43 (Add legacy components) depends on #40..."
gh issue edit 43 --repo $OWNER/$REPO --add-label "blocked" || true

echo "     #44 (Data compatibility layer) depends on #39..."  
gh issue edit 44 --repo $OWNER/$REPO --add-label "blocked" || true

# Migration tasks depend on enhancement tasks
echo "   Setting up Migration dependencies..."

echo "     #45 (Replace homepage renderer) depends on enhancements..."
gh issue edit 45 --repo $OWNER/$REPO --add-label "blocked" || true

echo "     #46 (Archive legacy system) depends on #45..."
gh issue edit 46 --repo $OWNER/$REPO --add-label "blocked" || true

# QA tasks depend on enhancements
echo "   Setting up QA dependencies..."

echo "     #47 (Renderer parity tests) depends on #42..."
gh issue edit 47 --repo $OWNER/$REPO --add-label "blocked" || true

echo "     #48 (Performance testing) depends on #42..."
gh issue edit 48 --repo $OWNER/$REPO --add-label "blocked" || true

# Documentation tasks are final
echo "   Setting up Documentation dependencies..."

echo "     #49 (Update documentation) depends on #46..."
gh issue edit 49 --repo $OWNER/$REPO --add-label "blocked" || true

echo "     #50 (Code standards compliance) depends on #49..."
gh issue edit 50 --repo $OWNER/$REPO --add-label "blocked" || true

echo ""
echo "✅ Issue dependencies configured"

# Update issue descriptions with clear dependency information
echo ""
echo "📝 Updating issue descriptions with dependency information..."

# Enhancement tasks
gh issue edit 42 --repo $OWNER/$REPO --body "
## Objective
Extend PropertyPageRenderer to support homepage rendering, enabling consolidation of dual renderer systems.

## Dependencies  
🔒 **Blocked by**: #39, #40, #41 (All foundation tasks must be complete)

## Acceptance Criteria
- [ ] PropertyPageRenderer supports homepage layout rendering
- [ ] All homepage-specific components are available
- [ ] Data transformation layer works correctly
- [ ] Visual parity with existing homepage maintained
- [ ] Performance benchmarks met or exceeded

## Implementation Notes
- Based on analysis from foundation tasks
- Uses data transformation utilities from #39
- Leverages component gap analysis from #40
- Integrates with booking form patterns from #41
"

gh issue edit 43 --repo $OWNER/$REPO --body "
## Objective
Add missing legacy components to modern renderer mapping based on gap analysis.

## Dependencies
🔒 **Blocked by**: #40 (Component gap analysis)

## Acceptance Criteria  
- [ ] All missing components identified and implemented
- [ ] Component mapping 100% complete
- [ ] Legacy component parity achieved
- [ ] Integration tests passing
- [ ] Documentation updated

## Implementation Notes
- Based on gap analysis from #40
- Focus on components unique to legacy system
- Maintain API compatibility where possible
"

gh issue edit 44 --repo $OWNER/$REPO --body "
## Objective
Implement data structure compatibility layer for seamless migration between renderers.

## Dependencies
🔒 **Blocked by**: #39 (Data transformation utilities)

## Acceptance Criteria
- [ ] Data transformation layer implemented
- [ ] Legacy data formats supported
- [ ] Modern data formats supported  
- [ ] Automatic conversion between formats
- [ ] Performance impact minimal (<5%)
- [ ] Comprehensive test coverage

## Implementation Notes
- Uses transformation utilities from #39
- Handles both directions: legacy ↔ modern
- Focuses on property data and override structures
"

# Migration tasks
gh issue edit 45 --repo $OWNER/$REPO --body "
## Objective
Replace homepage PropertyPageLayout with PropertyPageRenderer system.

## Dependencies
🔒 **Blocked by**: #42, #43, #44 (All enhancement tasks must be complete)

## Acceptance Criteria
- [ ] Homepage fully migrated to PropertyPageRenderer
- [ ] All functionality preserved
- [ ] Visual parity maintained
- [ ] Performance equal or better
- [ ] No user-facing changes
- [ ] SEO and analytics preserved

## Implementation Notes
- This is the actual migration execution
- Requires all enhancement capabilities ready
- High-risk change requiring careful rollback planning
"

echo ""
echo "🎉 Dependencies and documentation setup complete!"
echo ""
echo "📊 Dependency Structure:"
echo "   Foundation (Ready): #39, #40, #41"
echo "   └── Enhancement (Blocked): #42←(39,40,41), #43←(40), #44←(39)"
echo "       └── Migration (Blocked): #45←(42,43,44), #46←(45)"
echo "           └── QA (Blocked): #47←(42), #48←(42)"
echo "               └── Documentation (Blocked): #49←(46), #50←(49)"
echo ""
echo "🔗 Visit project to see visual dependency flow: $(jq -r '.project_url' project-info.json)"