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

## Booking Component Behavior

### V2 Booking System Status (June 2025)

The V2 booking system has been **fully implemented and architecture validated**. Key findings:

#### **✅ Calendar Pre-loading (IMPLEMENTED & CONFIRMED)**
- **Data loaded FIRST**: Unavailable dates fetched automatically on component mount
- **Proper flow implemented**: Mount → Load Dates → Process Dates → Display Calendar
- **Calendar waits for data**: Shows loading spinner until unavailable dates are fetched
- **No race conditions**: Clean useReducer pattern with controlled API calls

#### **✅ V2.1 Automatic Pricing (FULLY IMPLEMENTED)**
- **Architecture confirmed safe**: 9/10 rating with no circular dependencies
- **Sequential pattern**: Availability already loaded → Auto-fetch pricing for valid dates  
- **Debouncing implemented**: 500ms delay prevents API spam
- **No manual "Check Price" button**: Seamless one-step experience
- **UI Flashing Fixed**: Conditional rendering moved inside Card components
- **Performance Optimized**: Inline memoization in DateAndGuestSelector only where needed

#### **Key V2.1 Pattern for Future Reference**
When implementing conditional UI rendering, always render the container (Card) and conditionally render content inside:
```typescript
// ✅ Good - No flashing
<Card>
  {condition ? <Content /> : <Placeholder />}
</Card>

// ❌ Bad - Causes flashing
{condition && <Card><Content /></Card>}
```

#### **⚠️ Known Limitations (Acceptable)**
- URL parameter parsing has client-side timing delays
- Multi-tab conflicts on same property
- No URL state sync back from UI changes

The V2 system successfully resolves all V1 race conditions and state management issues while maintaining feature parity.

#### **✅ V2.3 Booking Page Redesign (FULLY IMPLEMENTED)**
The UI/UX enhancement has been successfully completed, improving the booking experience with presentation-layer changes only:
- **✅ Two-column desktop layout** (60/40 split) with sticky summary implemented
- **✅ Mobile-optimized** with MobilePriceDrawer bottom sheet component
- **✅ Enhanced microcopy** and contextual tooltips throughout interface
- **✅ Progressive disclosure** with improved visual hierarchy
- **✅ Expandable price breakdown** with smooth animations for transparency
- **✅ Touch-optimized interactions** for mobile devices

**Key Achievements:**
- **MobilePriceDrawer Component**: Airbnb-style bottom sheet with gesture support
- **Zero Breaking Changes**: All V2 functionality preserved
- **Performance Maintained**: No layout shifts, smooth 60fps animations
- **Architecture Integrity**: Purely presentation layer, no structural changes

For complete technical details, see:
- `docs/implementation/booking-system-v2-specification.md` (Section 16 for V2.3 redesign)
- `docs/implementation/booking-system-v2-migration-plan.md`

## User Keywords and Commands

The following keywords trigger specific behaviors when used:

- **$nc** - No coding mode: Only investigate, research, analyze, and think through solutions. Do not write or modify any code until explicitly asked.
- **$quick** - Give brief, concise answers without extensive explanation.
- **$explain** - Provide detailed explanations with examples and context.
- **$plan** - Create a detailed implementation plan before any coding work.

When these keywords are used, follow the associated behavior pattern throughout the interaction.