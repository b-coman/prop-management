'use client';

import { useState, useCallback } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultilingualInput } from '@/app/admin/website/_components/multilingual-input';
import { SortableList } from '@/app/admin/website/_components/sortable-list';
import { TagInput } from './tag-input';
import { useToast } from '@/hooks/use-toast';
import { saveContentBrief } from '../actions';
import { Save, RotateCcw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentBrief } from '@/lib/content-schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ML = Record<string, string>;

interface OwnerVoice {
  toneDescriptors: string[];
  communicationStyle: string;
  description: ML;
  samplePhrases: ML[];
  avoidTopics: string[];
}

interface PropertyStory {
  history: ML;
  uniqueFeatures: ML[];
  designPhilosophy: ML;
  guestExperience: ML;
}

interface Neighborhood {
  name: ML;
  description: ML;
  distanceKm: number;
}

interface AreaContext {
  locationStory: ML;
  culturalContext: ML;
  hiddenGems: ML[];
  neighborhoods: Neighborhood[];
  transportNotes: ML;
}

interface ProductionSpecs {
  targetAudience: string;
  seoKeywords: { primary: string[]; secondary: string[]; localTerms: string[] };
  contentLength: { short: number; medium: number; long: number };
  languagePriority: 'en-first' | 'ro-first' | 'equal';
}

interface FormData {
  ownerVoice: OwnerVoice;
  propertyStory: PropertyStory;
  areaContext: AreaContext;
  productionSpecs: ProductionSpecs;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const emptyML = (): ML => ({ en: '', ro: '' });

/** Normalize a multilingualString (string | Record<string,string> | undefined) into ML */
function toML(val: string | Record<string, string> | undefined): ML {
  if (!val) return emptyML();
  if (typeof val === 'string') return { en: val, ro: '' };
  return { en: val.en || '', ro: val.ro || '' };
}

function toMLArray(arr: (string | Record<string, string>)[] | undefined): ML[] {
  return (arr ?? []).map(toML);
}

const DEFAULTS: FormData = {
  ownerVoice: {
    toneDescriptors: [],
    communicationStyle: 'professional-warm',
    description: emptyML(),
    samplePhrases: [],
    avoidTopics: [],
  },
  propertyStory: {
    history: emptyML(),
    uniqueFeatures: [],
    designPhilosophy: emptyML(),
    guestExperience: emptyML(),
  },
  areaContext: {
    locationStory: emptyML(),
    culturalContext: emptyML(),
    hiddenGems: [],
    neighborhoods: [],
    transportNotes: emptyML(),
  },
  productionSpecs: {
    targetAudience: 'mixed',
    seoKeywords: { primary: [], secondary: [], localTerms: [] },
    contentLength: { short: 150, medium: 400, long: 800 },
    languagePriority: 'en-first',
  },
};

function briefToForm(brief: ContentBrief | null): FormData {
  if (!brief) return DEFAULTS;
  return {
    ownerVoice: {
      toneDescriptors: brief.ownerVoice?.toneDescriptors ?? [],
      communicationStyle: brief.ownerVoice?.communicationStyle ?? 'professional-warm',
      description: toML(brief.ownerVoice?.description),
      samplePhrases: toMLArray(brief.ownerVoice?.samplePhrases),
      avoidTopics: brief.ownerVoice?.avoidTopics ?? [],
    },
    propertyStory: {
      history: toML(brief.propertyStory?.history),
      uniqueFeatures: toMLArray(brief.propertyStory?.uniqueFeatures),
      designPhilosophy: toML(brief.propertyStory?.designPhilosophy),
      guestExperience: toML(brief.propertyStory?.guestExperience),
    },
    areaContext: {
      locationStory: toML(brief.areaContext?.locationStory),
      culturalContext: toML(brief.areaContext?.culturalContext),
      hiddenGems: toMLArray(brief.areaContext?.hiddenGems),
      neighborhoods: (brief.areaContext?.neighborhoods ?? []).map((n) => ({
        name: toML(n.name),
        description: toML(n.description),
        distanceKm: n.distanceKm ?? 0,
      })),
      transportNotes: toML(brief.areaContext?.transportNotes),
    },
    productionSpecs: {
      targetAudience: brief.productionSpecs?.targetAudience ?? 'mixed',
      seoKeywords: {
        primary: brief.productionSpecs?.seoKeywords?.primary ?? [],
        secondary: brief.productionSpecs?.seoKeywords?.secondary ?? [],
        localTerms: brief.productionSpecs?.seoKeywords?.localTerms ?? [],
      },
      contentLength: {
        short: brief.productionSpecs?.contentLength?.short ?? 150,
        medium: brief.productionSpecs?.contentLength?.medium ?? 400,
        long: brief.productionSpecs?.contentLength?.long ?? 800,
      },
      languagePriority: brief.productionSpecs?.languagePriority ?? 'en-first',
    },
  };
}

// ---------------------------------------------------------------------------
// Communication style options
// ---------------------------------------------------------------------------

const COMMUNICATION_STYLES = [
  { value: 'informal-friendly', label: 'Informal & Friendly' },
  { value: 'professional-warm', label: 'Professional & Warm' },
  { value: 'storyteller', label: 'Storyteller' },
  { value: 'factual-concise', label: 'Factual & Concise' },
];

const TARGET_AUDIENCES = [
  { value: 'families', label: 'Families' },
  { value: 'couples', label: 'Couples' },
  { value: 'adventure-seekers', label: 'Adventure Seekers' },
  { value: 'business-travelers', label: 'Business Travelers' },
  { value: 'mixed', label: 'Mixed' },
];

const LANGUAGE_PRIORITIES: { value: ProductionSpecs['languagePriority']; label: string }[] = [
  { value: 'en-first', label: 'EN first' },
  { value: 'ro-first', label: 'RO first' },
  { value: 'equal', label: 'Equal' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface IdentityTabProps {
  propertyId: string;
  brief: ContentBrief | null;
}

export function IdentityTab({ propertyId, brief }: IdentityTabProps) {
  const initial = briefToForm(brief);
  const [form, setForm] = useState<FormData>(() => briefToForm(brief));
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Helpers to update nested state
  const update = useCallback(<K extends keyof FormData>(section: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [section]: value }));
    setIsDirty(true);
  }, []);

