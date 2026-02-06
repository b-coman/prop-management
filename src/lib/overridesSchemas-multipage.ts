// src/lib/overridesSchemas-multipage.ts
import { z } from 'zod';

// Reusable type: accepts both plain string and {en, ro, ...} multilingual objects
const multilingualString = z.union([z.string(), z.record(z.string(), z.string())]);

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
  backgroundImage: z.string(),
  title: multilingualString,
  subtitle: multilingualString.optional(),
  price: z.number().optional(),
  showRating: z.boolean().optional(),
  showBookingForm: z.boolean().optional(),
  bookingForm: z.object({
    position: z.enum(['top', 'bottom', 'center']),
    size: z.enum(['small', 'medium', 'large']),
  }).optional(),
  'data-ai-hint': z.string().optional(),
});

export const experienceSchema = z.object({
  title: multilingualString,
  description: multilingualString,
  highlights: z.array(
    z.object({
      icon: z.string(),
      title: multilingualString,
      description: multilingualString,
    })
  ),
});

export const hostSchema = z.object({
  name: multilingualString,
  imageUrl: z.string(),
  description: multilingualString,
  backstory: multilingualString,
  'data-ai-hint': z.string().optional(),
});

export const featureSchema = z.object({
  icon: z.string(),
  title: multilingualString,
  description: multilingualString,
  image: z.string(),
  'data-ai-hint': z.string().optional(),
});

export const locationSchema = z.object({
  title: multilingualString,
  mapCenter: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
});

export const attractionSchema = z.object({
  name: multilingualString,
  description: multilingualString,
  image: z.string(),
  'data-ai-hint': z.string().optional(),
});

export const reviewSchema = z.object({
  name: z.string(),
  date: z.string().optional(),
  rating: z.number().min(1).max(5),
  text: multilingualString,
  imageUrl: z.string().optional(),
  'data-ai-hint': z.string().optional(),
});

export const testimonialsSchema = z.object({
  title: multilingualString,
  showRating: z.boolean().optional(),
  reviews: z.array(reviewSchema),
});

export const galleryImageSchema = z.object({
  url: z.string(),
  alt: multilingualString,
  'data-ai-hint': z.string().optional(),
});

export const gallerySchema = z.object({
  title: multilingualString,
  images: z.array(galleryImageSchema),
});

export const ctaSchema = z.object({
  title: multilingualString,
  description: multilingualString,
  buttonText: multilingualString,
  buttonUrl: z.string(),
  backgroundImage: z.string(),
  'data-ai-hint': z.string().optional(),
});

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

// Map of block types to their schemas
export const blockSchemas: Record<string, z.ZodTypeAny> = {
  hero: heroSchema,
  experience: experienceSchema,
  host: hostSchema,
  features: z.array(featureSchema),
  location: locationSchema,
  attractions: z.array(attractionSchema),
  testimonials: testimonialsSchema,
  gallery: gallerySchema,
  cta: ctaSchema,
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

// Schema for a property override
export const propertyOverridesSchema = z.object({
  visiblePages: z.array(z.string()),
  menuItems: z.array(menuItemSchema).optional(),
}).catchall(z.any());

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