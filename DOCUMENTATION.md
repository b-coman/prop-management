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

Initial support: 2 properties (Prahova Mountain Chalet, Coltei Apartment Bucharest)
Designed for scalability.

---

## 🗂️ 2. **Firestore Collections**

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

## 📝 3. **Template Structure (`/websiteTemplates/{templateId}`)**

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
    "menuItems": [ ... ],
    "logo": { ... }
  },
  "footer": { // Default footer structure
     ...
  },
  "defaults": { // Default content for each block ID defined in "homepage"
    "hero": {
        "backgroundImage": "/default-hero.jpg",
        "title": "Welcome",
        "price": 150,
        "showRating": true,
        "showBookingForm": true,
        "bookingForm": { "position": "bottom", "size": "large" }
    },
    "experience": {
        "title": "Experience Relaxation",
        "description": "...",
        "highlights": [ ... ]
    },
    "features": [ // Default features if overrides not provided
        { "icon": "firepit", "title": "Fire Pit", "description": "...", "image": "/default-firepit.jpg" }
    ],
    "location": {
         "title": "Discover Nearby Attractions"
         // Default mapCenter could be here
    },
    "attractions": [ // Default attractions
         { "name": "Default Attraction", "description": "...", "image": "/default-attraction.jpg" }
    ],
    "testimonials": { // Default testimonials wrapper
        "title": "What Guests Say",
        "showRating": true,
        "reviews": [ // Default reviews
             { "name": "Jane D.", "rating": 5, "text": "Wonderful stay!", "imageUrl": "/default-guest.jpg" }
        ]
    },
     "gallery": { // Default gallery wrapper
         "title": "Property Gallery"
     },
     "images": [ // Default gallery images
         { "url": "/default-gallery-1.jpg", "alt": "Living Room" }
     ],
    "cta": {
        "title": "Book Your Stay",
        "description": "...",
        "buttonText": "Book Now",
        "backgroundImage": "/default-cta.jpg"
    }
    // ... defaults for other blocks
  }
}
```

✅ `homepage` defines **structure + order of blocks**.
✅ `defaults` provides **fallback content per block id**.

---

## 📝 4. **Property Overrides (`/propertyOverrides/{propertySlug}`)**

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
    "backgroundImage": "/hero-override.jpg", // Override the background image
    "data-ai-hint": "specific hint",
    "bookingForm": { // Can override specific parts of the booking form config
        "position": "center"
    }
    // Other hero fields use defaults if not specified here
  },
  "experience": { // Override object for the 'experience' block
     "title": "Experience Prahova's Majesty", // Override title
     "highlights": [ ... ] // Provide a completely new array of highlights
  },
  "host": { // Override object for the 'host' block
      "name": "Bogdan",
      "imageUrl": "/host-image.jpg",
      "description": "Hello, I'm Bogdan...", // Override description (welcome message)
      "backstory": "I built this place..." // Override backstory
  },
  "features": [ // Override array for the 'features' block
    { "icon": "firepit", "title": "Fire Pit", "description": "...", "image": "/firepit.jpg" },
    { "icon": "hammock", "title": "Hammocks", "description": "...", "image": "/hammock.jpg" }
    // If this array exists, it *replaces* the default features array entirely
  ],
  "location": { // Override object for the 'location' block
       "title": "Explore Comarnic & Beyond" // Override title
  },
  "attractions": [ // Override array for attractions
      { "name": "Dracula Castle", ... },
      { "name": "Ialomita Cave", ... }
      // Replaces the default attractions array
  ],
  "testimonials": { // Override object for testimonials
      "title": "Guest Experiences", // Override title
      "reviews": [ // Override array for reviews
          { "name": "Maria D.", ... },
          { "name": "James T.", ... }
          // Replaces the default reviews array
      ]
  },
   "gallery": { // Override gallery title
       "title": "Chalet Gallery"
   },
  "images": [ // Override array for gallery images
      { "url": "/chalet-img1.jpg", ... },
      { "url": "/chalet-img2.jpg", ... }
      // Replaces the default images array
  ],
  "cta": { // Override object for CTA
      "title": "Ready for Your Mountain Getaway?",
      "buttonText": "Book Your Stay Now"
  }
  // Add other block overrides as needed
}
```

