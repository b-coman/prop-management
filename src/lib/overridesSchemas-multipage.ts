// src/lib/overridesSchemas-multipage.ts
import { z } from 'zod';

// Reusable type: accepts both plain string and {en, ro, ...} multilingual objects
export const multilingualString = z.union([z.string(), z.record(z.string(), z.string())]);
export type MultilingualStringValue = z.infer<typeof multilingualString>;

// Base schema for a block reference within a page
export const blockReferenceSchema = z.object({
  id: z.string(),
  type: z.string(),
});

// Schema for a page within a template
export const pageSchema = z.object({
  path: z.string(),
  title: multilingualString,
  blocks: z.array(blockReferenceSchema),
});

// Menu item schema
export const menuItemSchema = z.object({
  label: multilingualString,
  url: z.string(),
  isButton: z.boolean().optional(),
});

// Header schema
export const headerSchema = z.object({
  menuItems: z.array(menuItemSchema),
  logo: z.object({
    src: z.string(),
    alt: multilingualString,
  }),
});

// Footer schema
export const footerSchema = z.object({
  quickLinks: z.array(menuItemSchema),
  contactInfo: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }),
  socialLinks: z.array(
    z.object({
      platform: z.string(),
      url: z.string().url(),
    })
  ),
});

// Base schema for content blocks
// These are re-used from the existing schemas and extended as needed
export const heroSchema = z.object({
  backgroundImage: z.string().optional().nullable(),
  title: multilingualString.optional(),
  subtitle: multilingualString.optional(),
  price: z.number().optional(),
  showRating: z.boolean().optional(),
  showBookingForm: z.boolean().optional(),
  bookingForm: z.object({
    position: z.enum(['center', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
    size: z.enum(['compressed', 'small', 'medium', 'large']).optional(),
  }).passthrough().optional(),
  'data-ai-hint': z.string().optional(),
}).passthrough();

export const experienceHighlightSchema = z.object({
  icon: z.string(),
  title: multilingualString,
  description: multilingualString,
}).passthrough();

export const experienceSchema = z.object({
  title: multilingualString,
  description: multilingualString,
  highlights: z.array(experienceHighlightSchema),
}).passthrough();

export const hostSchema = z.object({
  title: multilingualString.optional(),
  name: multilingualString,
  image: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  description: multilingualString,
  backstory: multilingualString.optional(),
  contact: z.object({
    phone: z.string().optional(),
    email: z.string().optional(),
  }).passthrough().optional(),
  ctaText: multilingualString.optional(),
  ctaUrl: z.string().optional(),
  'data-ai-hint': z.string().optional(),
}).passthrough();

export const featureSchema = z.object({
  icon: z.string().optional(),
  title: multilingualString,
  description: multilingualString,
  image: z.string().optional().nullable(),
  'data-ai-hint': z.string().optional(),
}).passthrough();

export const locationSchema = z.object({
  title: multilingualString,
  mapCenter: z.object({
    lat: z.number(),
    lng: z.number(),
  }).passthrough().optional(),
  ctaText: multilingualString.optional(),
  ctaUrl: z.string().optional(),
}).passthrough();

export const attractionSchema = z.object({
  name: multilingualString,
  distance: z.string().optional(),
  description: multilingualString,
  image: z.string().optional().nullable(),
  'data-ai-hint': z.string().optional(),
}).passthrough();

export const reviewSchema = z.object({
  name: z.string(),
  date: z.string().optional(),
  rating: z.number().min(1).max(5),
  text: multilingualString,
  imageUrl: z.string().optional().nullable(),
  'data-ai-hint': z.string().optional(),
}).passthrough();

export const testimonialsSchema = z.object({
  title: multilingualString,
  showRating: z.boolean().optional(),
  reviews: z.array(reviewSchema).optional(),
  ctaText: multilingualString.optional(),
  ctaUrl: z.string().optional(),
}).passthrough();

export const galleryImageSchema = z.object({
  url: z.string(),
  alt: multilingualString,
  isFeatured: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
  'data-ai-hint': z.string().optional(),
}).passthrough();

export const gallerySchema = z.object({
  title: multilingualString.optional(),
  images: z.array(galleryImageSchema).optional(),
}).passthrough();

export const ctaSchema = z.object({
  title: multilingualString,
  description: multilingualString,
  buttonText: multilingualString,
  buttonUrl: z.string().optional(),
  backgroundImage: z.string().optional().nullable(),
  'data-ai-hint': z.string().optional(),
}).passthrough();

// New schemas for multi-page support
export const pageHeaderSchema = z.object({
  title: multilingualString,
  subtitle: multilingualString,
  backgroundImage: z.string(),
});

export const amenitiesListSchema = z.object({
  title: multilingualString,
  categories: z.array(
    z.object({
      name: multilingualString,
      amenities: z.array(
        z.object({
          icon: z.string(),
          name: multilingualString,
        })
      ),
    })
  ),
});

export const roomsListSchema = z.object({
  title: multilingualString,
  rooms: z.array(
    z.object({
      name: multilingualString,
      description: multilingualString,
      features: z.array(multilingualString),
      image: z.string(),
    })
  ),
});

export const specificationsListSchema = z.object({
  title: multilingualString,
  specifications: z.array(
    z.object({
      name: multilingualString,
      value: multilingualString,
    })
  ),
});

export const pricingTableSchema = z.object({
  title: multilingualString,
  description: multilingualString.optional(),
  seasons: z.array(
    z.object({
      name: multilingualString,
      period: multilingualString,
      rate: multilingualString,
      minimumStay: multilingualString,
    })
  ),
});

export const fullMapSchema = z.object({
  title: multilingualString,
  description: multilingualString.optional(),
  address: multilingualString,
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  zoom: z.number(),
  showDirections: z.boolean().optional(),
});

export const attractionsListSchema = z.object({
  title: multilingualString,
  description: multilingualString.optional(),
  attractions: z.array(
    z.object({
      name: multilingualString,
      description: multilingualString,
      distance: multilingualString,
      image: z.string(),
    })
  ),
});

export const transportOptionsSchema = z.object({
  title: multilingualString,
  description: multilingualString.optional(),
  options: z.array(
    z.object({
      icon: z.string(),
      name: multilingualString,
      description: multilingualString,
    })
  ),
});

export const distancesListSchema = z.object({
  title: multilingualString,
  distances: z.array(
    z.object({
      place: multilingualString,
      distance: multilingualString,
      time: multilingualString,
    })
  ),
});

export const galleryGridSchema = z.object({
  title: multilingualString,
  description: multilingualString.optional(),
  layout: z.enum(['grid', 'masonry', 'slider']),
  enableLightbox: z.boolean().optional(),
  images: z.array(galleryImageSchema).optional(),
});

export const photoCategoriesSchema = z.object({
  title: multilingualString,
  categories: z.array(
    z.object({
      name: multilingualString,
      description: multilingualString,
      thumbnail: z.string(),
      images: z.array(galleryImageSchema),
    })
  ),
});

export const fullBookingFormSchema = z.object({
  title: multilingualString,
  description: multilingualString.optional(),
  showCalendar: z.boolean().optional(),
  showSummary: z.boolean().optional(),
  enableCoupons: z.boolean().optional(),
});

export const policiesListSchema = z.object({
  title: multilingualString.optional(),
  policies: z.array(
    z.object({
      title: multilingualString,
      description: multilingualString,
    })
  ),
});

// --- Text block
export const textSchema = z.object({
  title: multilingualString,
  description: multilingualString,
}).passthrough();

// --- FAQ block
export const faqItemSchema = z.object({
  question: multilingualString,
  answer: multilingualString,
}).passthrough();

export const faqSchema = z.array(faqItemSchema);

// --- Standalone array schemas (for legacy flat overrides)
export const featuresSchema = z.array(featureSchema);
export const attractionsSchema = z.array(attractionSchema);
export const imagesSchema = z.array(galleryImageSchema);

export const areaGuideContentSchema = z.object({
  title: multilingualString.optional(),
  description: multilingualString.optional(),
  sections: z.array(
    z.object({
      heading: multilingualString,
      description: multilingualString,
      icon: z.string().optional(),
      image: z.string().optional(),
      highlights: z.array(
        z.object({
          label: multilingualString,
          value: multilingualString,
        })
      ).optional(),
    })
  ),
});

export const videoSectionSchema = z.object({
  title: multilingualString.optional(),
  videoUrl: z.string(),
  description: multilingualString.optional(),
}).passthrough();

// Map of block types to their schemas
export const blockSchemas: Record<string, z.ZodTypeAny> = {
  // Homepage blocks
  hero: heroSchema,
  experience: experienceSchema,
  host: hostSchema,
  features: featuresSchema,
  location: locationSchema,
  attractions: attractionsSchema,
  testimonials: testimonialsSchema,
  gallery: gallerySchema,
  cta: ctaSchema,
  // Standalone arrays
  reviews: z.array(reviewSchema),
  images: imagesSchema,
  text: textSchema,
  faq: faqSchema,
  // Multipage blocks
  pageHeader: pageHeaderSchema,
  amenitiesList: amenitiesListSchema,
  roomsList: roomsListSchema,
  specificationsList: specificationsListSchema,
  pricingTable: pricingTableSchema,
  fullMap: fullMapSchema,
  attractionsList: attractionsListSchema,
  transportOptions: transportOptionsSchema,
  distancesList: distancesListSchema,
  galleryGrid: galleryGridSchema,
  photoCategories: photoCategoriesSchema,
  fullBookingForm: fullBookingFormSchema,
  policiesList: policiesListSchema,
  video: videoSectionSchema,
  areaGuideContent: areaGuideContentSchema,
};

// Schema for the entire template
export const websiteTemplateSchema = z.object({
  templateId: z.string(),
  name: z.string(),
  pages: z.record(z.string(), pageSchema),
  header: headerSchema,
  footer: footerSchema,
  defaults: z.record(z.string(), z.any()),
});

// Schema for a property override (modern hierarchical format)
export const propertyOverridesSchema = z.object({
  visiblePages: z.array(z.string()),
  menuItems: z.array(menuItemSchema).optional(),
}).catchall(z.any());

// Legacy flat property overrides schema (used by override-transformers for migration)
export const legacyPropertyOverridesSchema = z.object({
  visibleBlocks: z.array(z.string()).optional(),
  hero: heroSchema.optional(),
  experience: experienceSchema.optional(),
  host: hostSchema.optional(),
  features: featuresSchema.optional(),
  location: locationSchema.optional(),
  attractions: attractionsSchema.optional(),
  testimonials: testimonialsSchema.optional(),
  gallery: gallerySchema.optional(),
  images: imagesSchema.optional(),
  cta: ctaSchema.optional(),
  faq: faqSchema.optional(),
  text: textSchema.optional(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
}).passthrough();

// TypeScript types derived from the Zod schemas
export type BlockReference = z.infer<typeof blockReferenceSchema>;
export type Page = z.infer<typeof pageSchema>;
export type MenuItem = z.infer<typeof menuItemSchema>;
export type Header = z.infer<typeof headerSchema>;
export type Footer = z.infer<typeof footerSchema>;
export type WebsiteTemplate = z.infer<typeof websiteTemplateSchema>;
export type PropertyOverrides = z.infer<typeof propertyOverridesSchema>;

// Types for specific blocks
export type HeroBlock = z.infer<typeof heroSchema>;
export type ExperienceBlock = z.infer<typeof experienceSchema>;
export type HostBlock = z.infer<typeof hostSchema>;
export type FeatureBlock = z.infer<typeof featureSchema>;
export type LocationBlock = z.infer<typeof locationSchema>;
export type AttractionBlock = z.infer<typeof attractionSchema>;
export type TestimonialsBlock = z.infer<typeof testimonialsSchema>;
export type GalleryBlock = z.infer<typeof gallerySchema>;
export type CtaBlock = z.infer<typeof ctaSchema>;

// Types for new multi-page block components
export type PageHeaderBlock = z.infer<typeof pageHeaderSchema>;
export type AmenitiesListBlock = z.infer<typeof amenitiesListSchema>;
export type RoomsListBlock = z.infer<typeof roomsListSchema>;
export type SpecificationsListBlock = z.infer<typeof specificationsListSchema>;
export type PricingTableBlock = z.infer<typeof pricingTableSchema>;
export type FullMapBlock = z.infer<typeof fullMapSchema>;
export type AttractionsListBlock = z.infer<typeof attractionsListSchema>;
export type TransportOptionsBlock = z.infer<typeof transportOptionsSchema>;
export type DistancesListBlock = z.infer<typeof distancesListSchema>;
export type GalleryGridBlock = z.infer<typeof galleryGridSchema>;
export type PhotoCategoriesBlock = z.infer<typeof photoCategoriesSchema>;
export type FullBookingFormBlock = z.infer<typeof fullBookingFormSchema>;
export type PoliciesListBlock = z.infer<typeof policiesListSchema>;

export type VideoSectionBlock = z.infer<typeof videoSectionSchema>;
export type AreaGuideContentBlock = z.infer<typeof areaGuideContentSchema>;

// Legacy type (used by override-transformers)
export type LegacyPropertyOverridesData = z.infer<typeof legacyPropertyOverridesSchema>;