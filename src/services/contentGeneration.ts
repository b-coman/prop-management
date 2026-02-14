// src/services/contentGeneration.ts
// Content Generation Engine — assembles prompts from briefs + data, calls Gemini.
// NOT a 'use server' module — imported by server actions.

import { GoogleGenAI } from '@google/genai';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import {
  CONTENT_COLLECTIONS,
  type ContentBrief,
  type ContentTopic,
  type GenerationDataSources,
} from '@/lib/content-schemas';
import { blockSchemas } from '@/lib/overridesSchemas-multipage';
import { fetchAllDataSources } from '@/services/contentDataSources';

const log = loggers.contentGeneration;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIMARY_MODEL = 'gemini-3-pro-preview';
const FALLBACK_MODEL = 'gemini-2.5-pro';
const TEMPERATURE = 0.7;
const MAX_OUTPUT_TOKENS = 16384;
const MAX_ATTEMPTS_PER_MODEL = 2;

const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  [PRIMARY_MODEL]: { inputPer1M: 1.25, outputPer1M: 10.0 },
  [FALLBACK_MODEL]: { inputPer1M: 1.25, outputPer1M: 10.0 },
};

// ---------------------------------------------------------------------------
// SDK Init (lazy singleton — adapted from eventHub pattern)
// ---------------------------------------------------------------------------

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// ---------------------------------------------------------------------------
// Cost Estimation
// ---------------------------------------------------------------------------

function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[PRIMARY_MODEL];
  return (
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M
  );
}

// ---------------------------------------------------------------------------
// JSON Cleaning
// ---------------------------------------------------------------------------

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

// ---------------------------------------------------------------------------
// Block Structure Description (for prompts)
// ---------------------------------------------------------------------------

function describeBlockStructure(blockKey: string): string {
  const schema = blockSchemas[blockKey];
  if (!schema) {
    return `Unknown block type "${blockKey}". Return a JSON object with bilingual {en, ro} text fields.`;
  }

  // Describe known block types in human-readable format for the LLM
  const descriptions: Record<string, string> = {
    hero: '{ title: {en, ro}, subtitle: {en, ro}, price?: number, showRating?: boolean }',
    experience: '{ title: {en, ro}, description: {en, ro}, highlights: [{ icon: string, title: {en, ro}, description: {en, ro} }] }',
    host: '{ title?: {en, ro}, name: {en, ro}, description: {en, ro}, backstory?: {en, ro} }',
    features: '[{ icon?: string, title: {en, ro}, description: {en, ro} }]',
    location: '{ title: {en, ro}, ctaText?: {en, ro}, ctaUrl?: string }',
    attractions: '[{ name: {en, ro}, distance?: string, description: {en, ro} }]',
    testimonials: '{ title: {en, ro}, reviews?: [{ name: string, rating: number, text: {en, ro} }] }',
    gallery: '{ title?: {en, ro} }',
    cta: '{ title: {en, ro}, description: {en, ro}, buttonText: {en, ro}, buttonUrl?: string }',
    text: '{ title: {en, ro}, description: {en, ro} }',
    faq: '[{ question: {en, ro}, answer: {en, ro} }]',
    pageHeader: '{ title: {en, ro}, subtitle: {en, ro}, backgroundImage: string }',
    amenitiesList: '{ title: {en, ro}, categories: [{ name: {en, ro}, amenities: [{ icon: string, name: {en, ro} }] }] }',
    roomsList: '{ title: {en, ro}, rooms: [{ name: {en, ro}, description: {en, ro}, features: [{en, ro}] }] }',
    specificationsList: '{ title: {en, ro}, specifications: [{ name: {en, ro}, value: {en, ro} }] }',
    pricingTable: '{ title: {en, ro}, description?: {en, ro}, seasons: [{ name: {en, ro}, period: {en, ro}, rate: {en, ro}, minimumStay: {en, ro} }] }',
    attractionsList: '{ title: {en, ro}, description?: {en, ro}, attractions: [{ name: {en, ro}, description: {en, ro}, distance: {en, ro} }] }',
    transportOptions: '{ title: {en, ro}, description?: {en, ro}, options: [{ icon: string, name: {en, ro}, description: {en, ro} }] }',
    distancesList: '{ title: {en, ro}, distances: [{ place: {en, ro}, distance: {en, ro}, time: {en, ro} }] }',
    policiesList: '{ title?: {en, ro}, policies: [{ title: {en, ro}, description: {en, ro} }] }',
    legalContent: '{ title?: {en, ro}, sections: [{ title: {en, ro}, body: {en, ro} }] }',
    areaGuideContent: '{ title?: {en, ro}, description?: {en, ro}, sections: [{ heading: {en, ro}, description: {en, ro}, icon?: string, highlights?: [{ label: {en, ro}, value: {en, ro} }] }] }',
    video: '{ title?: {en, ro}, videoUrl: string, description?: {en, ro} }',
    reviewsList: '{ title?: {en, ro} }',
  };

  return descriptions[blockKey] || `Match the "${blockKey}" block schema. All text fields must be bilingual {en, ro} objects.`;
}

