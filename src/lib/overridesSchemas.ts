import { z } from "zod";

// --- Hero block
export const heroSchema = z.object({
  backgroundImage: z.string().url().optional(), // Make optional, can fallback to property images
  price: z.number().optional(), // Already optional
  showRating: z.boolean().optional(),
  showBookingForm: z.boolean().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  bookingForm: z
      .object({
        position: z.enum(['center', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
        size: z.enum(['compressed', 'large']).optional()
      })
      .optional()
});

// --- Experience block
export const experienceSchema = z.object({
  title: z.string(),
  description: z.string(), // This maps to welcomeText in the component
  highlights: z.array(
    z.object({
      icon: z.string(),
      title: z.string(),
      description: z.string()
    })
  )
});

// --- Host block
export const hostSchema = z.object({
  title: z.string().optional(), // Title is often static like "Meet your host"
  name: z.string(),
  image: z.string().url().optional().nullable(), // Image is optional
  description: z.string(), // This maps to welcomeMessage in the component
  backstory: z.string().optional(), // Added optional backstory
  contact: z.object({ // Contact info is optional within the block
    phone: z.string().optional(),
    email: z.string().optional()
  }).optional(),
  ctaText: z.string().optional(),
  ctaUrl: z.string().optional()
});

// --- Features block
export const featuresSchema = z.array(
  z.object({
    icon: z.string().optional(), // Icon name is optional
    title: z.string(),
    description: z.string(),
    image: z.string().url().optional().nullable() // Image is optional
  })
);

// --- Location block
export const locationSchema = z.object({
  title: z.string(),
  mapCenter: z.object({ // Default map center
    lat: z.number(),
    lng: z.number()
  }).optional(), // Make optional as property location is main source
  // Attractions are now in a separate array in overrides/defaults
  ctaText: z.string().optional(),
  ctaUrl: z.string().optional()
});

// Separate schema for attractions array
export const attractionsSchema = z.array(
   z.object({
     name: z.string(),
     distance: z.string().optional(), // Distance is optional
     image: z.string().url().optional().nullable(), // Image is optional
     description: z.string()
   })
);

// --- Testimonials block
export const testimonialsSchema = z.object({
  title: z.string(),
  showRating: z.boolean().optional(), // Whether to show overall rating (not individual review rating)
  // featuredReviews are now in a separate array in overrides/defaults
  ctaText: z.string().optional(),
  ctaUrl: z.string().optional()
});

// Separate schema for reviews array
export const reviewsSchema = z.array(
   z.object({
     name: z.string(),
     date: z.string().optional(), // Date is optional
     rating: z.number().min(1).max(5),
     text: z.string(),
     imageUrl: z.string().url().optional().nullable() // Optional guest image
   })
);


// --- CTA block
export const ctaSchema = z.object({
  title: z.string(),
  description: z.string(),
  buttonText: z.string(),
  buttonUrl: z.string().optional(), // Make optional, component can default to #booking
  backgroundImage: z.string().url().optional().nullable() // Image is optional
});

// --- Text block (new)
export const textSchema = z.object({
  title: z.string(),
  description: z.string()
});

// --- Gallery block (new) - Defines the top-level gallery config
export const gallerySchema = z.object({
  title: z.string().optional() // Optional title for the gallery section
  // Images are now in a separate array in overrides/defaults
});

// Separate schema for images array
export const imagesSchema = z.array(
  z.object({
    url: z.string().url(),
    alt: z.string(),
    isFeatured: z.boolean().optional(), // Still useful for property's base images
    tags: z.array(z.string()).optional(),
    sortOrder: z.number().optional()
  })
);

// --- FAQ block (new)
export const faqSchema = z.array(
  z.object({
    question: z.string(),
    answer: z.string()
  })
);

// --- Export map of all schemas used for **block definitions**
// Note: Arrays like features, attractions, reviews, images are now handled
// directly from the top-level overrides/defaults, not nested within block schemas here.
export const blockSchemas: Record<string, z.ZodTypeAny> = {
  hero: heroSchema,
  experience: experienceSchema,
  host: hostSchema,
  // features: featuresSchema, // No longer needed here, it's an array at the top level
  location: locationSchema,
  // attractions: attractionsSchema, // No longer needed here
  testimonials: testimonialsSchema,
  // reviews: reviewsSchema, // No longer needed here
  cta: ctaSchema,
  text: textSchema,
  gallery: gallerySchema,
  // images: imagesSchema, // No longer needed here
  faq: faqSchema
};

// You might also want a schema for the entire PropertyOverrides structure for validation
export const propertyOverridesSchema = z.object({
    visibleBlocks: z.array(z.string()).optional(),
    hero: heroSchema.optional(),
    experience: experienceSchema.optional(),
    host: hostSchema.optional(),
    features: featuresSchema.optional(), // Use array schema
    location: locationSchema.optional(),
    attractions: attractionsSchema.optional(), // Use array schema
    testimonials: testimonialsSchema.merge(z.object({ reviews: reviewsSchema.optional() })).optional(), // Merge reviews into testimonials object
    gallery: gallerySchema.optional(),
    images: imagesSchema.optional(), // Use array schema
    cta: ctaSchema.optional(),
    faq: faqSchema.optional(),
    text: textSchema.optional(), // If you have a generic text block override
    // Add other top-level overrides if necessary
    updatedAt: z.any().optional(), // Allow Firestore Timestamp or serialized format
}).passthrough(); // Allow other fields potentially stored

export type PropertyOverridesData = z.infer<typeof propertyOverridesSchema>;

