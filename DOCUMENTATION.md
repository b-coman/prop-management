
# Short Rental Management System — Technical Architecture Documentation (Updated)

## 📌 Purpose

This documentation defines the current architecture, data model, frontend logic, admin panel behavior, and conventions for the **RentalSpot** short-term rental management system.

It serves as the baseline documentation for the system. Any future changes or architectural updates must be appended as new sections or updates here.

---

## 🏗️ 1. **System Overview**

The system manages short-term rental properties through:

- **Property metadata storage** in Firestore (`properties` collection).
- **Template definition** for website structure and default content (`websiteTemplates` collection).
- **Property-specific content overrides** and visibility settings (`propertyOverrides` collection).
- **Multi-step booking flow** with availability check, guest info collection, and Stripe payment processing.
- **Booking data storage** in Firestore (`bookings` collection).
- **Availability data storage** per property per month (`availability` collection).
- **Coupon management** system with Firestore storage (`coupons` collection) and admin interface.
- **Admin interface** for managing coupons (property management to be added).
- **Frontend & backend validation** using Zod schemas.
- **Google Analytics integration** per property.

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
│   ├── booking/         # Booking flow components (forms, calendar, etc.)
│   ├── homepage/        # Components for specific homepage sections (Hero, Experience, etc.)
│   ├── property/        # Components related to displaying property details
│   └── ui/              # Shadcn UI components (Button, Card, Input, etc.)
├── dataconnect/         # Firebase Data Connect configuration
├── dataconnect-generated/ # Generated Data Connect SDK
├── firestore/           # JSON files for seeding Firestore data
│   ├── properties/      # Property metadata JSON files (e.g., prahova-mountain-chalet.json)
│   └── propertyOverrides/ # Property content override JSON files
│   └── websiteTemplates/  # Website template definition JSON files
├── hooks/               # Custom React hooks (e.g., useSessionStorage, useToast)
├── lib/                 # Utility functions, libraries, configurations
│   ├── firebase.ts      # Firebase Client SDK initialization
│   ├── firebaseAdmin.ts # Firebase Admin SDK initialization (for server-side tasks) - Currently commented out
│   ├── overridesSchemas.ts # Zod schemas for template/override content validation
│   ├── price-utils.ts   # Pricing calculation logic
│   └── utils.ts         # General utility functions (e.g., cn for Tailwind)
├── node_modules/        # Project dependencies (managed by npm/yarn)
├── public/              # Static assets (images, fonts, favicon)
│   └── images/          # Default images for templates and placeholders
├── scripts/             # Utility scripts (e.g., load-properties.ts)
├── src/                 # Main application source code (using src directory convention)
│   ├── ai/              # Genkit AI related code (flows, prompts)
│   ├── app/             # Next.js App Router directory
│   │   ├── (app)/       # Main application routes and layouts
│   │   │   ├── admin/     # Admin panel routes and components
│   │   │   ├── api/       # API routes (e.g., webhooks)
│   │   │   ├── booking/   # Booking flow pages (check, success, cancel)
│   │   │   ├── properties/ # Dynamic property detail pages ([slug])
│   │   │   ├── globals.css # Global CSS styles and Tailwind base layers
│   │   │   ├── layout.tsx  # Root application layout
│   │   │   └── page.tsx    # Homepage component (renders default property)
│   │   └── actions/       # Server Actions (e.g., booking, checkout)
│   └── services/        # Backend services (booking, coupon, sync)
├── .gitignore           # Files and directories ignored by Git
├── components.json      # Shadcn UI configuration
├── DOCUMENTATION.md     # This file
├── firebase.json        # Firebase project configuration (Hosting, Emulators, Firestore rules path)
├── firestore.indexes.json # Firestore index definitions
├── firestore.rules      # Firestore security rules
├── next.config.ts       # Next.js configuration
├── package.json         # Project dependencies and scripts
├── README.md            # Project README
└── tsconfig.json        # TypeScript configuration
```

---

## 🗂️ 3. **Firestore Collections**

| Collection                   | Description                                                                 | Document ID Format        |
| :--------------------------- | :-------------------------------------------------------------------------- | :------------------------ |
| `/properties/{propertySlug}` | Core metadata & settings for each property                                  | Property Slug             |
| `/propertyOverrides/{propertySlug}` | Content overrides & section visibility per property                      | Property Slug             |
| `/websiteTemplates/{templateId}` | Defines template structure + default block content                        | Template ID (e.g., "holiday-house") |
| `/availability/{propertySlug}_{YYYY-MM}` | Availability status per property, per day, grouped by month             | `{propertySlug}_{YYYY-MM}` |
| `/bookings/{bookingId}`      | Booking records (pending, confirmed, cancelled)                           | Auto-generated ID         |
| `/coupons/{couponId}`        | Discount codes and their rules                                            | Auto-generated ID         |
| `/users/{userId}`            | User profiles (guests, owners, admins)                                     | Firebase Auth User ID     |
| `/reviews/{reviewId}`        | Guest reviews (schema defined, implementation pending)                    | Auto-generated ID         |
| `/syncCalendars/{documentId}`| Calendar sync info (schema defined, implementation pending)               | Auto-generated ID         |
| `/availabilityAlerts/{alertId}`| Requests for availability notifications (schema defined, backend pending) | Auto-generated ID         |

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
        { "icon": "firepit", "title": "Fire Pit", "description": "...", "image": "/images/templates/holiday-house/default-firepit.jpg" }
    ],
    "location": {
         "title": "Discover Nearby Attractions",
         "mapCenter": { "lat": 45.2530, "lng": 25.6346 } // Example default
    },
    "attractions": [ // Default attractions
         { "name": "Default Attraction", "description": "...", "image": "/images/templates/holiday-house/default-attraction.jpg" }
    ],
    "testimonials": { // Default testimonials wrapper
        "title": "What Guests Say",
        "showRating": true,
        "reviews": [ // Default reviews
             { "name": "Jane D.", "rating": 5, "text": "Wonderful stay!", "imageUrl": "/images/templates/holiday-house/default-guest.jpg" }
        ]
    },
     "gallery": { // Default gallery wrapper
         "title": "Property Gallery",
         "images": [ // Default gallery images (distinct from top-level overrides.images)
             { "url": "/images/templates/holiday-house/default-gallery-1.jpg", "alt": "Living Room" }
         ]
     },
    "cta": {
        "title": "Book Your Stay",
        "description": "...",
        "buttonText": "Book Now",
        "backgroundImage": "/images/templates/holiday-house/default-cta.jpg"
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
    "bookingForm": { "position": "center" }
  },
  "experience": {
     "title": "Experience Prahova's Majesty",
     "highlights": [ { "icon": "Mountain", "title": "Prahova Mountain Retreat", "description": "..." } ]
  },
  "host": {
      "name": "Bogdan C.",
      "imageUrl": "https://picsum.photos/seed/host-bogdan/200/200",
      "description": "Welcome to my chalet!",
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
          { "name": "Maria D.", "date": "2025-06", "rating": 5, "text": "Amazing!", "imageUrl": "https://picsum.photos/seed/guest-maria/100/100", "data-ai-hint": "happy female guest" }
      ]
  },
   "gallery": { "title": "Chalet Gallery" },
   "images": [ // Override array for gallery images
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
✅ **Arrays replace entirely:** If `overrides.features` exists, it replaces `template.defaults.features`. If `overrides.features` is absent, `template.defaults.features` is used.
✅ `visibleBlocks` array dictates which sections are rendered.

---

## 📝 6. **Schema Definitions (`src/lib/overridesSchemas.ts`)**

All block content (in `template.defaults` and `propertyOverrides`) must follow their corresponding schema defined centrally.

✅ Central schema definitions in: `src/lib/overridesSchemas.ts`
✅ Each schema is a Zod object (e.g., `heroSchema`, `experienceSchema`).
✅ A `blockSchemas` map is exported for dynamic validation.
✅ **Validation MUST always use these schemas** (frontend, admin, backend). No duplicate schemas or logic.

---

## 🚀 7. **Frontend Rendering Logic (Updated)**

For each block defined in `template.homepage`:

1. Check if `block.id` is present in `overrides.visibleBlocks` (or default to showing if `visibleBlocks` is missing). If not visible, skip rendering.
2. Fetch the block's content:
   - Try `overrides[blockId]` (e.g., `overrides.hero`, `overrides.features`).
   - If the override exists (even if it's an empty object/array for relevant types), use it.
   - If the override for `blockId` does *not* exist, fall back to `template.defaults[blockId]`.
3. Validate the **final chosen content** (either override or default) using the corresponding schema from `src/lib/overridesSchemas.ts`.
4. Render the block component with the validated content.
5. If content is invalid or missing after fallback → optionally skip rendering or show an error placeholder.

✅ No hardcoded defaults in frontend components.
✅ Rendering is driven by template structure, visibility flags, and merged content (override > default).

---

## ⚙️ 8. **Booking Flow (Multi-Step)**

1.  **Initial Form (`InitialBookingForm`):** User selects dates on the property page (Hero section or elsewhere). "Check Availability" button is clicked.
2.  **Navigation:** User is navigated to `/booking/check/{propertySlug}?checkIn=...&checkOut=...`.
3.  **Availability Check Page (`AvailabilityCheck` component):**
    *   Fetches availability data from `/availability/{propertySlug}_YYYY-MM` documents for the selected date range.
    *   Displays property summary, selected dates.
    *   Calculates and shows price breakdown (including potential extra guest fees).
    *   **If Available:** Shows "Dates Available!" message and the Guest Information form + "Continue to Payment" button.
    *   **If Unavailable:** Shows "Dates Unavailable" message, displays the 3-month availability calendar, suggests alternative dates (placeholder logic for now), and offers the "Notify Me" option.
4.  **Guest Information:** User fills in name, email, phone, guest count, and optional coupon code. Guest count changes dynamically update the price. Coupon validation happens via `couponService`. Session storage is used to persist form data across steps/refreshes.
5.  **Continue to Payment:**
    *   User clicks "Continue to Payment".
    *   Client-side validation ensures all required fields are filled.
    *   `createPendingBookingAction` is called:
        *   Creates a `bookings` document in Firestore with `status: 'pending'`.
        *   Stores guest info, dates, calculated pricing, property slug.
        *   Returns the `pendingBookingId`.
    *   `createCheckoutSession` action is called:
        *   Uses the `pendingBookingId` and other details in Stripe metadata.
        *   Redirects the user to Stripe Checkout.
6.  **Stripe Payment:** User completes payment on Stripe.
7.  **Webhook Confirmation (`/api/webhooks/stripe`):**
    *   Stripe sends `checkout.session.completed` event.
    *   Webhook verifies the event.
    *   Extracts `pendingBookingId` from metadata.
    *   Calls `updateBookingPaymentInfo` (`bookingService`):
        *   Updates the corresponding booking document status to `confirmed`.
        *   Adds payment details (`paymentInfo`).
        *   Calls `updatePropertyAvailability` to mark dates as unavailable in Firestore.
        *   (Future) Triggers external calendar sync.
    *   Returns `200 OK` to Stripe.
8.  **Redirect to Success/Cancel Page:** Stripe redirects the user to `/booking/success` or `/booking/cancel` based on payment outcome.

---

## 🏷️ 9. **Coupon System**

- Coupons stored in `/coupons/{couponId}` collection.
- Schema includes code, discount %, validity dates, activity status, optional booking timeframe, optional exclusion periods, optional property restriction.
- Admin pages (`/admin/coupons/new`, `/admin/coupons`) allow creation and management (view, toggle status, edit expiry/validity/exclusions).
- `couponService.ts` contains `validateAndApplyCoupon` function used in the booking flow to check validity based on dates, exclusions, etc., before applying the discount.

---

## 🖼️ 10. **Image Storage & Referencing**

✅ **Static Template Images:** Default images used in `template.defaults` (e.g., `/default-hero.jpg`) MUST be stored in `/public/images/templates/{templateId}/...` or a similar structure within `/public`. Reference using relative paths from the root (e.g., `/images/templates/holiday-house/default-hero.jpg`).
✅ **Property Override Images:** Images specific to a property (hero background override, feature images, attraction images, gallery images) are referenced by their **full URLs** (e.g., from Firebase Storage, Cloudinary, Picsum) directly within the `/propertyOverrides/{propertySlug}` document. Placeholder images from `picsum.photos` include a `data-ai-hint` attribute.
✅ **No Image ID References:** The system does *not* use a separate `/images` collection or reference images by ID. Image URLs are embedded directly where they are used in the overrides.
✅ `next/image` component should be used for optimized image loading. `data-ai-hint` attribute is used on placeholder images for future AI-driven image selection.

---

## 🔒 11. **Firestore Security Rules**

Rules are defined in `firestore.rules` and should be deployed to Firebase. Key rules:

*   `/properties`: Read: `true`, Write: `if isOwner(propertySlug) || isAdmin()`
*   `/websiteTemplates`: Read: `true`, Write: `if isAdmin()`
*   `/propertyOverrides`: Read: `true`, Write: `if isOwner(propertySlug) || isAdmin()`
*   `/availability`: Read: `true`, Write: `if true` (Client SDK handles writes based on user actions, rules might need refinement if direct user modification is needed).
*   `/bookings`: Create: `true`, Read/Update: `if isGuest() || isOwner() || isAdmin()`
*   `/coupons`: Read: `true`, Write: `if isAdmin()`
*   `/users`: Read/Write: `if isSelf() || isAdmin()`
*   (Others as defined)

---

## 💻 12. **Admin Panel Behavior (Coupons)**

✅ `/admin/coupons`: Lists all coupons, shows status, allows editing expiry, toggling status, expanding to edit booking validity and exclusion periods.
✅ `/admin/coupons/new`: Form to create new coupons with all fields (code, discount, expiry, validity, exclusions, description, etc.).
✅ Actions (`/admin/coupons/actions.ts`) handle Firestore writes for creating/updating coupons.

---

## ⚙️ 13. **Environment Variables**

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
| `TWILIO_ACCOUNT_SID`                     | Twilio Account SID (if using Twilio for SMS)                             | Server        | Optional | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN`                      | Twilio Auth Token (if using Twilio for SMS)                              | Server        | Optional | `your_auth_token`                 |
| `TWILIO_PHONE_NUMBER`                    | Twilio phone number used for sending SMS                                 | Server        | Optional | `+15551234567`                    |
| `FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH`    | Path to Firebase Admin SDK service account key file (for scripts/admin) | Server        | Optional | `./serviceAccountKey.json`        |
| `NEXT_PUBLIC_MAIN_APP_HOST`              | The main hostname for the application (e.g., rentalspot.com)             | Client/Server | Yes      | `rentalspot.com`                  |

✅ **Note:** `NEXT_PUBLIC_` prefix exposes the variable to the client-side browser bundle. Variables without the prefix are only available server-side.

---

## 📊 14. **Google Analytics Integration**

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

## 🌐 15. **Multi-Domain Configuration (Initial Setup)**

- Properties can be configured to use a custom domain.
- The `properties` collection documents include:
  ```json
  "customDomain": "your-property.com", // The custom domain
  "useCustomDomain": true // Boolean to enable/disable custom domain
  ```
- Next.js middleware (`src/middleware.ts`) handles domain resolution:
    - It checks if the incoming request's hostname matches a configured custom domain for any active property.
    - If a match is found, it rewrites the request to the standard `/properties/{slug}` path.
    - If no custom domain match, it proceeds with the default routing.
- An API route (`/api/resolve-domain`) is used by the middleware to query Firestore for properties matching a given domain.
- The main application host is defined by the `NEXT_PUBLIC_MAIN_APP_HOST` environment variable.

---

## 🏁 **End of Current Documentation**

All future changes should be appended below as updates or clarifications.
