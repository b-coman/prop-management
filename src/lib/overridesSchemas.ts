// Legacy re-export wrapper — canonical source is overridesSchemas-multipage.ts
// All schema definitions live in the multipage file. This file preserves
// backward-compatible import paths for load-properties.ts and override-transformers.ts.

export {
  multilingualString,
  type MultilingualStringValue,
  heroSchema,
  experienceHighlightSchema,
  experienceSchema,
  hostSchema,
  featureSchema as featureItemSchema,
  featuresSchema,
  locationSchema,
  attractionSchema as attractionItemSchema,
  attractionsSchema,
  reviewSchema as reviewItemSchema,
  testimonialsSchema,
  ctaSchema,
  textSchema,
  gallerySchema,
  galleryImageSchema as imageItemSchema,
  imagesSchema,
  faqItemSchema,
  faqSchema,
  blockSchemas,
  legacyPropertyOverridesSchema as propertyOverridesSchema,
  type LegacyPropertyOverridesData as PropertyOverridesData,
} from './overridesSchemas-multipage';
