// src/lib/content-schemas.ts
// Zod schemas and TypeScript types for the content generation pipeline.
// Collections: contentBriefs, contentTopics, contentDrafts, dataSourceCache

import { z } from 'zod';
import { multilingualString } from './overridesSchemas-multipage';

// ---------------------------------------------------------------------------
// Data Source Configuration (embedded in ContentBrief)
// ---------------------------------------------------------------------------

export const dataSourceConfigSchema = z.object({
  googlePlaces: z.object({
    enabled: z.boolean(),
    searchRadius: z.number().default(10000),
    includedTypes: z.array(z.string()),
    excludedTypes: z.array(z.string()),
  }),
  weather: z.object({
    enabled: z.boolean(),
    coordinates: z.object({ lat: z.number(), lng: z.number() }),
  }),
  events8pm: z.object({
    enabled: z.boolean(),
    city: z.string(),
    categories: z.array(z.string()),
    lookAheadDays: z.number().default(30),
  }),
  venues8pm: z.object({
    enabled: z.boolean(),
    city: z.string(),
    categories: z.array(z.string()),
    limit: z.number().default(20),
  }),
  perplexityResearch: z.object({
    enabled: z.boolean(),
    domainAllowlist: z.array(z.string()),
    domainBlocklist: z.array(z.string()),
    recencyFilter: z.enum(['week', 'month', 'none']),
  }),
  trainSchedule: z.object({
    enabled: z.boolean(),
    nearestStation: z.string(),
    originCities: z.array(z.string()),
  }),
});

export type DataSourceConfig = z.infer<typeof dataSourceConfigSchema>;

// ---------------------------------------------------------------------------
// Content Brief — contentBriefs/{propertySlug}
// ---------------------------------------------------------------------------

export const contentBriefSchema = z.object({
  // Layer 1: Owner Identity
  ownerVoice: z.object({
    description: multilingualString,
    toneDescriptors: z.array(z.string()),
    communicationStyle: z.string(),
    samplePhrases: z.array(multilingualString),
    avoidTopics: z.array(z.string()),
  }),

  // Layer 2: Property Identity
  propertyStory: z.object({
    history: multilingualString,
    uniqueFeatures: z.array(multilingualString),
    designPhilosophy: multilingualString,
    guestExperience: multilingualString,
  }),

  // Layer 3: Area Context
  areaContext: z.object({
    locationStory: multilingualString,
    culturalContext: multilingualString,
    hiddenGems: z.array(multilingualString),
    neighborhoods: z.array(z.object({
      name: multilingualString,
      description: multilingualString,
      distanceKm: z.number(),
    })),
    transportNotes: multilingualString,
  }),

  // Production specs
  productionSpecs: z.object({
    targetAudience: z.string(),
    seoKeywords: z.object({
      primary: z.array(z.string()),
      secondary: z.array(z.string()),
      localTerms: z.array(z.string()),
    }),
    contentLength: z.object({
      short: z.number().default(150),
      medium: z.number().default(400),
      long: z.number().default(800),
    }),
    languagePriority: z.enum(['en-first', 'ro-first', 'equal']),
  }),

  // Data source configuration
  dataSources: dataSourceConfigSchema,

  updatedAt: z.string().optional(),
  createdAt: z.string().optional(),
});

export type ContentBrief = z.infer<typeof contentBriefSchema>;

// ---------------------------------------------------------------------------
// Content Topic — contentTopics/{propertySlug}/topics/{topicId}
// ---------------------------------------------------------------------------

export const contentTopicSchema = z.object({
  id: z.string().optional(),
  title: multilingualString,
  slug: z.string(),
  category: z.enum(['seasonal', 'evergreen', 'event', 'guide']),
  targetMonth: z.number().min(1).max(12).optional(),
  targetPage: z.string(),
  targetBlock: z.string(),

  // Topic-specific prompt additions
  focusAreas: z.array(z.string()),
  requiredSections: z.array(z.string()),
  dataSourceOverrides: dataSourceConfigSchema.partial().optional(),

  // Scheduling
  generateAfter: z.string().optional(),
  regenerateInterval: z.number().optional(),
  lastGenerated: z.string().optional(),

  // Status
  status: z.enum(['draft', 'scheduled', 'generating', 'review', 'published', 'archived']),
  priority: z.enum(['high', 'medium', 'low']),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type ContentTopic = z.infer<typeof contentTopicSchema>;

// ---------------------------------------------------------------------------
// Content Draft — contentDrafts/{propertySlug}/drafts/{draftId}
// ---------------------------------------------------------------------------

export const generationDataSourcesSchema = z.object({
  perplexity: z.object({
    citations: z.array(z.string()),
    query: z.string(),
  }).optional(),
  googlePlaces: z.object({
    placeCount: z.number(),
    types: z.array(z.string()),
  }).optional(),
  weather: z.object({
    months: z.array(z.string()),
  }).optional(),
  events8pm: z.object({
    eventCount: z.number(),
  }).optional(),
  venues8pm: z.object({
    venueCount: z.number(),
    categories: z.array(z.string()),
  }).optional(),
  trainSchedule: z.object({
    routes: z.number(),
    origins: z.array(z.string()),
  }).optional(),
});

export type GenerationDataSources = z.infer<typeof generationDataSourcesSchema>;

export const contentDraftSchema = z.object({
  id: z.string().optional(),
  topicId: z.string(),
  version: z.number(),

  // Generated content (structured for direct block insertion)
  content: z.record(z.unknown()),

  // Generation metadata
  generationMeta: z.object({
    model: z.string(),
    promptTokens: z.number(),
    outputTokens: z.number(),
    costEstimate: z.number(),
    generatedAt: z.string(),
    durationMs: z.number(),
    dataSources: generationDataSourcesSchema,
  }),

  // Review workflow
  status: z.enum(['pending-review', 'approved', 'rejected', 'published']),
  reviewNotes: z.string().optional(),
  publishedAt: z.string().optional(),
  publishedBy: z.string().optional(),

  createdAt: z.string().optional(),
});

export type ContentDraft = z.infer<typeof contentDraftSchema>;

// ---------------------------------------------------------------------------
// Data Source Cache — dataSourceCache/{propertySlug}/cache/{sourceType}
// ---------------------------------------------------------------------------

export const dataSourceCacheSchema = z.object({
  sourceType: z.enum([
    'googlePlaces',
    'weather',
    'events8pm',
    'venues8pm',
    'perplexity',
    'trainSchedule',
  ]),
  data: z.record(z.unknown()),
  fetchedAt: z.string(),
  expiresAt: z.string(),
  parameters: z.record(z.unknown()),
});

export type DataSourceCache = z.infer<typeof dataSourceCacheSchema>;

// ---------------------------------------------------------------------------
// Firestore collection paths
// ---------------------------------------------------------------------------

export const CONTENT_COLLECTIONS = {
  briefs: 'contentBriefs',
  topics: (propertySlug: string) => `contentTopics/${propertySlug}/topics`,
  drafts: (propertySlug: string) => `contentDrafts/${propertySlug}/drafts`,
  cache: (propertySlug: string) => `dataSourceCache/${propertySlug}/cache`,
} as const;
