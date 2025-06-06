
# RentalSpot - Short Rental Management System — Technical Architecture Documentation

## 📌 Purpose

This documentation defines the current architecture, data model, frontend logic, admin panel behavior, and conventions for the **RentalSpot** short-term rental management system.

It serves as the baseline documentation for the system. Any future changes or architectural updates must be appended as new sections or updates here.

---

## 🏗️ 1. **System Overview**

The system manages short-term rental properties through:

- **Property metadata storage** in Firestore (`properties` collection).
- **Template definition** for website structure and default content (`websiteTemplates` collection).
- **Property-specific content overrides** and visibility settings (`propertyOverrides` collection).
- **Multi-step booking flow** with availability check, guest info collection, optional inquiry/hold paths, and Stripe payment processing.
- **Booking data storage** in Firestore (`bookings` collection), including 'on-hold' status.
- **Inquiry data storage** in Firestore (`inquiries` collection).
- **Availability data storage** per property per month (`availability` collection) as single source of truth, including hold tracking.
- **Pricing data storage** per property per month (`priceCalendars` collection) for rate management and pricing calculations.
- **Coupon management** system with Firestore storage (`coupons` collection) and admin interface.
- **Admin interface** for managing coupons, properties, bookings (including holds), and inquiries.
- **Frontend & backend validation** using Zod schemas.
- **Google Analytics integration** per property.
- **Multi-domain support** allowing properties to be accessed via custom domains or path-based URLs.
- **Multipage support** using optional catch-all routes (`[[...path]]`) for property websites.
- **Dynamic theme system** supporting multiple visual themes with real-time preview (Enhanced with proper color palette generation).
- **Multilingual system** using `tc()` function for template-based content translations.
- **Dynamic pricing** with seasonal rates, date overrides, and length-of-stay discounts stored in Firestore.
- **Input sanitization** for user-provided data.
- **Admin area protection** via Google Sign-In (Server components architecture).
- **Currency Conversion:** Uses exchange rates stored in Firestore (`appConfig/currencyRates`) to display prices in user-selected currencies (USD, EUR, RON).
- **Edge Runtime optimization** for better performance and serverless deployment.
- **Scheduled Tasks (Cron):** Placeholder scripts exist for releasing expired holds and updating currency rates (requires deployment and scheduling).

### 🆕 Recent Architecture Updates (June 2025)

- **Availability Deduplication Completed**: Successfully migrated from dual-storage (availability + priceCalendars) to single-source architecture where `availability` collection is the authoritative source for availability data.
- **Legacy Code Cleanup**: Removed all feature flags and legacy code paths related to the availability migration.
- **Performance Improvements**: Simplified availability checking with single-source queries, reducing complexity and improving response times.
- **Data Consistency**: Eliminated sync issues between availability and pricing data through clear separation of concerns.

Initial support: 2 properties (Prahova Mountain Chalet, Coltei Apartment Bucharest)
Designed for scalability.

---

## 📁 2. **Project File Structure**

This section outlines the key directories and their purposes within the project.