✅ **Content is merged per block:** `finalContent = overrides[blockId] ?? template.defaults[blockId]`
✅ **Arrays replace entirely:** If `overrides.features` exists, it replaces `template.defaults.features`. If `overrides.features` is absent, `template.defaults.features` is used.
✅ `visibleBlocks` array dictates which sections are rendered.

---

## 📝 5. **Schema Definitions (`src/lib/overridesSchemas.ts`)**

All block content (in `template.defaults` and `propertyOverrides`) must follow their corresponding schema defined centrally.

✅ Central schema definitions in: `src/lib/overridesSchemas.ts`
✅ Each schema is a Zod object (e.g., `heroSchema`, `experienceSchema`).
✅ A `blockSchemas` map is exported for dynamic validation.
✅ **Validation MUST always use these schemas** (frontend, admin, backend). No duplicate schemas or logic.

---

## 🚀 6. **Frontend Rendering Logic (Updated)**

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

## ⚙️ 7. **Booking Flow (Multi-Step)**

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

## 🏷️ 8. **Coupon System**

- Coupons stored in `/coupons/{couponId}` collection.
- Schema includes code, discount %, validity dates, activity status, optional booking timeframe, optional exclusion periods, optional property restriction.
- Admin pages (`/admin/coupons/new`, `/admin/coupons`) allow creation and management (view, toggle status, edit expiry/validity/exclusions).
- `couponService.ts` contains `validateAndApplyCoupon` function used in the booking flow to check validity based on dates, exclusions, etc., before applying the discount.

---

## 🖼️ 9. **Image Storage & Referencing**

✅ **Static Template Images:** Default images used in `template.defaults` (e.g., `/default-hero.jpg`) MUST be stored in `/public/images/templates/{templateId}/...` or a similar structure within `/public`. Reference using relative paths from the root (e.g., `/images/templates/holiday-house/default-hero.jpg`).
✅ **Property Override Images:** Images specific to a property (hero background override, feature images, attraction images, gallery images) are referenced by their **full URLs** (e.g., from Firebase Storage, Cloudinary, Picsum) directly within the `/propertyOverrides/{slug}` document.
✅ **No Image ID References:** The system does *not* use a separate `/images` collection or reference images by ID. Image URLs are embedded directly where they are used in the overrides.
✅ `next/image` component should be used for optimized image loading. `data-ai-hint` attribute is used on placeholder images.

---

## 🔒 10. **Firestore Security Rules**

Rules are defined in `firestore.rules` and should be deployed to Firebase. Key rules:

*   `/properties`: Read: `true`, Write: `if isOwner() || isAdmin()`
*   `/websiteTemplates`: Read: `true`, Write: `if isAdmin()`
*   `/propertyOverrides`: Read: `true`, Write: `if isOwner(propertySlug) || isAdmin()`
*   `/availability`: Read: `true`, Write: `if true` (Client SDK handles writes based on user actions, rules might need refinement if direct user modification is needed).
*   `/bookings`: Create: `true`, Read/Update: `if isGuest() || isOwner() || isAdmin()`
*   `/coupons`: Read: `true`, Write: `if isAdmin()`
*   `/users`: Read/Write: `if isSelf() || isAdmin()`
*   (Others as defined)

---

## 💻 11. **Admin Panel Behavior (Coupons)**

✅ `/admin/coupons`: Lists all coupons, shows status, allows editing expiry, toggling status, expanding to edit booking validity and exclusion periods.
✅ `/admin/coupons/new`: Form to create new coupons with all fields (code, discount, expiry, validity, exclusions, description, etc.).
✅ Actions (`/admin/coupons/actions.ts`) handle Firestore writes for creating/updating coupons.

---

## 🏁 **End of Current Documentation**

All future changes should be appended below as updates or clarifications.
