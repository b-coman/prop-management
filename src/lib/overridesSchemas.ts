import { z } from "zod";

// Reusable type: accepts both plain string and {en, ro, ...} multilingual objects
const multilingualString = z.union([z.string(), z.record(z.string(), z.string())]);

// --- Hero block
export const heroSchema = z.object({
  backgroundImage: z.string().optional().nullable(), // Removed .url() validation
  price: z.number().optional(),
  showRating: z.boolean().optional(),
  showBookingForm: z.boolean().optional(),
  title: multilingualString.optional(),
  subtitle: multilingualString.optional(),
  bookingForm: z
      .object({
        position: z.enum(['center', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
        size: z.enum(['compressed', 'large']).optional()
      })
      .passthrough() // Allow extra fields if needed in future
      .optional(),
  'data-ai-hint': z.string().optional(),
}).passthrough(); // Allow extra fields

// --- Experience block
export const experienceHighlightSchema = z.object({
      icon: z.string(),
      title: multilingualString,
      description: multilingualString
}).passthrough(); // Allow extra fields

export const experienceSchema = z.object({
  title: multilingualString,
  description: multilingualString, // This maps to welcomeText in the component
  highlights: z.array(experienceHighlightSchema)
}).passthrough(); // Allow extra fields

// --- Host block
export const hostSchema = z.object({
  title: multilingualString.optional(),
  name: multilingualString,
  image: z.string().optional().nullable(), // Removed .url() validation
  'data-ai-hint': z.string().optional(),
  description: multilingualString, // This maps to welcomeMessage in the component
  backstory: multilingualString.optional(),
  contact: z.object({
    phone: z.string().optional(),
    email: z.string().optional()
  }).passthrough().optional(),
  ctaText: multilingualString.optional(),
  ctaUrl: z.string().optional()
}).passthrough(); // Allow extra fields

// --- Feature block item
export const featureItemSchema = z.object({
    icon: z.string().optional(),
    title: multilingualString,
    description: multilingualString,
    image: z.string().optional().nullable(), // Removed .url() validation
    'data-ai-hint': z.string().optional(),
}).passthrough(); // Allow extra fields

// --- Features block (array of items)
export const featuresSchema = z.array(featureItemSchema);

// --- Location block
export const locationSchema = z.object({
  title: multilingualString,
  mapCenter: z.object({
    lat: z.number(),
    lng: z.number()
  }).passthrough().optional(),
  ctaText: multilingualString.optional(),
  ctaUrl: z.string().optional()
}).passthrough(); // Allow extra fields

// --- Attraction block item
export const attractionItemSchema = z.object({
     name: multilingualString,
     distance: z.string().optional(),
     image: z.string().optional().nullable(), // Removed .url() validation
     'data-ai-hint': z.string().optional(),
     description: multilingualString
}).passthrough(); // Allow extra fields

// Separate schema for attractions array
export const attractionsSchema = z.array(attractionItemSchema);

// --- Review block item
export const reviewItemSchema = z.object({
     name: z.string(),
     date: z.string().optional(), // Date is optional
     rating: z.number().min(1).max(5),
     text: multilingualString,
     imageUrl: z.string().optional().nullable(), // Removed .url() validation
     'data-ai-hint': z.string().optional(),
}).passthrough(); // Allow extra fields

// --- Testimonials block structure (containing reviews)
export const testimonialsSchema = z.object({
  title: multilingualString,
  showRating: z.boolean().optional(), // Overall rating display toggle
  // Note: The actual overallRating value comes from the Property object
  reviews: z.array(reviewItemSchema).optional(), // The array of reviews is OPTIONAL here
  ctaText: multilingualString.optional(),
  ctaUrl: z.string().optional()
}).passthrough(); // Allow extra fields

// --- CTA block
export const ctaSchema = z.object({
  title: multilingualString,
  description: multilingualString,
  buttonText: multilingualString,
  buttonUrl: z.string().optional(),
  backgroundImage: z.string().optional().nullable(), // Removed .url() validation
  'data-ai-hint': z.string().optional(),
}).passthrough(); // Allow extra fields

// --- Text block (example)
export const textSchema = z.object({
  title: multilingualString,
  description: multilingualString
}).passthrough(); // Allow extra fields

// --- Gallery block config
export const gallerySchema = z.object({
  title: multilingualString.optional()
}).passthrough(); // Allow extra fields

// --- Image block item (for gallery)
export const imageItemSchema = z.object({
    url: z.string(), // Removed .url() validation
    alt: multilingualString,
    isFeatured: z.boolean().optional(), // May not be needed for overrides gallery
    tags: z.array(z.string()).optional(),
    sortOrder: z.number().optional(),
    'data-ai-hint': z.string().optional(),
}).passthrough(); // Allow extra fields

// Separate schema for images array (used in gallery)
export const imagesSchema = z.array(imageItemSchema);

// --- FAQ block item
export const faqItemSchema = z.object({
    question: multilingualString,
    answer: multilingualString
}).passthrough(); // Allow extra fields

// --- FAQ block (array of items)
export const faqSchema = z.array(faqItemSchema);


// --- Export map of all schemas used for **block definitions**
// This map helps validate default content in templates if needed.
export const blockSchemas: Record<string, z.ZodTypeAny> = {
  hero: heroSchema,
  experience: experienceSchema,
  host: hostSchema,
  features: featuresSchema, // Validates an array of features
  location: locationSchema,
  attractions: attractionsSchema, // Validates an array of attractions
  testimonials: testimonialsSchema, // Validates the container object
  reviews: z.array(reviewItemSchema), // Separate validation for review array if needed standalone
  cta: ctaSchema,
  text: textSchema,
  gallery: gallerySchema, // Validates the container object
  images: imagesSchema, // Validates an array of images
  faq: faqSchema // Validates an array of FAQs
};

// --- Schema for the entire PropertyOverrides structure ---
// This is used to validate the data fetched from /propertyOverrides/{slug}
export const propertyOverridesSchema = z.object({
    visibleBlocks: z.array(z.string()).optional(),
    hero: heroSchema.optional(),
    experience: experienceSchema.optional(),
    host: hostSchema.optional(),
    features: featuresSchema.optional(), // Expects an array based on featureItemSchema
    location: locationSchema.optional(),
    attractions: attractionsSchema.optional(), // Expects an array based on attractionItemSchema
    testimonials: testimonialsSchema.optional(), // Expects the testimonials structure (which might contain reviews)
    gallery: gallerySchema.optional(), // Expects the gallery config object
    images: imagesSchema.optional(), // Expects an array based on imageItemSchema (for the gallery)
    cta: ctaSchema.optional(),
    faq: faqSchema.optional(), // Expects an array based on faqItemSchema
    text: textSchema.optional(),
    // Add other top-level block overrides as needed
    // Allow Firestore Timestamps or other non-Zod types for metadata fields
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
}).passthrough(); // Allow other fields potentially stored, like internal metadata

export type PropertyOverridesData = z.infer<typeof propertyOverridesSchema>;