// ---------------------------------------------------------------------------
// Multilingual String Helper
// ---------------------------------------------------------------------------

function mlStr(val: { en?: string; ro?: string } | string | undefined): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val.en || val.ro || '';
}

// ---------------------------------------------------------------------------
// Prompt Assembly
// ---------------------------------------------------------------------------

function buildSystemPrompt(brief: ContentBrief, propertyName: string): string {
  const parts: string[] = [];

  parts.push(`You are a bilingual (English and Romanian) content writer for "${propertyName}", a vacation rental property.`);
  parts.push('');

  // Layer 1: Owner Voice
  parts.push('## Owner Voice');
  parts.push(`Communication style: ${brief.ownerVoice.communicationStyle}`);
  parts.push(`Tone: ${brief.ownerVoice.toneDescriptors.join(', ')}`);
  if (brief.ownerVoice.samplePhrases.length > 0) {
    parts.push('Sample phrases to emulate:');
    for (const phrase of brief.ownerVoice.samplePhrases.slice(0, 5)) {
      parts.push(`  - EN: "${mlStr(phrase)}" / RO: "${typeof phrase === 'object' ? phrase.ro || '' : ''}"`);
    }
  }
  if (brief.ownerVoice.avoidTopics.length > 0) {
    parts.push(`Topics to avoid: ${brief.ownerVoice.avoidTopics.join(', ')}`);
  }
  parts.push('');

  // Layer 2: Property Story
  parts.push('## Property Story');
  parts.push(`History: ${mlStr(brief.propertyStory.history)}`);
  if (brief.propertyStory.uniqueFeatures.length > 0) {
    parts.push('Unique features:');
    for (const feat of brief.propertyStory.uniqueFeatures) {
      parts.push(`  - ${mlStr(feat)}`);
    }
  }
  parts.push(`Design philosophy: ${mlStr(brief.propertyStory.designPhilosophy)}`);
  parts.push(`Guest experience: ${mlStr(brief.propertyStory.guestExperience)}`);
  parts.push('');

  // Layer 3: Area Context
  parts.push('## Area Context');
  parts.push(`Location story: ${mlStr(brief.areaContext.locationStory)}`);
  parts.push(`Cultural context: ${mlStr(brief.areaContext.culturalContext)}`);
  if (brief.areaContext.hiddenGems.length > 0) {
    parts.push('Hidden gems:');
    for (const gem of brief.areaContext.hiddenGems) {
      parts.push(`  - ${mlStr(gem)}`);
    }
  }
  if (brief.areaContext.neighborhoods.length > 0) {
    parts.push('Nearby neighborhoods:');
    for (const n of brief.areaContext.neighborhoods) {
      parts.push(`  - ${mlStr(n.name)} (${n.distanceKm}km): ${mlStr(n.description)}`);
    }
  }
  parts.push(`Transport notes: ${mlStr(brief.areaContext.transportNotes)}`);
  parts.push('');

  // Production specs
  parts.push('## Production Guidelines');
  parts.push(`Target audience: ${brief.productionSpecs.targetAudience}`);
  parts.push(`Language priority: ${brief.productionSpecs.languagePriority}`);
  parts.push('');

  parts.push('## Critical Instructions');
  parts.push('- Both EN and RO must feel original and native-sounding, NOT translations of each other.');
  parts.push('- The Romanian version should use natural Romanian expressions, not literal translations from English.');
  parts.push('- All text fields must be bilingual objects: {"en": "...", "ro": "..."}');
  parts.push('- Return valid JSON only, no markdown or extra text.');

  return parts.join('\n');
}

