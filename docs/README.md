# RentalSpot Documentation

This directory contains comprehensive documentation for the RentalSpot Builder platform.

> **Quick Links**: [Recent Updates](#recent-updates) | [Troubleshooting Guide](troubleshooting.md) | [Getting Started](#getting-started) | [Architecture Overview](architecture/overview.md)

## Recent Updates

The documentation has been significantly expanded and reorganized. For a detailed summary of recent changes, see [Recent Documentation Updates](RECENT_DOCUMENTATION_UPDATES.md).

### Highlights
- **New**: Booking/Availability Check page redesign documentation
- **New**: Implementation tracking system for redesign project  
- **New**: Comprehensive multilingual system documentation
- **New**: Complete troubleshooting guide with common issues and solutions
- **New**: Amenities and features normalization system
- **Updated**: Enhanced architecture documentation with multilingual support
- **Updated**: Improved page structure and header positioning guides

## Getting Started

### Essential Guides
1. [System Overview](architecture/overview.md) - Start here to understand the platform architecture
2. [Using Property Themes](guides/using-property-themes.md) - Apply and customize property themes
3. [Extending Admin Interface](guides/extending-admin-interface.md) - Add new features to the admin panel
4. [Troubleshooting Guide](troubleshooting.md) - Solutions to common issues

## Architecture

Documentation about system architecture and design:

- [System Overview](architecture/overview.md) - Complete system architecture and data model
- [Page Structure](architecture/page-structure.md) - Unified page routing with optional catch-all routes
- [Multi-Page Architecture](architecture/multipage-architecture.md) - Design of the multi-page property website structure
- [Admin Server Components](architecture/admin-server-components.md) - Server component architecture for admin interfaces
- [Dynamic Theme System](architecture/dynamic-theme-system.md) - Theme system architecture and implementation
- [Blueprint](architecture/blueprint.md) - Initial project blueprint and design decisions

## Implementation

Guides and plans for implementing key features:

### Core Features
- [Property Schema](implementation/property-schema.md) - Comprehensive property data model reference
- [Multi-Page Implementation Plan](implementation/multipage-implementation-plan.md) - Step-by-step process for implementing multi-page structure
- [Multi-Page Fixes](implementation/multipage-fixes.md) - Solutions for issues encountered in multi-page implementation
- [Email Service](implementation/email-service.md) - Email service implementation details
- [Hold Expiration](implementation/hold-expiration.md) - Automated cleanup of expired hold bookings

### Booking System
- [Booking Availability Check Redesign](implementation/booking-availability-check-redesign.md) - Agreed UX improvements for booking flow
- [Booking Redesign Tracking](implementation/booking-redesign-tracking.md) - Implementation progress tracking

### Pricing System
- [Pricing System](implementation/pricing-system.md) - Overview of the dynamic pricing system architecture
- [Dynamic Pricing Implementation](implementation/dynamic-pricing-implementation.md) - Detailed implementation guide
- [Pricing Implementation Status](implementation/pricing-implementation-status.md) - Current status of the pricing system
- [Pricing Implementation Plan](implementation/pricing-implementation-plan.md) - Roadmap for pricing features
- [Pricing Technical Specification](implementation/pricing-technical-specification.md) - Technical specs for pricing
- [Pricing Testing Results](implementation/pricing-testing-results.md) - Testing outcomes and validation
- [Price Calendar Editing](implementation/price-calendar-editing.md) - Implementation of real-time price calendar editing
- [Pricing Admin UI](implementation/pricing-admin-ui.md) - Design of the pricing management admin interface
- [Pricing Management Implementation](implementation/pricing-management-implementation.md) - Admin interface implementation
- [Admin Pricing Cleanup](implementation/admin-pricing-cleanup.md) - Summary of admin pricing implementation cleanup
- [Firestore Pricing Structure](implementation/firestore-pricing-structure.md) - Database schema for pricing
- [Length of Stay Discounts](implementation/length-of-stay-discounts.md) - Implementation of length-based pricing discounts

### Multilingual System
- [Multilanguage System](implementation/multilanguage-system.md) - Core multilingual implementation
- [Multilanguage Task List](implementation/multilanguage-task-list.md) - Development tasks tracking
- [Multilingual Deployment Guide](implementation/multilingual-deployment-guide.md) - Deployment procedures
- [Multilingual Implementation Status](implementation/multilingual-implementation-status.md) - Current implementation status

### Theme System
- [Dynamic Theme Implementation](implementation/dynamic-theme-implementation-plan.md) - Implementation plan for dynamic theming
- [Theme System Implementation](implementation/theme-system-implementation.md) - Detailed theme system implementation
- [Theme System Status](implementation/theme-system-status.md) - Current status of the theme system

### UI/UX Features
- [Booking Form Positioning](implementation/booking-form-positioning.md) - Booking form positioning system
- [Form Position & Size Specifications](implementation/form-position-size-specifications.md) - Layout specifications
- [Header Positioning System](implementation/header-positioning-system.md) - Fixed header with transparent overlay
- [Booking Availability Components](implementation/booking-availability-components.md) - Availability checking UI

### Other Features
- [Amenities Features Normalization](implementation/amenities-features-normalization.md) - Standardizing property features
- [Admin Auth System](implementation/admin-auth-system.md) - Admin authentication implementation
- [Performance Optimization](implementation/performance-optimization.md) - Performance optimizations and best practices
- [Edge Runtime Compatibility](implementation/edge-runtime-compatibility.md) - Compatibility considerations for edge runtime

## Guides

Usage guides and best practices:

### Developer Guides
- [Error Handling](guides/error-handling.md) - Error handling patterns and implementations
- [Logging Practices](guides/logging-practices.md) - Comprehensive logging strategy and standards
- [Firebase Admin Setup](guides/firebase-admin-setup.md) - Using Firebase Client SDK for admin operations
- [Claude AI Assistance](guides/claude-assistance.md) - Guidelines for working with Claude AI
- [Extending Admin Interface](guides/extending-admin-interface.md) - Guide to adding new features to the admin interface

### Feature Guides
- [Using Dynamic Pricing](guides/using-dynamic-pricing.md) - Complete guide to dynamic pricing features
- [Using Property Themes](guides/using-property-themes.md) - Apply and customize property themes
- [Using Multilingual System](guides/using-multilingual-system.md) - Using and extending multilingual functionality
- [Using Amenities & Features](guides/using-amenities-features.md) - Working with normalized amenities and features
- [Using Availability Preview](guides/using-availability-preview.md) - Guide to the availability preview feature
- [Using Page Headers](guides/using-page-headers.md) - Implementing and customizing page headers

### Testing & Debugging
- [Testing Multilingual System](guides/testing-multilingual-system.md) - Comprehensive testing guide for multilingual features
- [UI Testing Pricing](guides/ui-testing-pricing.md) - Testing guide for pricing interface
- [Debugging Form Positions](guides/debugging-form-positions.md) - Using the form position debug tool
- [Consecutively Blocked Dates](guides/consecutively-blocked-dates.md) - Handling consecutive unavailable dates

## Migration Guides

Documentation for migration processes:

- [Page Consolidation](migration/page-consolidation.md) - Migration from dual page files to unified structure

## Fixes

Documented solutions to specific issues:

- [Multilingual Property Names](fixes/multilingual-property-names.md) - Fixing property name translation issues

## Refactoring

Plans and documentation for code refactoring:

- [Booking Component Refactoring](refactoring/booking-component.md) - Plan for refactoring the booking component structure

## Troubleshooting

- [Comprehensive Troubleshooting Guide](troubleshooting.md) - Common issues and their solutions

## Directory Structure

The documentation is organized into the following directories:

```
docs/
├── README.md                               # This file - main documentation index
├── RECENT_DOCUMENTATION_UPDATES.md         # Summary of recent documentation changes
├── troubleshooting.md                      # Comprehensive troubleshooting guide
├── architecture/                           # System architecture and design documents
│   ├── overview.md                         # Complete system architecture
│   ├── page-structure.md                   # Page layouts and routing
│   ├── multipage-architecture.md           # Multi-page property sites
│   ├── admin-server-components.md          # Admin server architecture
│   ├── dynamic-theme-system.md             # Theme system design
│   └── blueprint.md                        # Initial project blueprint
├── implementation/                         # Implementation guides and technical details
│   ├── property-schema.md                  # Property data model
│   ├── multilanguage-system.md             # Core multilingual system
│   ├── pricing-system.md                   # Dynamic pricing system
│   ├── booking-availability-components.md  # Availability UI components
│   ├── admin-auth-system.md                # Admin authentication
│   └── ...                                 # Many more implementation docs
├── guides/                                 # Usage guides and how-to documents
│   ├── using-multilingual-system.md        # Multilingual features guide
│   ├── using-property-themes.md            # Theme customization guide
│   ├── using-dynamic-pricing.md            # Pricing system guide
│   ├── claude-assistance.md                # Claude AI guidelines
│   └── ...                                 # Many more guides
├── migration/                              # Migration guides and procedures
│   └── page-consolidation.md               # Page structure migration
├── refactoring/                            # Refactoring plans and documentation
│   └── booking-component.md                # Booking component plans
└── fixes/                                  # Documentation of specific fixes
    └── multilingual-property-names.md      # Property name translations
```

### Documentation Categories

#### Architecture (`/architecture`)
High-level system design documents explaining how the platform is structured.

#### Implementation (`/implementation`)
Technical implementation details, status tracking, and specifications for features.

#### Guides (`/guides`)
How-to guides for developers and users, covering both development and feature usage.

#### Migration (`/migration`)
Step-by-step procedures for migrating between different system versions.

#### Refactoring (`/refactoring`)
Plans and documentation for code improvements and restructuring.

#### Fixes (`/fixes`)
Documented solutions to specific issues encountered during development.

#### Troubleshooting
Central guide for common issues and their solutions.

## Contributing to Documentation

When adding new documentation:

1. **Choose the right category**: Place documents in the appropriate directory based on their purpose
2. **Follow naming conventions**: Use kebab-case for file names (e.g., `my-new-feature.md`)
3. **Include in README**: Update this README to include links to new documents
4. **Cross-reference**: Link to related documents where appropriate
5. **Keep it current**: Update documentation when features change
6. **Use clear headings**: Structure documents with clear, hierarchical headings
7. **Add examples**: Include code examples and diagrams where helpful

For more details on documentation standards, see [Claude AI Assistance](guides/claude-assistance.md).

---

*Last updated: November 2024*