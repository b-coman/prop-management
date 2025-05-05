# Short Rental Management System — Technical Architecture Documentation

## 📌 Purpose

This documentation defines the current architecture, data model, frontend logic, admin panel behavior, and conventions for the **Short Rental Management System**.

It serves as the baseline documentation for the system. Any future changes or architectural updates must be appended as new sections or updates here.

---

## 🏗️ 1. **System Overview**

The system manages short-term rental properties through:

- **Property data storage** in Firestore
- **Templated property websites** rendered per property
- **Property-specific content overrides** per website
- **Admin interface** to manage properties, overrides, coupons, etc.
- **Frontend & backend validation using Zod schemas**

Initial support: 2 properties  
Future-ready for scaling to multiple properties and even SaaS offering.

---

## 🗂️ 2. **Firestore Collections**

| Collection                   | Description                                     |
|-----------------------------|------------------------------------------------|
| `/properties/{propertyId}`   | Metadata & settings for each property (document ID = slug) |
| `/propertyOverrides/{propertyId}` | Content overrides per property |
| `/websiteTemplates/{templateId}` | Defines template structure + default content |
| `/availability/{availabilityId}` | Availability per property & date |
| `/bookings/{bookingId}`      | Booking records |
| `/coupons/{couponId}`        | Discount codes |
| `/users/{userId}`            | User profiles |
| `/reviews/{reviewId}`        | Guest reviews |
| `/syncCalendars/{documentId}`| Calendar sync info |

✅ `propertyId` = **slug string** (e.g., `prahova-mountain-chalet`)

---

## 📝 3. **Template Structure (`/websiteTemplates/{templateId}`)**

Each template document contains:

```json
{
  "templateId": "holiday-house",
  "name": "Holiday House Template",
  "homepage": [
    { "id": "hero", "type": "hero" },
    { "id": "experience", "type": "experience" },
    { "id": "host", "type": "host" },
    { "id": "features", "type": "features" },
    { "id": "location", "type": "location" },
    { "id": "testimonials", "type": "testimonials" },
    { "id": "cta", "type": "cta" }
  ],
  "header": { ... },
  "footer": { ... },
  "defaults": { ... } // Default content for each block (see section 4)
}
```

✅ `homepage` defines **structure + order of blocks**  
✅ `defaults` provides **default content per block id**

---

## 📝 4. **Template Defaults**

✅ Stored inside `/websiteTemplates/{templateId}.defaults`

Provides fallback content for each block.  
Keyed by block ID.

Example:

```json
"defaults": {
  "hero": { ... },
  "features": [ ... ],
  "location": { ... },
  ...
}
```

Each default object follows its **block schema definition**.

✅ Ensures frontend can render a complete property site **even if no overrides are defined.**

---

## 📝 5. **Property Overrides**

✅ Stored inside `/propertyOverrides/{propertyId}`

Only stores **property-specific overrides** → content that differs from template defaults.

For each block:

```json
{
  "hero": { ... },   // optional override for hero
  "features": [ ... ], // optional override for features
  ...
}
```

Frontend merging priority:

```
block content = overrides[blockId] ?? template.defaults[blockId]
```

---

## 📝 6. **Schema Definitions**

All block content (in `defaults` and `overrides`) must follow their corresponding schema.

✅ All schemas are defined centrally in:

```
src/lib/overridesSchemas.ts
```

Each schema is a Zod object.

Example:

```ts
export const heroSchema = z.object({
  backgroundImage: z.string().url(),
  title: z.string().optional(),
  price: z.number().optional(),
  showRating: z.boolean().optional(),
  showBookingForm: z.boolean().optional(),
  subtitle: z.string().optional()
});
```

A `blockSchemas` map is exported for dynamic validation:

```ts
export const blockSchemas: Record<string, z.ZodTypeAny> = { ... };
```

✅ Validation must **always use these schemas** (no duplicates).

---

## 📝 7. **Frontend Rendering Logic**

For each block in `template.homepage`:

1. Load content from `/propertyOverrides/{propertyId}[blockId]`
2. If not present → fallback to `/websiteTemplates/{templateId}.defaults[blockId]`
3. Validate content using schema from `src/lib/overridesSchemas.ts`
4. Render block if valid

If content invalid or missing → optionally skip rendering.

✅ No default content inside `homepage` array → only structure.

✅ No hardcoded defaults in frontend code.

---

## 📝 8. **Admin Panel Behavior**

✅ When creating/editing a property:

* Prefill editing forms with content from `template.defaults[blockId]` if no override exists.
* Save user edits as overrides into `/propertyOverrides/{propertyId}`
* Allow resetting a block’s content back to template default
* Distinguish between overridden and default values in UI (optional)

---

## 📝 9. **Validation Rules**

✅ Validation logic must apply same schemas to:

* Frontend loaded data
* Admin panel input before saving
* API/backend data before writing to Firestore

No duplicate validation logic → always use `src/lib/overridesSchemas.ts`

---

## 📝 10. **Image Storage & Referencing**

✅ All static images (template defaults, shared assets) must be stored in:

```
/public/images/...
```

Use path references like:

```json
"backgroundImage": "/images/templates/holiday-house/default-hero.jpg"
```

✅ Works with direct `<img src="/...">` or Next.js `<Image src="/...">`

✅ Keeps static assets version-controlled, build-safe.

---

## 📝 11. **Firestore Security Rules**

✅ `/websiteTemplates/{templateId}` → `read: true`, `write: if isAdmin()`

✅ `/propertyOverrides/{propertyId}` → `read: true`, `write: if isOwner(propertyId) || isAdmin()`

✅ Other collections → rules already defined (see Firestore security rules source file)

---

## 📝 12. **Frontend Change Summary (defaults integration)**

The frontend system must:

✅ For each block → attempt to load override content → fallback to template default  
✅ Validate both override and default content using schema  
✅ Render content only if validated  
✅ No other changes in data flow, structure, or loading paths

---

## ✅ **System Principles**

* Templates define structure and fallback content
* Overrides define per-property customization
* Rendering merges overrides + defaults
* Validation uses centralized schema
* One `templateId` per property
* No duplicate schemas or validation logic
* Static assets live in `/public`

---

## 🔍 **Next steps / open items (for future updates)**

* Will admin UI allow editing template defaults?
* Should frontend indicate whether content is default vs overridden?
* Will multi-language support be required in templates and overrides?

---

## ✏️ **Update log**

* `2025-05-05`: Initial architecture documentation

(Add future updates below)

---

## 📂 **File References**

* `src/lib/overridesSchemas.ts` → schema definitions
* `/public/images/templates/{templateId}/...` → default images
* `/websiteTemplates/{templateId}` → template document
* `/propertyOverrides/{propertyId}` → property overrides
* `/properties/{propertyId}` → property metadata

---

## 📝 **Conventions**

✅ JSON content follows schema  
✅ URLs in JSON → relative from `/public` root  
✅ Document ID for properties → **slug** (matches URL & Firestore doc ID)

---

## 🏁 **End of baseline documentation**

All future changes should be appended below as updates or clarifications.
