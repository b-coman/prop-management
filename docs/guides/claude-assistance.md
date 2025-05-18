# Guidelines for Claude Code Assistant

This document provides instructions for Claude Code Assistant (and similar AI tools) when working with the RentalSpot-Builder codebase. Following these guidelines ensures consistent documentation and code quality.

## Documentation Updates

### Before Creating New Documentation

When creating or updating documentation:

1. **Check for Existing Files First**
   - Always search for existing documentation on the topic using tools like `Glob` or `Grep`
   - Check the following directories for related files:
     - `/docs/guides/` - User guides and how-tos
     - `/docs/implementation/` - Technical implementation details
     - `/docs/architecture/` - System architecture documents
     - `README.md` files in component directories
     - `CLAUDE.md` in the project root

2. **Prefer Updating Existing Documentation**
   - Only create new files when the topic is completely new and doesn't fit into any existing documentation
   - For related topics, extend existing files with new sections rather than creating fragmented documentation
   - When updating, maintain the same style, format, and tone as the original document

3. **File Placement Guidelines**
   - Place user-facing guides in `/docs/guides/`
   - Place technical specifications and implementation details in `/docs/implementation/`
   - Place architectural decisions and patterns in `/docs/architecture/`
   - Place component-specific documentation in README.md files within the component directory

## Code Style and Conventions

When updating or creating code:

1. **Follow Existing Patterns**
   - Study neighboring files to understand naming conventions and code organization
   - Match the existing style for consistency
   - Use the same library functions and patterns as similar components

2. **Prioritize TypeScript Safety**
   - Ensure all new code has proper type definitions
   - Avoid using `any` type whenever possible
   - Use interfaces for complex data structures

3. **Date Handling Conventions**
   - Check-in dates are always INCLUSIVE (first night of stay)
   - Check-out dates are always EXCLUSIVE (departure day, not a night of stay)
   - Always use the date-fns library for date calculations
   - When displaying date ranges to users, make it clear which dates are included

## Project-Specific Knowledge

### Firestore Structure

When working with Firestore collections:

1. **Price Calendars**
   - Document IDs use format: `propertyId_YYYY-MM`
   - Store daily pricing in a `days` object with day numbers as keys
   - Include full metadata with each day entry

2. **Properties**
   - Primary identifier is the `slug` field
   - Access through the `properties` collection

### Edge Runtime Compatibility

When modifying API routes:

1. **Firebase Access**
   - Use client-side Firebase SDK instead of Admin SDK for Edge compatibility
   - Never use Node.js-specific APIs in Edge functions
   - Verify runtime compatibility using the proper development environment

## Testing Updates

Before considering work complete:

1. **Run Type Checking**
   - Use `npm run typecheck` to ensure TypeScript compatibility
   - Fix all type errors before submitting changes

2. **Verify Critical Paths**
   - Test booking flow with date selection
   - Test pricing calculations with guest count variations
   - Test minimum stay requirements

## Documentation Standards

When writing documentation:

1. **Format and Structure**
   - Use markdown headings properly (# for title, ## for sections, ### for subsections)
   - Include code examples in ```typescript blocks with proper syntax highlighting
   - Use bullet points for lists and steps
   - Include diagrams or screenshots for complex concepts when appropriate

2. **Content Guidelines**
   - Begin with a clear purpose statement
   - Include examples for complex concepts
   - Document edge cases and how they're handled
   - Link to related documents where appropriate

3. **Code Examples**
   - Always include realistic, working code examples
   - Include comments explaining key parts
   - Show both usage and implementation when relevant

## Maintenance Tasks

Periodically perform these maintenance tasks:

1. **Documentation Audit**
   - Check for outdated information
   - Verify links between documents are working
   - Update screenshots to match current UI

2. **Deprecated Code Handling**
   - Move deprecated code to `/src/archive/` directory
   - Update references to point to new implementations
   - Document migration paths in appropriate guides