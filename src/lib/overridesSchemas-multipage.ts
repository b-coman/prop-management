// src/lib/overridesSchemas-multipage.ts
import { z } from 'zod';

// Base schema for a block reference within a page
export const blockReferenceSchema = z.object({
  id: z.string(),
  type: z.string(),
});

// Schema for a page within a template
export const pageSchema = z.object({
  path: z.string(),
  title: z.string(),
  blocks: z.array(blockReferenceSchema),
});

// Menu item schema
export const menuItemSchema = z.object({
  label: z.string(),
  url: z.string(),
  isButton: z.boolean().optional(),
});

// Header schema
export const headerSchema = z.object({
  menuItems: z.array(menuItemSchema),
  logo: z.object({
    src: z.string(),
    alt: z.string(),
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
  title: z.string(),
  subtitle: z.string().optional(),
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
  title: z.string(),
  description: z.string(),
  highlights: z.array(
    z.object({
      icon: z.string(),
      title: z.string(),
      description: z.string(),
    })
  ),
});

export const hostSchema = z.object({
  name: z.string(),
  imageUrl: z.string(),
  description: z.string(),
  backstory: z.string(),
  'data-ai-hint': z.string().optional(),
});

export const featureSchema = z.object({
  icon: z.string(),
  title: z.string(),
  description: z.string(),
  image: z.string(),
  'data-ai-hint': z.string().optional(),
});

export const locationSchema = z.object({
  title: z.string(),
  mapCenter: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
});

export const attractionSchema = z.object({
  name: z.string(),
  description: z.string(),
  image: z.string(),
  'data-ai-hint': z.string().optional(),
});

export const reviewSchema = z.object({
  name: z.string(),
  date: z.string().optional(),
  rating: z.number().min(1).max(5),
  text: z.string(),
  imageUrl: z.string().optional(),
  'data-ai-hint': z.string().optional(),
});

export const testimonialsSchema = z.object({
  title: z.string(),
  showRating: z.boolean().optional(),
  reviews: z.array(reviewSchema),
});

export const galleryImageSchema = z.object({
  url: z.string(),
  alt: z.string(),
  'data-ai-hint': z.string().optional(),
});

export const gallerySchema = z.object({
  title: z.string(),
  images: z.array(galleryImageSchema),
});

export const ctaSchema = z.object({
  title: z.string(),
  description: z.string(),
  buttonText: z.string(),
  buttonUrl: z.string(),
  backgroundImage: z.string(),
  'data-ai-hint': z.string().optional(),
});

// New schemas for multi-page support
export const pageHeaderSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  backgroundImage: z.string(),
});

export const amenitiesListSchema = z.object({
  title: z.string(),
  categories: z.array(
    z.object({
      name: z.string(),
      amenities: z.array(
        z.object({
          icon: z.string(),
          name: z.string(),
        })
      ),
    })
  ),
});

export const roomsListSchema = z.object({
  title: z.string(),
  rooms: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      features: z.array(z.string()),
      image: z.string(),
    })
  ),
});

export const specificationsListSchema = z.object({
  title: z.string(),
  specifications: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
    })
  ),
});

export const pricingTableSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  seasons: z.array(
    z.object({
      name: z.string(),
      period: z.string(),
      rate: z.string(),
      minimumStay: z.string(),
    })
  ),
});

export const fullMapSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  address: z.string(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  zoom: z.number(),
  showDirections: z.boolean().optional(),
});

export const attractionsListSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  attractions: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      distance: z.string(),
      image: z.string(),
    })
  ),
});

export const transportOptionsSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  options: z.array(
    z.object({
      icon: z.string(),
      name: z.string(),
      description: z.string(),
    })
  ),
});

export const distancesListSchema = z.object({
  title: z.string(),
  distances: z.array(
    z.object({
      place: z.string(),
      distance: z.string(),
      time: z.string(),
    })
  ),
});

export const galleryGridSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  layout: z.enum(['grid', 'masonry', 'slider']),
  enableLightbox: z.boolean().optional(),
  images: z.array(galleryImageSchema).optional(),
});

export const photoCategoriesSchema = z.object({
  title: z.string(),
  categories: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      thumbnail: z.string(),
      images: z.array(galleryImageSchema),
    })
  ),
});

export const fullBookingFormSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  showCalendar: z.boolean().optional(),
  showSummary: z.boolean().optional(),
  enableCoupons: z.boolean().optional(),
});

export const policiesListSchema = z.object({
  title: z.string().optional(),
  policies: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
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