```
rentalspot/
├── .env.local           # Local environment variables (API keys, secrets) - DO NOT COMMIT
├── .next/               # Next.js build output (generated)
├── components/          # Reusable React components
│   ├── booking/         # Booking flow components
│   │   ├── container/   # Container components for booking flow
│   │   ├── forms/       # Booking, hold, and contact forms
│   │   ├── sections/    # Availability and common sections
│   │   └── hooks/       # Booking-specific hooks
│   ├── homepage/        # Components for specific homepage sections
│   │   ├── hero-section.tsx # Hero section with dynamic positioning
│   │   ├── hero-helper.ts # Helper for hero positioning
│   │   └── ... # Other homepage components
│   ├── property/        # Components related to displaying property details
│   │   ├── property-page-layout.tsx # Main layout component
│   │   ├── property-page-renderer.tsx # Dynamic content renderer
│   │   └── ... # Other property components
│   ├── ui/              # Shadcn UI components (Button, Card, Input, etc.)
│   ├── generic-header.tsx # Single page header component
│   ├── generic-header-multipage.tsx # Multipage header component
│   ├── currency-switcher.tsx # Currency selection component
│   └── theme-switcher.tsx # Theme selection component
├── dataconnect/         # Firebase Data Connect configuration (if used)
├── dataconnect-generated/ # Generated Data Connect SDK (if used)
├── firestore/           # JSON files for seeding Firestore data
│   ├── properties/      # Property metadata JSON files (e.g., prahova-mountain-chalet.json)
│   ├── propertyOverrides/ # Property content override JSON files (includes multipage structures)
│   ├── websiteTemplates/  # Website template definition JSON files (includes multipage templates)
│   ├── appConfig/       # Application configuration JSON files (e.g., currencyRates.json)
│   ├── dateOverrides/   # Price overrides for specific dates (e.g., christmas-2023.json)
│   ├── seasonalPricing/ # Seasonal pricing rules (e.g., summer-season-2024.json)
│   ├── priceCalendars/  # Generated price calendar data per property
│   └── pricingTemplates/# Base pricing templates
├── hooks/               # Custom React hooks (e.g., useSessionStorage, useToast, useSanitizedState, useIsMobile)
├── lib/                 # Utility functions, libraries, configurations
│   ├── firebase.ts      # Firebase Client SDK initialization
│   ├── firebaseAdmin.ts # Firebase Admin SDK initialization (Edge Runtime compatible)
│   ├── overridesSchemas.ts # Zod schemas for template/override content validation
│   ├── price-utils.ts   # Pricing calculation logic
│   ├── sanitize.ts      # Input sanitization functions
│   ├── utils.ts         # General utility functions (e.g., cn for Tailwind)
│   ├── theme-utils.ts   # Theme system utilities and color palette generation
│   ├── hero-helper.ts   # Helper functions for hero section positioning
│   ├── page-header-helper.ts # Helper functions for page header positioning
│   ├── themes/          # Theme definitions and utilities
│   │   ├── theme-definitions.ts # Available theme configurations
│   │   ├── theme-types.ts # TypeScript types for themes
│   │   └── theme-utils.ts # Theme utility functions
│   ├── pricing/         # Dynamic pricing system
│   │   ├── price-calculation.ts # Price calculation logic
│   │   ├── price-calendar-generator.ts # Calendar generation
│   │   ├── price-calendar-updater.ts # Calendar update logic
│   │   └── pricing-schemas.ts # Zod schemas for pricing
│   └── server/
│       └── pricing-data.ts # Server-side pricing data access
├── node_modules/        # Project dependencies (managed by npm/yarn)
├── public/              # Static assets (images, fonts, favicon)
│   └── images/          # Default images for templates and placeholders
├── scripts/             # Utility scripts
│   ├── cron/            # Scripts intended for scheduled execution (placeholders)
│   │   ├── release-expired-holds.ts
│   │   └── update-currency-rates.ts
│   ├── load-properties.ts # Script to load JSON data into Firestore
│   └── convertTimestamps.ts # Helper for timestamp conversion in load script
├── src/                 # Main application source code (using src directory convention)
│   ├── app/             # Next.js App Router directory
│   │   ├── admin/       # Admin panel routes (Server Components)
│   │   │   ├── _components/ # Admin-specific client components
│   │   │   ├── bookings/  # Booking management pages and components
│   │   │   ├── coupons/   # Coupon management pages and components
│   │   │   ├── inquiries/ # Inquiry management pages and components ([inquiryId] for detail)
│   │   │   ├── properties/# Property management pages and components ([slug]/edit, new)
│   │   │   ├── pricing/   # Dynamic pricing management interface
│   │   │   │   ├── _components/ # Pricing UI components
│   │   │   │   ├── date-overrides/ # Date-specific pricing overrides
│   │   │   │   └── seasons/ # Seasonal pricing configuration
│   │   │   └── layout.tsx # Admin panel layout (Server Component)
│   │   ├── api/         # API routes
│   │   │   ├── resolve-domain/ # API for domain resolution
│   │   │   ├── check-pricing/ # Pricing calculation API
│   │   │   ├── check-availability/ # Availability checking API
│   │   │   └── webhooks/     # Webhook handlers (e.g., Stripe)
│   │   ├── booking/     # Booking flow pages (check, success, cancel, hold-success)
│   │   │   └── check/
│   │   │       └── [slug]/
│   │   │           └── page.tsx # Availability check page
│   │   ├── properties/  # Dynamic property detail pages
│   │   │   └── [slug]/
│   │   │       ├── [[...path]]/ # Optional catch-all for multipage support
│   │   │       │   └── page.tsx
│   │   │       └── page.tsx # Single page fallback
│   │   ├── login/       # Login page for admin access
│   │   ├── globals.css  # Global CSS styles and Tailwind base layers
│   │   ├── layout.tsx   # Root application layout
│   │   └── page.tsx     # Homepage component (renders default property)
│   │   └── actions/       # Server Actions (e.g., booking, checkout, coupon, property, inquiry actions)
│   ├── contexts/          # React Contexts
│   │   ├── AuthContext.tsx # Authentication state management
│   │   ├── CurrencyContext.tsx # Currency selection state
│   │   ├── BookingContext.tsx # Booking flow state management
│   │   └── ThemeContext.tsx # Dynamic theme state management
│   ├── services/          # Backend services
│   │   ├── bookingService.ts # Booking operations
│   │   ├── couponService.ts # Coupon validation and management
│   │   ├── inquiryService.ts # Inquiry management
│   │   ├── pricingService.ts # Dynamic pricing calculations
│   │   ├── availabilityService.ts # Availability checking
│   │   ├── emailService.ts # Email notifications
│   │   └── configService.ts # App configuration
├── .firebaserc          # Firebase project configuration (linking to project ID)
├── .gitignore           # Files and directories ignored by Git
├── components.json      # Shadcn UI configuration
├── DOCUMENTATION.md     # This file
├── firebase.json        # Firebase project configuration (Hosting, Emulators, Firestore rules path)
├── firestore.indexes.json # Firestore index definitions
├── firestore.rules      # Firestore security rules
├── next.config.ts       # Next.js configuration
├── package.json          # Project dependencies and scripts
├── README.md             # Project README
└── tsconfig.json         # TypeScript configuration
```

---

## 🗂️ 3. **Firestore Collections**