function formatDataSourceSection(name: string, data: Record<string, unknown> | null): string {
  if (!data) return '';

  switch (name) {
    case 'googlePlaces': {
      const places = (data.places as Array<Record<string, unknown>>) || [];
      if (places.length === 0) return '';
      const lines = places.slice(0, 15).map((p) => {
        const dn = p.displayName as Record<string, string> | undefined;
        const addr = p.formattedAddress as Record<string, string> | undefined;
        return `- ${dn?.en || 'Unknown'} (${p.primaryType || 'place'}, rating: ${p.rating || 'N/A'}) — ${addr?.en || ''}`;
      });
      return `[NEARBY PLACES]\n${lines.join('\n')}`;
    }

    case 'weather': {
      const days = (data.days as Array<Record<string, unknown>>) || [];
      if (days.length === 0) return '';
      // Group by month and provide averages
      const monthlyData: Record<string, { temps: number[]; rains: number[]; conditions: string[] }> = {};
      for (const day of days) {
        const date = day.datetime as string;
        if (!date) continue;
        const month = date.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) monthlyData[month] = { temps: [], rains: [], conditions: [] };
        if (typeof day.temp === 'number') monthlyData[month].temps.push(day.temp);
        if (typeof day.precip === 'number') monthlyData[month].rains.push(day.precip);
        if (day.conditions) monthlyData[month].conditions.push(day.conditions as string);
      }
      const lines = Object.entries(monthlyData).map(([month, d]) => {
        const avgTemp = d.temps.length > 0 ? (d.temps.reduce((a, b) => a + b, 0) / d.temps.length).toFixed(1) : 'N/A';
        const avgRain = d.rains.length > 0 ? (d.rains.reduce((a, b) => a + b, 0) / d.rains.length).toFixed(1) : 'N/A';
        const topCondition = d.conditions.length > 0
          ? d.conditions.sort((a, b) => d.conditions.filter(c => c === b).length - d.conditions.filter(c => c === a).length)[0]
          : 'N/A';
        return `- ${month}: avg ${avgTemp}°C, avg precip ${avgRain}mm, typical: ${topCondition}`;
      });
      return `[WEATHER DATA]\n${lines.join('\n')}`;
    }

    case 'events8pm': {
      const events = (data.events as Array<Record<string, unknown>>) || [];
      if (events.length === 0) return '';
      const lines = events.slice(0, 15).map((e) =>
        `- ${e.name || 'Event'} (${e.category || 'general'}) — ${e.date || ''}, ${e.venue || ''}`
      );
      return `[LOCAL EVENTS]\n${lines.join('\n')}`;
    }

    case 'venues8pm': {
      const venues = (data.venues as Array<Record<string, unknown>>) || [];
      if (venues.length === 0) return '';
      const lines = venues.slice(0, 15).map((v) =>
        `- ${v.name || 'Venue'} (${v.type || v.category || 'venue'}, rating: ${v.rating || 'N/A'})`
      );
      return `[NEARBY VENUES]\n${lines.join('\n')}`;
    }

    case 'trainSchedule': {
      const routes = data.routes as Record<string, unknown> | undefined;
      if (!routes) return '';
      const lines: string[] = [];
      for (const [origin, routeData] of Object.entries(routes)) {
        const rd = routeData as Record<string, unknown>;
        const routeList = (rd.routes as Array<Record<string, unknown>>) || [];
        if (routeList.length === 0) {
          lines.push(`- From ${origin}: no direct routes found`);
        } else {
          const summaries = routeList.slice(0, 3).map((r) =>
            `${r.departure || '?'}-${r.arrival || '?'} (${r.duration || '?'})`
          );
          lines.push(`- From ${origin}: ${summaries.join(', ')}`);
        }
      }
      return `[TRANSPORT - TRAIN]\n${lines.join('\n')}`;
    }

    case 'perplexity': {
      const rawText = data.rawText as string | undefined;
      const citations = (data.citations as string[]) || [];
      const content = rawText || JSON.stringify(data, null, 2).slice(0, 2000);
      const citationLines = citations.length > 0
        ? '\nSources: ' + citations.slice(0, 5).join(', ')
        : '';
      return `[WEB RESEARCH]\n${content.slice(0, 3000)}${citationLines}`;
    }

    default:
      return '';
  }
}

