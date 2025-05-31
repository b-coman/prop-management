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

### Booking Availability Checking

The booking flow requires that the calendar component displays unavailable dates properly (marked with strikethrough). The correct implementation follows these critical guidelines:

1. Data must be loaded FIRST, then UI rendered with that data.
2. Unavailable dates must be loaded when the component mounts, before displaying the calendar.
3. The calendar must receive all unavailable dates before rendering to properly mark them as unavailable.
4. Auto-checking should happen after data is loaded, but only if not already checked.

The proper flow is:
```
Mount → Load Dates → Process Dates → Display Calendar → Auto-Check → Show Result
```

For more detailed technical information, see `docs/implementation/booking-availability-components.md`.

## User Keywords and Commands

The following keywords trigger specific behaviors when used:

- **$nc** - No coding mode: Only investigate, research, analyze, and think through solutions. Do not write or modify any code until explicitly asked.
- **$quick** - Give brief, concise answers without extensive explanation.
- **$explain** - Provide detailed explanations with examples and context.
- **$plan** - Create a detailed implementation plan before any coding work.

When these keywords are used, follow the associated behavior pattern throughout the interaction.