# RentalSpot Builder

A property rental website builder and management system built with Next.js and Firebase.

## Features

- Property management with customizable templates
- Multi-page property websites
- Booking management system
- Dynamic pricing with seasonal rates, date overrides, and length-of-stay discounts
- Availability preview for checking multiple date ranges
- Payment processing with Stripe
- Admin panel for managing properties, bookings, and inquiries
- Multi-currency support
- Custom domain support
- Nothing else

## Documentation

This project has comprehensive documentation available in the [`/docs`](docs) directory:

- [System Architecture](docs/architecture/overview.md) - Complete overview of the system design
- [Multi-Page Architecture](docs/architecture/multipage-architecture.md) - Multi-page website structure
- [Implementation Guides](docs/implementation/) - Implementation plans and guides
- [Refactoring Plans](docs/refactoring/) - Documentation for code refactoring efforts
- [Usage Guides](docs/guides/) - Best practices and usage guides
- [Firebase Client SDK for Admin Usage](docs/guides/firebase-admin-setup.md) - Using Firebase Client SDK for admin operations
- [Admin Server Components Architecture](docs/architecture/admin-server-components.md) - Server component architecture for admin pages

See the [documentation index](docs/README.md) for a complete list of available documentation.

## Getting Started

To get started with development:

```bash
npm install
npm run dev
```

The application will be available at http://localhost:9002.

## Environment Variables

See `.env.example` for required environment variables.