function buildUserPrompt(
  topic: ContentTopic,
  dataSources: Record<string, Record<string, unknown> | null>,
  brief: ContentBrief
): string {
  const parts: string[] = [];

  // Topic info
  parts.push(`## Content Task`);
  parts.push(`Topic: ${mlStr(topic.title)}`);
  parts.push(`Category: ${topic.category}`);
  if (topic.targetMonth) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    parts.push(`Target month: ${monthNames[topic.targetMonth - 1]}`);
  }
  parts.push(`Target page: ${topic.targetPage}`);
  parts.push(`Target block: ${topic.targetBlock}`);
  parts.push('');

  // Focus areas and required sections
  if (topic.focusAreas.length > 0) {
    parts.push(`Focus areas: ${topic.focusAreas.join(', ')}`);
  }
  if (topic.requiredSections.length > 0) {
    parts.push(`Required sections: ${topic.requiredSections.join(', ')}`);
  }
  parts.push('');

  // SEO keywords
  const seo = brief.productionSpecs.seoKeywords;
  if (seo.primary.length > 0 || seo.secondary.length > 0 || seo.localTerms.length > 0) {
    parts.push('## SEO Keywords (include naturally)');
    if (seo.primary.length > 0) parts.push(`Primary: ${seo.primary.join(', ')}`);
    if (seo.secondary.length > 0) parts.push(`Secondary: ${seo.secondary.join(', ')}`);
    if (seo.localTerms.length > 0) parts.push(`Local terms: ${seo.localTerms.join(', ')}`);
    parts.push('');
  }

  // Content length guidance
  const contentLength = brief.productionSpecs.contentLength;
  parts.push('## Content Length Guidance');
  parts.push(`Short text fields: ~${contentLength.short} characters`);
  parts.push(`Medium text fields: ~${contentLength.medium} characters`);
  parts.push(`Long text fields (descriptions, body): ~${contentLength.long} characters`);
  parts.push('');

  // Research data sections
  const dataLines: string[] = [];
  for (const [name, data] of Object.entries(dataSources)) {
    if (!data) continue;
    const section = formatDataSourceSection(name, data);
    if (section) dataLines.push(section);
  }
  if (dataLines.length > 0) {
    parts.push('## Research Data');
    parts.push('Use this data to enrich your content with specific, factual details:');
    parts.push('');
    parts.push(dataLines.join('\n\n'));
    parts.push('');
  }

  // Output format
  parts.push('## Output Format');
  parts.push(`Return a JSON object matching this structure for the "${topic.targetBlock}" block:`);
  parts.push(describeBlockStructure(topic.targetBlock));
  parts.push('');
  parts.push('All text fields MUST be bilingual objects: {"en": "English text", "ro": "Romanian text"}');
  parts.push('Return ONLY the JSON object, no explanations or markdown.');

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Gemini Call + Retry/Fallback
// ---------------------------------------------------------------------------

interface GeminiResult {
  content: Record<string, unknown>;
  model: string;
  promptTokens: number;
  outputTokens: number;
}

