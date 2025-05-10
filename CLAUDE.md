# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server on port 9002 with turbopack
npm run dev

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Build for production
npm run build

# Start production server
npm run start

# Load property data from JSON files into Firestore
npm run load-properties

# Ensure property booking options are set correctly
npm run ensure-property-options

# Start genkit AI for development
npm run genkit:dev

# Start genkit AI with watch mode
npm run genkit:watch
```

## System Architecture

RentalSpot is a Next.js-based property rental management platform built with Firebase services:

**Tech Stack:**
- **Frontend**: Next.js 15, React 18, Tailwind CSS, Shadcn UI components
- **Backend**: Firebase (Firestore, Authentication)
- **Payment**: Stripe integration
- **Auth**: Firebase Authentication with Google Sign-In

**Key Directories:**
- `/src/app` - Next.js App Router pages and layouts
- `/src/components` - React components organized by feature
- `/src/contexts` - React context providers (Auth, Currency)
- `/src/services` - Backend services for booking, inquiries, etc.
- `/src/lib` - Utility functions and configurations
- `/firestore` - JSON files for seeding Firestore data

## Key Data Models

The application uses these main Firestore collections:

1. **`properties/{propertySlug}`**: Core property metadata (prices, location, settings)
2. **`websiteTemplates/{templateId}`**: Template definitions with default content
3. **`propertyOverrides/{propertySlug}`**: Property-specific content overrides
4. **`availability/{propertySlug}_{YYYY-MM}`**: Availability data per property per month
5. **`bookings/{bookingId}`**: Booking records with status tracking
6. **`inquiries/{inquiryId}`**: Guest inquiries and responses
7. **`coupons/{couponId}`**: Discount codes with validity rules
8. **`appConfig/currencyRates`**: Application configuration including currency rates

## Property Template System

The property template system works as follows:

1. **Base Templates** (`websiteTemplates` collection) define possible content blocks and their default content
2. **Property Overrides** (`propertyOverrides` collection) store property-specific content changes
3. **Content Resolution** follows the pattern: `finalContent = overrides[blockId] ?? template.defaults[blockId]`
4. **Visibility Control** is managed through `visibleBlocks` array in property overrides

Array fields (like `features`, `attractions`, etc.) are replaced entirely when overridden, not merged.

## Booking Flow

The multi-step booking flow includes:

1. **Initial Form** - User selects dates on property page
2. **Availability Check** - System verifies dates are available
3. **Booking Options** - User can:
   - Contact (create inquiry)
   - Hold reservation (pay hold fee)
   - Book directly (pay full amount)
4. **Guest Information** - User provides name, email, phone, etc.
5. **Payment** - Redirects to Stripe for secure payment
6. **Confirmation** - Webhook updates booking status after payment

## Admin Features

The admin dashboard (`/admin` routes) provides:

1. **Property Management** - Create, edit, delete properties
2. **Booking Management** - View, update status, handle holds
3. **Inquiry Management** - View, respond to inquiries
4. **Coupon Management** - Create, edit, activate/deactivate coupons

Protected with Firebase Authentication (Google Sign-in).

## Multi-Domain Support

Properties can be configured with custom domains:
- The `customDomain` field in property documents sets the domain
- Next.js middleware (`src/middleware.ts`) handles domain resolution
- API route (`/api/resolve-domain`) maps domains to property slugs

## Currency Conversion

The system supports multiple currencies (USD, EUR, RON):
- Exchange rates stored in Firestore (`appConfig/currencyRates`)
- `CurrencyContext` provides currency conversion throughout the app
- Users can switch currencies with the `CurrencySwitcher` component

## Security and Validation

1. **Firestore Security Rules** - Defined in `firestore.rules`
2. **Zod Schemas** - Used for data validation throughout the application
3. **Input Sanitization** - Functions in `src/lib/sanitize.ts` prevent XSS

## Environment Variables

Required environment variables:
- `NEXT_PUBLIC_FIREBASE_*` - Firebase configuration 
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook verification secret
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Google Maps API key
- `NEXT_PUBLIC_MAIN_APP_HOST` - Main application hostname

Optional:
- `GOOGLE_GENAI_API_KEY` - Google AI services
- `TWILIO_*` - SMS notification service
- `FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH` - Path to service account file