| Collection                       | Description                                                                 | Document ID Format        | Key Fields                                                                                                                                          |
| :------------------------------- | :-------------------------------------------------------------------------- | :------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/properties/{propertySlug}`     | Core metadata & settings for each property                                  | Property Slug             | `templateId`, `name`, `slug`, `location`, `pricePerNight`, `baseCurrency`, `maxGuests`, `baseOccupancy`, `holdFeeAmount`, `enableHoldOption`, `theme`, `themeSettings`, etc. |
| `/propertyOverrides/{propertySlug}`| Content overrides & section visibility per property                      | Property Slug             | `visibleBlocks`, `hero`, `features`, `attractions`, `testimonials`, `images`, `contentTranslations`, `pages` (for multipage), etc.                 |
| `/websiteTemplates/{templateId}` | Defines template structure + default block content                        | Template ID               | `homepage`, `header`, `footer`, `defaults`, `contentTranslations`, `pages` (for multipage templates)                                              |
| `/amenities/{amenityId}`         | Standardized amenities with translations                                  | Amenity ID                | `id`, `name` (multilingual), `icon`, `category` (multilingual)                                                                                    |
| `/features/{featureId}`          | Property features with translations                                       | Feature ID                | `id`, `title` (multilingual), `description` (multilingual), `icon`, `order`                                                                       |
| `/availability/{propertySlug}_{YYYY-MM}` | Availability status per property, per day, grouped by month             | `{propertySlug}_{YYYY-MM}`| `propertyId`, `month`, `available` (map day->bool), `holds` (map day->bookingId)                                                                    |
| `/bookings/{bookingId}`          | Booking records                                                           | Auto-generated ID         | `propertyId`, `guestInfo`, `checkInDate`, `checkOutDate`, `status` ('pending', 'on-hold', 'confirmed', 'cancelled', 'completed'), `pricing`, `holdUntil`, `holdFee`, `holdPaymentId`, etc. |
| `/inquiries/{inquiryId}`         | Guest inquiries                                                           | Auto-generated ID         | `propertySlug`, `checkIn`, `checkOut`, `guestInfo`, `message`, `status` ('new', 'responded', 'converted', 'closed'), `responses` (array)             |
| `/coupons/{couponId}`            | Discount codes and their rules                                            | Auto-generated ID         | `code`, `discount`, `validUntil`, `isActive`, `bookingValidFrom`, `bookingValidUntil`, `exclusionPeriods`                                         |
| `/users/{userId}`                | User profiles (guests, owners, admins)                                     | Firebase Auth User ID     | `email`, `role`, `firstName`, `lastName`, etc.                                                                                                      |
| `/reviews/{reviewId}`            | Guest reviews (schema defined, implementation pending)                    | Auto-generated ID         | `propertyId`, `rating`, `comment`, etc.                                                                                                           |
| `/syncCalendars/{documentId}`    | Calendar sync info (schema defined, implementation pending)               | Auto-generated ID         | `propertyId`, `platform`, `calendarId`, etc.                                                                                                      |
| `/availabilityAlerts/{alertId}`  | Requests for availability notifications (schema defined, backend pending) | Auto-generated ID         | `propertyId`, `checkInDate`, `checkOutDate`, `contactMethod`, etc.                                                                                |
| `/appConfig/currencyRates`       | Application-wide configuration, starting with currency rates              | `currencyRates`           | `rates` (map currency->rate), `lastUpdated`                                                                                                       |
| `/priceCalendars/{propertySlug}_{YYYY-MM}` | Generated price calendar data per property per month            | `{propertySlug}_{YYYY-MM}`| `propertySlug`, `month`, `year`, `days` (array of daily pricing)                                                                                   |
| `/seasonalPricing/{seasonId}`    | Seasonal pricing rules across properties                                  | Auto-generated ID         | `name`, `startDate`, `endDate`, `pricePerNight`, `currency`, `applicablePropertySlugs`                                                           |
| `/dateOverrides/{overrideId}`    | Date-specific price overrides                                             | Auto-generated ID         | `propertySlug`, `date`, `pricePerNight`, `name`, `description`                                                                                    |
| `/lengthOfStayDiscounts/{discountId}` | Length of stay discount rules                                       | Auto-generated ID         | `propertySlug`, `minNights`, `maxNights`, `discountPercentage`                                                                                    |

✅ **`propertySlug` is the canonical identifier for properties.**

---

## 📝 4. **Template Structure (`/websiteTemplates/{templateId}`)**

Each template document defines the available blocks and their default content.

```json
{
  "templateId": "holiday-house",
  "name": "Holiday House Template",
  "homepage": [ // Defines the *possible* blocks and their order/type
    { "id": "hero", "type": "hero" },
    { "id": "experience", "type": "experience" },
    { "id": "host", "type": "host" },
    { "id": "features", "type": "features" },
    { "id": "location", "type": "location" },
    { "id": "testimonials", "type": "testimonials" },
    { "id": "gallery", "type": "gallery" },
    { "id": "cta", "type": "cta" }
    // Add other block types as needed (e.g., 'details', 'amenities', 'rules', 'map', 'contact', 'separator')
  ],
  "header": { // Default header structure
    "menuItems": [ { "label": "Home", "url": "/" }, ... ],
    "logo": { "src": "/images/templates/holiday-house/logo.svg", "alt": "Holiday House" }
  },
  "footer": { // Default footer structure
     "quickLinks": [ ... ],
     "contactInfo": { ... },
     "socialLinks": [ ... ]
  },
  "defaults": { // Default content for each block ID defined in "homepage"
    "hero": {
        "backgroundImage": "/images/templates/holiday-house/default-hero.jpg",
        "title": "Welcome to Your Holiday House",
        "price": 150,
        "showRating": true,
        "showBookingForm": true,
        "bookingForm": { "position": "bottom", "size": "large" }
    },
    "experience": {
        "title": "Experience Relaxation",
        "description": "A cozy holiday house perfect for family getaways.",
        "highlights": [
          { "icon": "Leaf", "title": "Nature", "description": "Surrounded by beautiful nature." },
          { "icon": "Users", "title": "Family Friendly", "description": "Ideal for family vacations." }
        ]
    },
    "features": [ // Default features if overrides not provided
        { "icon": "firepit", "title": "Fire Pit", "description": "...", "image": "/images/templates/holiday-house/default-firepit.jpg", "data-ai-hint": "fire pit night" }
    ],
    "location": {
         "title": "Discover Nearby Attractions",
         "mapCenter": { "lat": 45.2530, "lng": 25.6346 } // Example default
    },
    "attractions": [ // Default attractions
         { "name": "Default Attraction", "description": "...", "image": "/images/templates/holiday-house/default-attraction.jpg", "data-ai-hint": "landmark" }
    ],
    "testimonials": { // Default testimonials wrapper
        "title": "What Guests Say",
        "showRating": true,
        "reviews": [ // Default reviews
             { "name": "Jane D.", "rating": 5, "text": "Wonderful stay!", "imageUrl": "/images/templates/holiday-house/default-guest.jpg", "data-ai-hint": "happy guest" }
        ]
    },
     "gallery": { // Default gallery wrapper
         "title": "Property Gallery",
         "images": [ // Default gallery images (distinct from top-level overrides.images)
             { "url": "/images/templates/holiday-house/default-gallery-1.jpg", "alt": "Living Room", "data-ai-hint": "chalet living room" }
         ]
     },
    "cta": {
        "title": "Book Your Stay",
        "description": "...",
        "buttonText": "Book Now",
        "backgroundImage": "/images/templates/holiday-house/default-cta.jpg",
        "data-ai-hint": "mountain panorama"
    }
    // ... defaults for other blocks
  }
}
```

✅ `homepage` defines **structure + order of blocks**.
✅ `defaults` provides **fallback content per block id**.

---

## 📝 5. **Property Overrides (`/propertyOverrides/{propertySlug}`)**

Stores **property-specific content overrides** and **visibility settings**. Contains *only* what differs from the template defaults or controls visibility.

```json
{
  "visibleBlocks": [ // Which blocks from the template's homepage array should be shown?
    "hero",
    "experience",
    "host",
    "features",
    "location",
    "testimonials",
    "cta",
    "gallery"
  ],
  // Overrides for specific block content (only include fields that differ from defaults)
  "hero": { // Override object for the 'hero' block
    "backgroundImage": "https://picsum.photos/seed/chalet-override/1200/800",
    "data-ai-hint": "specific hint for prahova chalet hero",
    "bookingForm": { "position": "center", "size": "large" }
  },
  "experience": {
     "title": "Experience Prahova's Majesty",
     "highlights": [ { "icon": "Mountain", "title": "Prahova Mountain Retreat", "description": "..." } ]
  },
  "host": {
      "name": "Bogdan C.",
      "imageUrl": "https://picsum.photos/seed/host-bogdan/200/200",
      "description": "Welcome to my chalet!", // Corresponds to welcomeMessage in component
      "backstory": "I built this place...",
      "data-ai-hint": "friendly male host portrait outdoors"
  },
  "features": [ // Override array for the 'features' block
    { "icon": "firepit", "title": "Fire Pit", "description": "...", "image": "https://picsum.photos/seed/firepit/400/300", "data-ai-hint": "fire pit night" },
    { "icon": "hammock", "title": "Hammocks", "description": "...", "image": "https://picsum.photos/seed/hammock/400/300", "data-ai-hint": "hammock forest relax" }
    // If this array exists, it *replaces* the template.defaults.features array entirely
  ],
  "location": { "title": "Explore Comarnic & Beyond" },
  "attractions": [ // Override array for attractions
      { "name": "Dracula Castle", "description": "...", "image": "https://picsum.photos/seed/dracula/400/300", "data-ai-hint": "Dracula Castle Bran" },
      { "name": "Ialomita Cave", "description": "...", "image": "https://picsum.photos/seed/ialomita/400/300", "data-ai-hint": "Ialomita Cave entrance" }
  ],
  "testimonials": { // Override object for testimonials
      "title": "Guest Experiences",
      "reviews": [ // Override array for reviews
          { "name": "Maria D.", "date": "2025-06", "rating": 5, "text": "Amazing!", "imageUrl": "https://picsum.photos/seed/guest-maria/100/100", "data-ai-hint": "happy female female guest" }
      ]
  },
   "gallery": { "title": "Chalet Gallery" }, // Overrides the title for the gallery section
   "images": [ // Override array for gallery images (this is for the GallerySection, distinct from hero's backgroundImage)
      { "url": "https://picsum.photos/seed/gallery-img1/800/600", "alt": "Living Room", "data-ai-hint": "chalet living room interior" },
      { "url": "https://picsum.photos/seed/gallery-img2/800/600", "alt": "Bedroom", "data-ai-hint": "chalet bedroom cozy" }
   ],
  "cta": {
      "title": "Ready for Your Mountain Getaway?",
      "buttonText": "Book Your Stay Now",
      "backgroundImage": "https://picsum.photos/seed/cta-override/1200/600",
      "data-ai-hint": "mountain panorama sunset"
  }
  // Add other block overrides as needed
}
```

✅ **Content is merged per block:** `finalContent = overrides[blockId] ?? template.defaults[blockId]`
✅ **Arrays replace entirely:** If `overrides.features` exists, it replaces `template.defaults.features`. If `overrides.features` is absent, `template.defaults.features` is used. This applies to `attractions`, `testimonials.reviews`, and `images` (for gallery) as well.
✅ `visibleBlocks` array dictates which sections are rendered.

---

## 📝 6. **Schema Definitions (`src/lib/overridesSchemas.ts`)**

All block content (in `template.defaults` and `propertyOverrides`) must follow their corresponding schema defined centrally.

✅ Central schema definitions in: `src/lib/overridesSchemas.ts`
✅ Each schema is a Zod object (e.g., `heroSchema`, `experienceSchema`).
✅ A `blockSchemas` map is exported for dynamic validation.
✅ **Validation MUST always use these schemas** (frontend, admin, backend). No duplicate schemas or logic.
✅ The `propertyOverridesSchema` in the same file is used to validate the entire structure of a `propertyOverrides` document.

---

## 📝 6.1. **Multipage Template Structure**

Properties can optionally use a multipage structure, enabled by the `pages` array in templates and overrides:

```json
{
  "templateId": "holiday-house-multipage",
  "pages": [
    {
      "id": "home",
      "title": "Home", 
      "path": "/",
      "blocks": ["hero", "experience", "features"],
      "header": { "transparent": true }
    },
    {
      "id": "amenities",
      "title": "Amenities",
      "path": "/amenities",
      "blocks": ["amenities-hero", "amenities-list", "amenities-gallery"],
      "header": { "transparent": false }
    }
  ]
}
```

✅ Routes are handled by `[[...path]]` catch-all routing
✅ Each page can have its own set of blocks
✅ Headers can be configured per page (transparent, position, etc.)
✅ Content translations supported via `tc()` function

---

## 🚀 7. **Frontend Rendering Logic (Updated)**

For each block defined in `template.homepage`:

1. Check if `block.id` is present in `overrides.visibleBlocks` (or default to showing if `visibleBlocks` is missing). If not visible, skip rendering.
2. Fetch the block's content:
   - Try `overrides[blockId]` (e.g., `overrides.hero`, `overrides.features`).
   - If the override for `blockId` exists (even if it's an empty object/array for relevant types like `features`, `attractions`, `testimonials.reviews`, `images`), use it.
   - If the override for `blockId` does *not* exist, fall back to `template.defaults[blockId]`.
3. Validate the **final chosen content** (either override or default) using the corresponding schema from `src/lib/overridesSchemas.ts`.
4. Render the block component with the validated content.
5. If content is invalid or missing after fallback → optionally skip rendering or show an error placeholder.

✅ No hardcoded defaults in frontend components.
✅ Rendering is driven by template structure, visibility flags, and merged content (override > default).

---

## 🎨 7.1. **Dynamic Theme System**

Properties support multiple visual themes with CSS variables and real-time preview:

- **Theme Configuration**: Stored in `property.theme` and `property.themeSettings`
- **Available Themes**: modern, rustic, beach, mountain, minimal, luxury
- **Theme Features**:
  - Dynamic color palette generation from primary/secondary colors
  - CSS variables for consistent styling
  - Real-time preview in admin interface
  - Support for light/dark contrast calculations
  - Button style variants (solid, outline, ghost)
  
✅ Theme utilities in `src/lib/theme-utils.ts`
✅ Theme definitions in `src/lib/themes/`
✅ Applied via CSS variables in root layout

---

## 💰 7.2. **Dynamic Pricing System**

Advanced pricing system supporting multiple pricing strategies:

- **Price Calendars**: Generated monthly calendars with daily pricing
- **Seasonal Pricing**: Date ranges with specific rates
- **Date Overrides**: Special pricing for specific dates (holidays, events)
- **Length of Stay Discounts**: Percentage discounts based on booking duration
- **Base Pricing**: Property's default rate as fallback

**Price Calculation Priority**:
1. Date-specific overrides (highest priority)
2. Seasonal pricing
3. Generated calendar prices
4. Base property price (fallback)

✅ Price calculation in `src/lib/pricing/price-calculation.ts`
✅ Calendar generation in `src/lib/pricing/price-calendar-generator.ts`
✅ Admin UI in `src/app/admin/pricing/`

---

## ⚙️ 8. **Booking Flow (Multi-Step)**

1.  **Initial Form (`InitialBookingForm`):** User selects dates on the property page (Hero section or elsewhere). "Check Availability" button is clicked.
2.  **Navigation:** User is navigated to `/booking/check/{propertySlug}?checkIn=...&checkOut=...`.
3.  **Availability Check Page (`AvailabilityCheck` component):**
    *   Fetches availability data from `/availability/{propertySlug}_YYYY-MM` documents for the selected date range.
    *   Displays property summary, selected dates.
    *   Calculates and shows price breakdown (including potential extra guest fees).
    *   **If Available:** Shows "Dates Available!" message, compact booking summary, and option cards (Contact, Hold, Book Now).
    *   **If Unavailable:** Shows "Dates Unavailable" message, displays the 3-month availability calendar, suggests alternative dates (placeholder logic for now), and offers the "Notify Me" option.
4.  **User Action Selection:**
    *   User clicks one of the option cards (Contact, Hold, Book Now).
    *   The selected card expands, revealing the relevant form.
5.  **Option-Specific Forms:**
    *   **Contact:** User fills in name, email, phone, message. Submits via `createInquiryAction`.
    *   **Hold:** User fills in name, email, phone. Clicks "Hold for ${fee}". `createHoldBookingAction` is called, then `createHoldCheckoutSession` redirects to Stripe for the hold fee.
    *   **Book Now:** User fills in name, email, phone, guest count, optional coupon. Clicks "Continue to Payment". `createPendingBookingAction` is called, then `createCheckoutSession` redirects to Stripe for the full amount.
6.  **Session Storage:** User inputs (name, email, phone, guest count, dates) are persisted in session storage to avoid data loss between steps/refreshes.
7.  **Stripe Payment:** User completes payment (hold fee or full booking amount) on Stripe.
8.  **Webhook Confirmation (`/api/webhooks/stripe`):**
    *   Stripe sends `checkout.session.completed` event.
    *   Webhook verifies the event.
    *   Extracts `pendingBookingId` or `holdBookingId` from metadata.
    *   Determines payment type (hold or full booking) from metadata.
    *   Calls `updateBookingPaymentInfo` (`bookingService`):
        *   Updates the corresponding booking document status (`on-hold` or `confirmed`).
        *   Adds payment details (`paymentInfo` or `holdPaymentId`).
        *   Calls `updatePropertyAvailability` to mark dates as unavailable or on-hold in Firestore.
        *   (Future) Triggers external calendar sync.
    *   Returns `200 OK` to Stripe.
9.  **Redirect to Success/Cancel Page:** Stripe redirects the user to `/booking/success`, `/booking/hold-success`, or `/booking/cancel` based on payment outcome.

---

## 🏷️ 9. **Coupon System**

- Coupons stored in `/coupons/{couponId}` collection.
- Schema includes code, discount %, validity dates, activity status, optional booking timeframe, optional exclusion periods, optional property restriction.
- Admin pages (`/admin/coupons/new`, `/admin/coupons`) allow creation and management (view, toggle status, edit expiry/validity/exclusions).
- `couponService.ts` contains `validateAndApplyCoupon` function used in the booking flow to check validity based on dates, exclusions, etc., before applying the discount.
- Input sanitization is applied to coupon code and description fields.

---

## 📐 9.1. **Component Positioning System**

Dynamic positioning system for headers and booking forms:

- **Hero Positioning**: Forms can be positioned at different locations (bottom, center, side)
- **Page Headers**: Support for transparent/solid headers with dynamic positioning
- **Helper Utilities**:
  - `hero-helper.ts`: Calculates form positioning in hero sections
  - `page-header-helper.ts`: Manages header transparency and positioning
- **Responsive Design**: Different positioning on mobile vs desktop

---

## 🌐 9.2. **Multilingual Content System**

Template-based translation system using the `tc()` function:

```typescript
// Usage in components
tc(template.defaults.hero, "title", locale) || "Default Title"
```

- **Translation Structure**: Content translations stored in `contentTranslations` object
- **Locale Support**: Currently supports English (en) and Romanian (ro)
- **Fallback Logic**: Falls back to default language if translation missing
- **Template Integration**: Works with both templates and property overrides

✅ Translations defined per block in templates/overrides
✅ Seamless integration with dynamic content
✅ No separate translation files needed

---

## 🖼️ 10. **Image Storage & Referencing**

✅ **Static Template Images:** Default images used in `template.defaults` (e.g., `/images/templates/holiday-house/default-hero.jpg`) MUST be stored in `/public/images/templates/{templateId}/...` or a similar structure within `/public`. Reference using relative paths from the root (e.g., `/images/templates/holiday-house/default-hero.jpg`).
✅ **Property Override Images:** Images specific to a property (hero background override, feature images, attraction images, gallery images) are referenced by their **full URLs** (e.g., from Firebase Storage, Cloudinary, Picsum) directly within the `/propertyOverrides/{propertySlug}` document. Placeholder images from `picsum.photos` include a `data-ai-hint` attribute.
✅ **No Image ID References:** The system does *not* use a separate `/images` collection or reference images by ID. Image URLs are embedded directly where they are used in the overrides.
✅ `next/image` component should be used for optimized image loading. `data-ai-hint` attribute is used on placeholder images for future AI-driven image selection.

---

## 🔒 11. **Firestore Security Rules**

Rules are defined in `firestore.rules` and should be deployed to Firebase. Key rules:

*   `/properties`: Read: `true`, Write: `if isOwner(propertySlug) || isAdmin()` (validation on `customDomain` during update)
*   `/websiteTemplates`: Read: `true`, Write: `if isAdmin()`
*   `/propertyOverrides`: Read: `true`, Write: `if isOwner(propertySlug) || isAdmin()`
*   `/availability`: Read: `true`, Write: `if true` (Client SDK handles writes for new bookings/holds, or admin can write - **REVIEW: might need stricter write rules for production**)
*   `/bookings`: Create: `true`, Read/Update: `if isGuest() || isOwner() || isAdmin()` (specific update rules for status needed)
*   `/inquiries`: Create: `true`, Read/Update: `if isGuest() || isOwner() || isAdmin()`
*   `/coupons`: Read: `true`, Write: `if isAdmin()`
*   `/users`: Read/Write: `if isSelf() || isAdmin()`
*   `/appConfig`: Read: `true`, Write: `if isAdmin()` (or a specific update function role)
*   (Others as defined)

---

## 🔐 12. **Authentication & Authorization**

*   **Authentication:**
    *   Method: Firebase Authentication with Google Sign-In.
    *   Process: Users sign in via Google on the `/login` page.
    *   Server Components: Admin area uses server-side authentication checks.
    *   State Management: `AuthContext` manages client-side auth state.
*   **Authorization:**
    *   Admin Routes: Protected using server-side middleware and components.
    *   `AdminAuthCheck` component validates auth state server-side.
    *   Edge Runtime compatible authentication using Firebase Admin SDK.
*   **Implementation:**
    *   Admin routes check authentication at the server level.
    *   No client-side redirects for protected routes.
    *   Session validation happens on each request.

---

## ⚡ 12.1. **Edge Runtime Optimization**

The application is optimized for Edge Runtime deployment:

*   **Firebase Admin SDK**: Modified to work with Edge Runtime limitations.
*   **Server Components**: Admin interface uses server components for better performance.
*   **No Node.js Dependencies**: Core functionality avoids Node.js-specific APIs.
*   **Middleware**: Edge-compatible middleware for routing and auth.
*   **Benefits**:
    *   Faster cold starts
    *   Global edge deployment
    *   Reduced infrastructure costs
    *   Better scalability

✅ Edge Runtime config in `next.config.ts`
✅ Compatible Firebase Admin in `firebaseAdmin.ts`
✅ Server components for admin interface

---

## 💻 13. **Admin Panel Behavior (Coupons, Bookings, Inquiries)**

*   **`/admin/coupons`:** Lists all coupons, shows status, allows editing expiry, toggling status, expanding to edit booking validity and exclusion periods.
*   **`/admin/coupons/new`:** Form to create new coupons with all fields.
*   **`/admin/bookings`:** Lists all bookings, shows status (including 'on-hold'), allows filtering by status, provides actions to extend hold, cancel hold, convert hold to confirmed.
*   **`/admin/inquiries`:** Lists all inquiries, shows status ('new', 'responded', 'converted', 'closed'), links to detail view.
*   **`/admin/inquiries/{inquiryId}`:** Detail view showing inquiry info, conversation history, form to add responses, actions to convert to booking or close.
*   **Server Actions** (`src/app/admin/.../actions.ts`) handle Firestore writes for creating/updating/managing entities.
*   Input sanitization is applied to user-submitted fields in the admin forms.

---

## ⚙️ 14. **Environment Variables**

This section lists the environment variables required or used by the application. Store sensitive keys in `.env.local` (which should be in `.gitignore`).

| Variable                                 | Purpose                                                                  | Scope         | Required | Example Value                     |
| :--------------------------------------- | :----------------------------------------------------------------------- | :------------ | :------- | :-------------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`           | Firebase API key for Client SDK                                          | Client/Server | Yes      | `AIzaSy...`                       |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`       | Firebase Auth domain                                                     | Client/Server | Yes      | `your-project-id.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`        | Firebase Project ID                                                      | Client/Server | Yes      | `your-project-id`                 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`    | Firebase Storage bucket URL                                              | Client/Server | Yes      | `your-project-id.appspot.com`     |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging Sender ID                                     | Client/Server | Yes      | `123456789012`                    |
| `NEXT_PUBLIC_FIREBASE_APP_ID`            | Firebase App ID                                                          | Client/Server | Yes      | `1:123...:web:...`                 |
| `STRIPE_SECRET_KEY`                      | Stripe Secret Key for server-side API calls (e.g., creating sessions)    | Server        | Yes      | `sk_test_...` or `sk_live_...`      |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`     | Stripe Publishable Key for client-side (e.g., initializing Stripe.js)    | Client        | Yes      | `pk_test_...` or `pk_live_...`      |
| `STRIPE_WEBHOOK_SECRET`                  | Stripe Webhook Signing Secret for verifying webhook events               | Server        | Yes      | `whsec_...`                       |
| `GOOGLE_GENAI_API_KEY`                   | API Key for Google AI (Genkit/Gemini)                                    | Server        | Optional | `AIzaSy...`                       |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`        | Google Maps API Key (for client-side map display)                        | Client        | Yes      | `AIzaSy...`                       |
| `TWILIO_ACCOUNT_SID`                     | Twilio Account SID (if using Twilio for SMS)                             | Server        | Optional | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN`                      | Twilio Auth Token (if using Twilio for SMS)                              | Server        | Optional | `your_auth_token`                 |
| `TWILIO_PHONE_NUMBER`                    | Twilio phone number used for sending SMS                                 | Server        | Optional | `+15551234567`                    |
| `FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH`    | Path to Firebase Admin SDK service account key file (for scripts/admin) | Server        | No       | `./serviceAccountKey.json`        |
| `NEXT_PUBLIC_MAIN_APP_HOST`              | The main hostname for the application (e.g., rentalspot.com)             | Client/Server | Yes      | `rentalspot.com`                  |

✅ **Note:** `NEXT_PUBLIC_` prefix exposes the variable to the client-side browser bundle. Variables without the prefix are only available server-side.

---

## 📊 15. **Google Analytics Integration**

- Per-property Google Analytics tracking is supported.
- The `properties` collection documents can include an `analytics` object:
  ```json
  "analytics": {
    "enabled": true,
    "googleAnalyticsId": "G-XXXXXXXXXX" // Property-specific GA ID
  }
  ```
- If `analytics.enabled` is true and `googleAnalyticsId` is provided, the `PropertyPageLayout` component dynamically injects the Google Analytics script tags.

---

## 🌐 16. **Multi-Domain Configuration**

- Properties can be configured to use a custom domain.
- The `properties` collection documents include:
  ```json
  "customDomain": "your-property.com", // The custom domain
  "useCustomDomain": true // Boolean to enable/disable custom domain
  ```
- Next.js middleware (`src/middleware.ts`) handles domain resolution:
    - It checks if the incoming request's hostname matches a configured custom domain for any active property (bypassing for localhost and main app host).
    - If a match is found, it rewrites the request to the standard `/properties/{slug}` path.
    - If no custom domain match, it proceeds with the default routing.
- An API route (`/api/resolve-domain`) is used by the middleware to query Firestore for properties matching a given domain.
- The main application host is defined by the `NEXT_PUBLIC_MAIN_APP_HOST` environment variable.

---

## 🛡️ 17. **Input Sanitization**

- User-provided inputs (e.g., guest information in booking form, coupon codes, descriptions in admin panel, inquiry messages) are sanitized to prevent XSS and other injection attacks.
- Sanitization is primarily handled:
    - Using Zod transforms in server actions (e.g., `createCouponAction`, `createPendingBookingAction`, `createInquiryAction`).
    - Client-side using the `useSanitizedState` hook for direct input field management where appropriate.
- The `src/lib/sanitize.ts` file contains utility functions for stripping HTML tags and performing basic sanitization for text, email, and phone numbers.
- The general approach is to sanitize data as close to the input source as possible or upon receiving it on the server before processing or storing.

---

## 📝 18. **Data Validation**

*   **Zod Schemas:**
    *   Schemas for website block content (`heroSchema`, `experienceSchema`, etc.) are defined in `src/lib/overridesSchemas.ts`.
    *   Schemas for server actions (e.g., coupon creation, pending booking, property creation/update, inquiry creation) are typically defined within the action files themselves or imported from shared locations.
*   **Usage:**
    *   Server actions use Zod schemas to validate incoming data.
    *   The Firestore data loader script (`scripts/load-properties.ts`) uses `blockSchemas` from `overridesSchemas.ts` to validate default block content in templates before uploading.
    *   Client-side forms (e.g., coupon creation, booking guest info, property form) use `zodResolver` with `react-hook-form` for validation.
*   **Error Handling:** Validation errors are generally returned to the client and displayed using toast notifications or form error messages.

---

## ⚙️ 19. **Firebase Console Setup Notes**

*   **Firestore Database:**
    *   Create a Firestore database in your Firebase project.
    *   Start in "Production mode" and apply security rules (see Section 11 and `firestore.rules`).
    *   Indexes can be configured via the Firebase Console ("Firestore Database" -> "Indexes") or `firestore.indexes.json`.
    *   Create the `appConfig/currencyRates` document manually with initial rates.
    *   Ensure the `properties` collection exists and contains documents with the correct slugs. Use the `load-properties.ts` script.
*   **Authentication:**
    *   Enable "Google" as a sign-in provider in "Authentication" -> "Sign-in method".
    *   **Important for Development (e.g., Firebase Studio):** Add your development domain (e.g., `your-studio-url.cloudworkstations.dev` or `localhost`) to the list of "Authorized domains" under the "Sign-in method" tab. If you encounter an `auth/unauthorized-domain` error, this is the most likely cause.
*   **Stripe Webhooks:**
    *   Configure a webhook endpoint in your Stripe Dashboard to point to `YOUR_DEPLOYED_APP_URL/api/webhooks/stripe` (or a local URL using `ngrok` for testing).
    *   Listen for the `checkout.session.completed` event.
    *   Store the webhook signing secret in the `STRIPE_WEBHOOK_SECRET` environment variable.

---

## 🏁 **End of Current Documentation**

All future changes should be appended below as updates or clarifications.

---

## 20. **Form Error Styling & Validation**

*Added: 2025-05-10*

The booking form system has been enhanced with custom validation styling to provide a more consistent and visually appealing experience:

### Form Component Updates
- The FormMessage component in `src/components/ui/form.tsx` has been redesigned with a more subtle and branded error display.
- A custom circular icon with exclamation mark provides clear visual indication of errors.
- Color and spacing have been refined to match the overall design system.

### Guest Information Form Validation
- The `GuestInfoForm` component in `src/components/booking/guest-info-form.tsx` now uses custom client-side validation.
- A new `FormInput` component that:
  - Shows required fields with an asterisk.
  - Displays validation errors with a consistent style.
  - Changes border and label colors on error states.
  - Validates on blur for immediate feedback.

### CSS Improvements
- Added custom styling in `src/app/globals.css` to override browser default validation bubbles.
- Implemented consistent styling for different error states (server validation, client validation, form submission errors).

### Error Pattern Usage
The updated validation pattern creates a consistent experience across:
- Required field validation
- Email format validation
- Form submission errors
- Coupon application errors/success messages

This styling is used throughout the booking flow, including the main booking form, hold form, and contact form.

---

## 21. **Documentation References**

*Added: 2025-05-17*

For more detailed information on specific features and implementations, refer to these specialized documentation files:

### Architecture Documentation
- [`/docs/architecture/multipage-architecture.md`](multipage-architecture.md) - Multipage website structure and routing
- [`/docs/architecture/dynamic-theme-system.md`](dynamic-theme-system.md) - Theme system implementation details
- [`/docs/architecture/admin-server-components.md`](admin-server-components.md) - Server components architecture for admin

### Implementation Guides
- [`/docs/implementation/dynamic-pricing-implementation.md`](../implementation/dynamic-pricing-implementation.md) - Pricing system details
- [`/docs/implementation/pricing-system.md`](../implementation/pricing-system.md) - Complete pricing architecture
- [`/docs/implementation/theme-system-implementation.md`](../implementation/theme-system-implementation.md) - Theme system implementation
- [`/docs/implementation/booking-form-positioning.md`](../implementation/booking-form-positioning.md) - Form positioning system
- [`/docs/implementation/edge-runtime-compatibility.md`](../implementation/edge-runtime-compatibility.md) - Edge Runtime optimization
- [`/docs/implementation/admin-auth-system.md`](../implementation/admin-auth-system.md) - Admin authentication system

### User Guides
- [`/docs/guides/using-property-themes.md`](../guides/using-property-themes.md) - How to use themes
- [`/docs/guides/using-dynamic-pricing.md`](../guides/using-dynamic-pricing.md) - Pricing system usage
- [`/docs/guides/using-availability-preview.md`](../guides/using-availability-preview.md) - Availability preview feature
- [`/docs/guides/consecutively-blocked-dates.md`](../guides/consecutively-blocked-dates.md) - Handling blocked dates
- [`/docs/guides/debugging-form-positions.md`](../guides/debugging-form-positions.md) - Form position debugging
- [`/docs/guides/extending-admin-interface.md`](../guides/extending-admin-interface.md) - Adding admin features
- [`/docs/guides/claude-assistance.md`](../guides/claude-assistance.md) - AI assistance guidelines

✅ Documentation is continuously updated as features evolve
✅ Each feature has implementation documentation and user guides
✅ Cross-references help navigate the documentation system