async function callGemini(
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<GeminiResult> {
  const ai = getAIClient();

  const response = await ai.models.generateContent({
    model,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Empty response from Gemini');
  }

  const cleaned = cleanJsonResponse(text);
  const parsed = JSON.parse(cleaned);

  const promptTokens = response.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

  return {
    content: parsed,
    model,
    promptTokens,
    outputTokens,
  };
}

async function retryWithFallback(
  systemPrompt: string,
  userPrompt: string
): Promise<GeminiResult> {
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];

  for (const model of models) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        log.info('Calling Gemini', { model, attempt });
        const result = await callGemini(model, systemPrompt, userPrompt);
        log.info('Gemini call succeeded', {
          model,
          attempt,
          promptTokens: result.promptTokens,
          outputTokens: result.outputTokens,
        });
        return result;
      } catch (err) {
        log.warn('Gemini attempt failed', {
          model,
          attempt,
          error: String(err),
        });
        // Brief delay before retry (exponential: 2s, 4s)
        if (attempt < MAX_ATTEMPTS_PER_MODEL - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
        }
      }
    }
    // Moving to fallback model
    if (model === PRIMARY_MODEL) {
      log.warn('Primary model exhausted, falling back', { model: FALLBACK_MODEL });
    }
  }

  throw new Error('All generation attempts failed across all models');
}

// ---------------------------------------------------------------------------
// Data Source Summary (for generationMeta)
// ---------------------------------------------------------------------------

