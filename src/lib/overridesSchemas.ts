import { z } from "zod";

// --- Hero block
export const heroSchema = z.object({
  backgroundImage: z.string().url(),
  price: z.number().optional(),
  showRating: z.boolean().optional(),
  showBookingForm: z.boolean().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional()
});

// --- Experience block
export const experienceSchema = z.object({
  title: z.string(),
  description: z.string(),
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
  title: z.string(),
  name: z.string(),
  image: z.string().url(),
  description: z.string(),
  contact: z.object({
    phone: z.string().optional(),
    email: z.string().optional()
  }),
  ctaText: z.string().optional(),
  ctaUrl: z.string().optional()
});

// --- Features block
export const featuresSchema = z.array(
  z.object({
    icon: z.string(),
    title: z.string(),
    description: z.string(),
    image: z.string().url()
  })
);

// --- Location block
export const locationSchema = z.object({
  title: z.string(),
  mapCenter: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  attractions: z.array(
    z.object({
      name: z.string(),
      distance: z.string(),
      image: z.string().url(),
      description: z.string()
    })
  ),
  ctaText: z.string().optional(),
  ctaUrl: z.string().optional()
});

// --- Testimonials block
export const testimonialsSchema = z.object({
  title: z.string(),
  showRating: z.boolean().optional(),
  featuredReviews: z.array(
    z.object({
      name: z.string(),
      date: z.string(),
      rating: z.number().min(1).max(5),
      text: z.string()
    })
  ),
  ctaText: z.string().optional(),
  ctaUrl: z.string().optional()
});

// --- CTA block
export const ctaSchema = z.object({
  title: z.string(),
  description: z.string(),
  buttonText: z.string(),
  buttonUrl: z.string(),
  backgroundImage: z.string().url()
});

// --- Text block (new)
export const textSchema = z.object({
  title: z.string(),
  description: z.string()
});

// --- Gallery block (new)
export const gallerySchema = z.object({
  title: z.string().optional(),
  images: z.array(
    z.object({
      url: z.string().url(),
      alt: z.string(),
      isFeatured: z.boolean().optional(),
      tags: z.array(z.string()).optional(),
      sortOrder: z.number().optional()
    })
  )
});

// --- FAQ block (new)
export const faqSchema = z.array(
  z.object({
    question: z.string(),
    answer: z.string()
  })
);

// --- Export map of all schemas
export const blockSchemas: Record<string, z.ZodTypeAny> = {
  hero: heroSchema,
  experience: experienceSchema,
  host: hostSchema,
  features: featuresSchema,
  location: locationSchema,
  testimonials: testimonialsSchema,
  cta: ctaSchema,
  text: textSchema,
  gallery: gallerySchema,
  faq: faqSchema
};