  const updateVoice = useCallback(
    (patch: Partial<OwnerVoice>) => update('ownerVoice', { ...form.ownerVoice, ...patch }),
    [form.ownerVoice, update]
  );
  const updateStory = useCallback(
    (patch: Partial<PropertyStory>) => update('propertyStory', { ...form.propertyStory, ...patch }),
    [form.propertyStory, update]
  );
  const updateArea = useCallback(
    (patch: Partial<AreaContext>) => update('areaContext', { ...form.areaContext, ...patch }),
    [form.areaContext, update]
  );
  const updateSpecs = useCallback(
    (patch: Partial<ProductionSpecs>) => update('productionSpecs', { ...form.productionSpecs, ...patch }),
    [form.productionSpecs, update]
  );

  const handleDiscard = () => {
    setForm(initial);
    setIsDirty(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const result = await saveContentBrief(propertyId, form);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Content brief saved.' });
      setIsDirty(false);
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-2">
      <Accordion type="multiple" defaultValue={['owner-voice', 'property-story', 'area-context', 'production-specs']}>
        {/* ---------------------------------------------------------------- */}
        {/* Section 1: Owner Voice */}
        {/* ---------------------------------------------------------------- */}
        <AccordionItem value="owner-voice">
          <AccordionTrigger>Owner Voice</AccordionTrigger>
          <AccordionContent className="space-y-6">
            <div className="space-y-1.5">
              <Label className="text-sm">Tone Descriptors</Label>
              <TagInput
                tags={form.ownerVoice.toneDescriptors}
                onChange={(v) => updateVoice({ toneDescriptors: v })}
                placeholder="e.g. warm, welcoming, knowledgeable"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Communication Style</Label>
              <Select
                value={form.ownerVoice.communicationStyle}
                onValueChange={(v) => updateVoice({ communicationStyle: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNICATION_STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <MultilingualInput
              label="Voice Description"
              value={form.ownerVoice.description}
              onChange={(v) => updateVoice({ description: v })}
              multiline
              placeholder="Describe how you want your brand voice to sound"
            />

            <div className="space-y-1.5">
              <Label className="text-sm">Sample Phrases</Label>
              <SortableList
                items={form.ownerVoice.samplePhrases}
                onReorder={(items) => updateVoice({ samplePhrases: items })}
                onRemove={(i) => updateVoice({ samplePhrases: form.ownerVoice.samplePhrases.filter((_, idx) => idx !== i) })}
                onAdd={() => updateVoice({ samplePhrases: [...form.ownerVoice.samplePhrases, emptyML()] })}
                addLabel="Add Phrase"
                compact
                renderItem={(item, index) => (
                  <MultilingualInput
                    label={`Phrase ${index + 1}`}
                    value={item}
                    onChange={(v) => {
                      const next = [...form.ownerVoice.samplePhrases];
                      next[index] = v;
                      updateVoice({ samplePhrases: next });
                    }}
                    inline
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Topics to Avoid</Label>
              <TagInput
                tags={form.ownerVoice.avoidTopics}
                onChange={(v) => updateVoice({ avoidTopics: v })}
                placeholder="e.g. politics, competitor names"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ---------------------------------------------------------------- */}
        {/* Section 2: Property Story */}
        {/* ---------------------------------------------------------------- */}
        <AccordionItem value="property-story">
          <AccordionTrigger>Property Story</AccordionTrigger>
          <AccordionContent className="space-y-6">
            <MultilingualInput
              label="History"
              value={form.propertyStory.history}
              onChange={(v) => updateStory({ history: v })}
              multiline
              placeholder="Tell the story of the property"
            />

            <div className="space-y-1.5">
              <Label className="text-sm">Unique Features</Label>
              <SortableList
                items={form.propertyStory.uniqueFeatures}
                onReorder={(items) => updateStory({ uniqueFeatures: items })}
                onRemove={(i) => updateStory({ uniqueFeatures: form.propertyStory.uniqueFeatures.filter((_, idx) => idx !== i) })}
                onAdd={() => updateStory({ uniqueFeatures: [...form.propertyStory.uniqueFeatures, emptyML()] })}
                addLabel="Add Feature"
                compact
                renderItem={(item, index) => (
                  <MultilingualInput
                    label={`Feature ${index + 1}`}
                    value={item}
                    onChange={(v) => {
                      const next = [...form.propertyStory.uniqueFeatures];
                      next[index] = v;
                      updateStory({ uniqueFeatures: next });
                    }}
                    inline
                  />
                )}
              />
            </div>

            <MultilingualInput
              label="Design Philosophy"
              value={form.propertyStory.designPhilosophy}
              onChange={(v) => updateStory({ designPhilosophy: v })}
              multiline
              placeholder="Describe the interior design and aesthetic vision"
            />

            <MultilingualInput
              label="Guest Experience"
              value={form.propertyStory.guestExperience}
              onChange={(v) => updateStory({ guestExperience: v })}
              multiline
              placeholder="What do guests feel during their stay?"
            />
          </AccordionContent>
        </AccordionItem>

        {/* ---------------------------------------------------------------- */}
        {/* Section 3: Area Context */}
        {/* ---------------------------------------------------------------- */}
        <AccordionItem value="area-context">
          <AccordionTrigger>Area Context</AccordionTrigger>
          <AccordionContent className="space-y-6">
            <MultilingualInput
              label="Location Story"
              value={form.areaContext.locationStory}
              onChange={(v) => updateArea({ locationStory: v })}
              multiline
              placeholder="Describe what makes this location special"
            />

            <MultilingualInput
              label="Cultural Context"
              value={form.areaContext.culturalContext}
              onChange={(v) => updateArea({ culturalContext: v })}
              multiline
              placeholder="Local traditions, food, customs"
            />

            <div className="space-y-1.5">
              <Label className="text-sm">Hidden Gems</Label>
              <SortableList
                items={form.areaContext.hiddenGems}
                onReorder={(items) => updateArea({ hiddenGems: items })}
                onRemove={(i) => updateArea({ hiddenGems: form.areaContext.hiddenGems.filter((_, idx) => idx !== i) })}
                onAdd={() => updateArea({ hiddenGems: [...form.areaContext.hiddenGems, emptyML()] })}
                addLabel="Add Hidden Gem"
                compact
                renderItem={(item, index) => (
                  <MultilingualInput
                    label={`Gem ${index + 1}`}
                    value={item}
                    onChange={(v) => {
                      const next = [...form.areaContext.hiddenGems];
                      next[index] = v;
                      updateArea({ hiddenGems: next });
                    }}
                    inline
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Neighborhoods</Label>
              <SortableList
                items={form.areaContext.neighborhoods}
                onReorder={(items) => updateArea({ neighborhoods: items })}
                onRemove={(i) => updateArea({ neighborhoods: form.areaContext.neighborhoods.filter((_, idx) => idx !== i) })}
                onAdd={() => updateArea({ neighborhoods: [...form.areaContext.neighborhoods, { name: emptyML(), description: emptyML(), distanceKm: 0 }] })}
                addLabel="Add Neighborhood"
                renderItem={(item, index) => (
                  <div className="space-y-3">
                    <MultilingualInput
                      label="Name"
                      value={item.name}
                      onChange={(v) => {
                        const next = [...form.areaContext.neighborhoods];
                        next[index] = { ...next[index], name: v };
                        updateArea({ neighborhoods: next });
                      }}
                    />
                    <MultilingualInput
                      label="Description"
                      value={item.description}
                      onChange={(v) => {
                        const next = [...form.areaContext.neighborhoods];
                        next[index] = { ...next[index], description: v };
                        updateArea({ neighborhoods: next });
                      }}
                      multiline
                    />
                    <div className="space-y-1.5">
                      <Label className="text-sm">Distance (km)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={item.distanceKm || ''}
                        onChange={(e) => {
                          const next = [...form.areaContext.neighborhoods];
                          next[index] = { ...next[index], distanceKm: parseFloat(e.target.value) || 0 };
                          updateArea({ neighborhoods: next });
                        }}
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}
              />
            </div>

            <MultilingualInput
              label="Transport Notes"
              value={form.areaContext.transportNotes}
              onChange={(v) => updateArea({ transportNotes: v })}
              multiline
              placeholder="How to get there, parking, public transport"
            />
          </AccordionContent>
        </AccordionItem>

        {/* ---------------------------------------------------------------- */}
        {/* Section 4: Production Specs */}
        {/* ---------------------------------------------------------------- */}
        <AccordionItem value="production-specs">
          <AccordionTrigger>Production Specs</AccordionTrigger>
          <AccordionContent className="space-y-6">
            <div className="space-y-1.5">
              <Label className="text-sm">Target Audience</Label>
              <Select
                value={form.productionSpecs.targetAudience}
                onValueChange={(v) => updateSpecs({ targetAudience: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_AUDIENCES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-medium">SEO Keywords</Label>
              <div className="space-y-3 pl-2 border-l-2 border-muted">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Primary</Label>
                  <TagInput
                    tags={form.productionSpecs.seoKeywords.primary}
                    onChange={(v) => updateSpecs({ seoKeywords: { ...form.productionSpecs.seoKeywords, primary: v } })}
                    placeholder="e.g. mountain chalet, Prahova Valley"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Secondary</Label>
                  <TagInput
                    tags={form.productionSpecs.seoKeywords.secondary}
                    onChange={(v) => updateSpecs({ seoKeywords: { ...form.productionSpecs.seoKeywords, secondary: v } })}
                    placeholder="e.g. ski resort nearby, hiking trails"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Local Terms</Label>
                  <TagInput
                    tags={form.productionSpecs.seoKeywords.localTerms}
                    onChange={(v) => updateSpecs({ seoKeywords: { ...form.productionSpecs.seoKeywords, localTerms: v } })}
                    placeholder="e.g. cabana, munte, Valea Prahovei"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Content Lengths (words)</Label>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Short</Label>
                  <Input
                    type="number"
                    min={50}
                    value={form.productionSpecs.contentLength.short}
                    onChange={(e) => updateSpecs({ contentLength: { ...form.productionSpecs.contentLength, short: parseInt(e.target.value) || 150 } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Medium</Label>
                  <Input
                    type="number"
                    min={100}
                    value={form.productionSpecs.contentLength.medium}
                    onChange={(e) => updateSpecs({ contentLength: { ...form.productionSpecs.contentLength, medium: parseInt(e.target.value) || 400 } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Long</Label>
                  <Input
                    type="number"
                    min={200}
                    value={form.productionSpecs.contentLength.long}
                    onChange={(e) => updateSpecs({ contentLength: { ...form.productionSpecs.contentLength, long: parseInt(e.target.value) || 800 } })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Language Priority</Label>
              <div className="flex gap-1 rounded-lg border p-1">
                {LANGUAGE_PRIORITIES.map((lp) => (
                  <button
                    key={lp.value}
                    type="button"
                    onClick={() => updateSpecs({ languagePriority: lp.value })}
                    className={cn(
                      'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      form.productionSpecs.languagePriority === lp.value
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                  >
                    {lp.label}
                  </button>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Sticky save bar */}
      {isDirty && (
        <div className="sticky bottom-4 z-40">
          <div className="flex items-center justify-between gap-4 rounded-lg border bg-background p-4 shadow-lg">
            <span className="text-sm text-muted-foreground">Unsaved changes</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleDiscard} disabled={isSaving}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Discard
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