function buildDataSourcesSummary(
  dataSources: Record<string, Record<string, unknown> | null>,
  perplexityQuery?: string
): GenerationDataSources {
  const summary: GenerationDataSources = {};

  if (dataSources.perplexity) {
    summary.perplexity = {
      citations: ((dataSources.perplexity.citations as string[]) || []).slice(0, 10),
      query: perplexityQuery || '',
    };
  }

  if (dataSources.googlePlaces) {
    const places = (dataSources.googlePlaces.places as Array<Record<string, unknown>>) || [];
    const types = [...new Set(places.map((p) => p.primaryType as string).filter(Boolean))];
    summary.googlePlaces = {
      placeCount: places.length,
      types,
    };
  }

  if (dataSources.weather) {
    const days = (dataSources.weather.days as Array<Record<string, unknown>>) || [];
    const months = [...new Set(days.map((d) => (d.datetime as string)?.substring(0, 7)).filter(Boolean))];
    summary.weather = { months };
  }

  if (dataSources.events8pm) {
    const events = (dataSources.events8pm.events as Array<Record<string, unknown>>) || [];
    summary.events8pm = { eventCount: events.length };
  }

  if (dataSources.venues8pm) {
    const venues = (dataSources.venues8pm.venues as Array<Record<string, unknown>>) || [];
    const categories = [...new Set(venues.map((v) => (v.category || v.type) as string).filter(Boolean))];
    summary.venues8pm = {
      venueCount: venues.length,
      categories,
    };
  }

  if (dataSources.trainSchedule) {
    const routes = dataSources.trainSchedule.routes as Record<string, unknown> | undefined;
    if (routes) {
      const origins = Object.keys(routes);
      const routeCount = origins.reduce((sum, origin) => {
        const rd = routes[origin] as Record<string, unknown>;
        const routeList = (rd.routes as unknown[]) || [];
        return sum + routeList.length;
      }, 0);
      summary.trainSchedule = {
        routes: routeCount,
        origins,
      };
    }
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Main Entry: generateContent()
// ---------------------------------------------------------------------------

export interface GenerateContentInput {
  propertySlug: string;
  topicId: string;
}

export interface GenerateContentResult {
  draftId?: string;
  error?: string;
}

export async function generateContent(
  input: GenerateContentInput
): Promise<GenerateContentResult> {
  const { propertySlug, topicId } = input;
  const startTime = Date.now();

  log.info('Starting content generation', { propertySlug, topicId });

  try {
    const db = await getAdminDb();

    // 1. Load brief
    const briefDoc = await db.collection(CONTENT_COLLECTIONS.briefs).doc(propertySlug).get();
    if (!briefDoc.exists) {
      return { error: `Content brief not found for "${propertySlug}"` };
    }
    const brief = briefDoc.data() as ContentBrief;

    // 2. Load topic
    const topicDoc = await db
      .collection(CONTENT_COLLECTIONS.topics(propertySlug))
      .doc(topicId)
      .get();
    if (!topicDoc.exists) {
      return { error: `Topic "${topicId}" not found` };
    }
    const topic = topicDoc.data() as ContentTopic;

    // 3. Load property for name and coordinates
    const propertyDoc = await db.collection('properties').doc(propertySlug).get();
    if (!propertyDoc.exists) {
      return { error: `Property "${propertySlug}" not found` };
    }
    const property = propertyDoc.data() as Record<string, unknown>;
    const propertyName = (property.name as string) || propertySlug;
    const coordinates = (property.coordinates as { lat: number; lng: number }) || { lat: 0, lng: 0 };

    // 4. Merge data source overrides (topic-level overrides brief-level)
    const mergedDataSourceConfig = { ...brief.dataSources };
    if (topic.dataSourceOverrides) {
      for (const [key, override] of Object.entries(topic.dataSourceOverrides)) {
        if (override !== undefined) {
          (mergedDataSourceConfig as Record<string, unknown>)[key] = {
            ...(mergedDataSourceConfig as Record<string, unknown>)[key] as Record<string, unknown>,
            ...override,
          };
        }
      }
    }

    // 5. Build Perplexity query from topic
    const perplexityQuery = `${mlStr(topic.title)}. Focus on: ${topic.focusAreas.join(', ')}`;
    const perplexitySystemPrompt = `You are a research assistant. Provide factual, current information about ${mlStr(topic.title)} near ${propertyName}. Include specific names, dates, and details. Respond in JSON format with key findings.`;

    // 6. Fetch data sources
    log.info('Fetching data sources', { propertySlug });
    const dataSources = await fetchAllDataSources(
      propertySlug,
      mergedDataSourceConfig,
      coordinates,
      mergedDataSourceConfig.perplexityResearch?.enabled
        ? { query: perplexityQuery, systemPrompt: perplexitySystemPrompt }
        : undefined
    );

    // 7. Build prompts
    const systemPrompt = buildSystemPrompt(brief, propertyName);
    const userPrompt = buildUserPrompt(topic, dataSources, brief);

    log.info('Prompts built', {
      propertySlug,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
    });

    // 8. Call Gemini with retry/fallback
    const result = await retryWithFallback(systemPrompt, userPrompt);

    // 9. Basic validation — check it's a non-empty object
    if (!result.content || typeof result.content !== 'object') {
      return { error: 'Generated content is not a valid object' };
    }

    const durationMs = Date.now() - startTime;
    const costEstimate = estimateCost(result.model, result.promptTokens, result.outputTokens);

    // 10. Count existing drafts for version number
    const existingDrafts = await db
      .collection(CONTENT_COLLECTIONS.drafts(propertySlug))
      .where('topicId', '==', topicId)
      .count()
      .get();
    const version = (existingDrafts.data().count || 0) + 1;

    // 11. Save draft
    const draftData = {
      topicId,
      version,
      content: result.content,
      generationMeta: {
        model: result.model,
        promptTokens: result.promptTokens,
        outputTokens: result.outputTokens,
        costEstimate,
        generatedAt: new Date().toISOString(),
        durationMs,
        dataSources: buildDataSourcesSummary(dataSources, perplexityQuery),
      },
      status: 'pending-review',
      createdAt: FieldValue.serverTimestamp(),
    };

    const draftRef = await db
      .collection(CONTENT_COLLECTIONS.drafts(propertySlug))
      .add(draftData);

    // 12. Update topic status
    await db
      .collection(CONTENT_COLLECTIONS.topics(propertySlug))
      .doc(topicId)
      .update({
        status: 'review',
        lastGenerated: new Date().toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    log.info('Content generation complete', {
      propertySlug,
      topicId,
      draftId: draftRef.id,
      model: result.model,
      promptTokens: result.promptTokens,
      outputTokens: result.outputTokens,
      costEstimate: costEstimate.toFixed(4),
      durationMs,
      version,
    });

    return { draftId: draftRef.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error('Content generation failed', err instanceof Error ? err : undefined, {
      propertySlug,
      topicId,
      durationMs: Date.now() - startTime,
    });
    return { error: errorMessage };
  }
}
