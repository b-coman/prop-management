'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TagInput } from './tag-input';
import { DataSourceCard } from './data-source-card';
import { useToast } from '@/hooks/use-toast';
import { saveContentBrief } from '../actions';
import { Save, RotateCcw, Loader2 } from 'lucide-react';
import type { ContentBrief, DataSourceConfig } from '@/lib/content-schemas';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS: DataSourceConfig = {
  googlePlaces: {
    enabled: false,
    searchRadius: 10000,
    includedTypes: [],
    excludedTypes: [],
  },
  weather: {
    enabled: false,
    coordinates: { lat: 0, lng: 0 },
  },
  events8pm: {
    enabled: false,
    city: '',
    categories: [],
    lookAheadDays: 30,
  },
  venues8pm: {
    enabled: false,
    city: '',
    categories: [],
    limit: 20,
  },
  perplexityResearch: {
    enabled: false,
    domainAllowlist: [],
    domainBlocklist: [],
    recencyFilter: 'month',
  },
  trainSchedule: {
    enabled: false,
    nearestStation: '',
    originCities: [],
  },
};

function briefToConfig(brief: ContentBrief | null): DataSourceConfig {
  if (!brief?.dataSources) return DEFAULTS;
  const ds = brief.dataSources;
  return {
    googlePlaces: { ...DEFAULTS.googlePlaces, ...ds.googlePlaces },
    weather: {
      ...DEFAULTS.weather,
      ...ds.weather,
      coordinates: { ...DEFAULTS.weather.coordinates, ...ds.weather?.coordinates },
    },
    events8pm: { ...DEFAULTS.events8pm, ...ds.events8pm },
    venues8pm: { ...DEFAULTS.venues8pm, ...ds.venues8pm },
    perplexityResearch: { ...DEFAULTS.perplexityResearch, ...ds.perplexityResearch },
    trainSchedule: { ...DEFAULTS.trainSchedule, ...ds.trainSchedule },
  };
}

// ---------------------------------------------------------------------------
// Checkbox options
// ---------------------------------------------------------------------------

const GOOGLE_PLACE_TYPES = [
  'restaurant',
  'cafe',
  'bar',
  'tourist_attraction',
  'museum',
  'park',
  'shopping_mall',
  'spa',
  'gym',
  'grocery_or_supermarket',
  'gas_station',
  'pharmacy',
  'hospital',
];

const EVENTS_8PM_CATEGORIES = [
  'concerts',
  'theater',
  'festivals',
  'exhibitions',
  'sports',
  'comedy',
  'family',
];

const VENUES_8PM_CATEGORIES = [
  'restaurants',
  'bars',
  'clubs',
  'theaters',
  'cinemas',
  'cultural',
  'outdoor',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DataSourcesTabProps {
  propertyId: string;
  brief: ContentBrief | null;
}

export function DataSourcesTab({ propertyId, brief }: DataSourcesTabProps) {
  const initial = briefToConfig(brief);
  const [config, setConfig] = useState<DataSourceConfig>(() => briefToConfig(brief));
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const updateSource = useCallback(
    <K extends keyof DataSourceConfig>(key: K, patch: Partial<DataSourceConfig[K]>) => {
      setConfig((prev) => ({
        ...prev,
        [key]: { ...prev[key], ...patch },
      }));
      setIsDirty(true);
    },
    []
  );

  const toggleSource = useCallback(
    (key: keyof DataSourceConfig, enabled: boolean) => {
      updateSource(key, { enabled } as Partial<DataSourceConfig[typeof key]>);
    },
    [updateSource]
  );

  const handleDiscard = () => {
    setConfig(initial);
    setIsDirty(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const result = await saveContentBrief(propertyId, { dataSources: config });
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Data source configuration saved.' });
      setIsDirty(false);
    }
    setIsSaving(false);
  };

  // Helpers for checkbox lists
  const toggleArrayItem = (arr: string[], item: string): string[] =>
    arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];

  return (
    <div className="space-y-3">
      {/* ---------------------------------------------------------------- */}
      {/* Google Places */}
      {/* ---------------------------------------------------------------- */}
      <DataSourceCard
        title="Google Places"
        description="Nearby attractions, restaurants, and points of interest"
        enabled={config.googlePlaces.enabled}
        onToggle={(v) => toggleSource('googlePlaces', v)}
      >
        <div className="space-y-1.5">
          <Label className="text-sm">
            Search Radius: {Math.round(config.googlePlaces.searchRadius / 1000)} km
          </Label>
          <Slider
            value={[config.googlePlaces.searchRadius / 1000]}
            onValueChange={([v]) => updateSource('googlePlaces', { searchRadius: v * 1000 })}
            min={1}
            max={50}
            step={1}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1 km</span>
            <span>50 km</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Included Types</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {GOOGLE_PLACE_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={config.googlePlaces.includedTypes.includes(type)}
                  onCheckedChange={() =>
                    updateSource('googlePlaces', {
                      includedTypes: toggleArrayItem(config.googlePlaces.includedTypes, type),
                    })
                  }
                />
                {type.replace(/_/g, ' ')}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Excluded Types</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {GOOGLE_PLACE_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={config.googlePlaces.excludedTypes.includes(type)}
                  onCheckedChange={() =>
                    updateSource('googlePlaces', {
                      excludedTypes: toggleArrayItem(config.googlePlaces.excludedTypes, type),
                    })
                  }
                />
                {type.replace(/_/g, ' ')}
              </label>
            ))}
          </div>
        </div>
      </DataSourceCard>

      {/* ---------------------------------------------------------------- */}
      {/* Weather */}
      {/* ---------------------------------------------------------------- */}
      <DataSourceCard
        title="Weather (Visual Crossing)"
        description="Climate data and seasonal weather patterns"
        enabled={config.weather.enabled}
        onToggle={(v) => toggleSource('weather', v)}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Latitude</Label>
            <Input
              type="number"
              step="any"
              value={config.weather.coordinates.lat || ''}
              onChange={(e) =>
                updateSource('weather', {
                  coordinates: {
                    ...config.weather.coordinates,
                    lat: parseFloat(e.target.value) || 0,
                  },
                })
              }
              placeholder="e.g. 45.35"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Longitude</Label>
            <Input
              type="number"
              step="any"
              value={config.weather.coordinates.lng || ''}
              onChange={(e) =>
                updateSource('weather', {
                  coordinates: {
                    ...config.weather.coordinates,
                    lng: parseFloat(e.target.value) || 0,
                  },
                })
              }
              placeholder="e.g. 25.55"
            />
          </div>
        </div>
      </DataSourceCard>

      {/* ---------------------------------------------------------------- */}
      {/* 8pm.ro Events */}
      {/* ---------------------------------------------------------------- */}
      <DataSourceCard
        title="8pm.ro Events"
        description="Upcoming local events, concerts, and shows"
        enabled={config.events8pm.enabled}
        onToggle={(v) => toggleSource('events8pm', v)}
      >
        <div className="space-y-1.5">
          <Label className="text-sm">City</Label>
          <Input
            value={config.events8pm.city}
            onChange={(e) => updateSource('events8pm', { city: e.target.value })}
            placeholder="e.g. Sinaia, Bucharest"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Categories</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {EVENTS_8PM_CATEGORIES.map((cat) => (
              <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer capitalize">
                <Checkbox
                  checked={config.events8pm.categories.includes(cat)}
                  onCheckedChange={() =>
                    updateSource('events8pm', {
                      categories: toggleArrayItem(config.events8pm.categories, cat),
                    })
                  }
                />
                {cat}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Look-Ahead Days</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={config.events8pm.lookAheadDays}
            onChange={(e) =>
              updateSource('events8pm', { lookAheadDays: parseInt(e.target.value) || 30 })
            }
          />
        </div>
      </DataSourceCard>

      {/* ---------------------------------------------------------------- */}
      {/* 8pm.ro Venues */}
      {/* ---------------------------------------------------------------- */}
      <DataSourceCard
        title="8pm.ro Venues"
        description="Nearby restaurants, bars, theaters, and cultural venues"
        enabled={config.venues8pm.enabled}
        onToggle={(v) => toggleSource('venues8pm', v)}
      >
        <div className="space-y-1.5">
          <Label className="text-sm">City</Label>
          <Input
            value={config.venues8pm.city}
            onChange={(e) => updateSource('venues8pm', { city: e.target.value })}
            placeholder="e.g. Sinaia, Bucharest"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Categories</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {VENUES_8PM_CATEGORIES.map((cat) => (
              <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer capitalize">
                <Checkbox
                  checked={config.venues8pm.categories.includes(cat)}
                  onCheckedChange={() =>
                    updateSource('venues8pm', {
                      categories: toggleArrayItem(config.venues8pm.categories, cat),
                    })
                  }
                />
                {cat}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Limit</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={config.venues8pm.limit}
            onChange={(e) =>
              updateSource('venues8pm', { limit: parseInt(e.target.value) || 20 })
            }
          />
        </div>
      </DataSourceCard>

      {/* ---------------------------------------------------------------- */}
      {/* Perplexity Research */}
      {/* ---------------------------------------------------------------- */}
      <DataSourceCard
        title="Perplexity Research"
        description="AI-powered web research for area insights"
        enabled={config.perplexityResearch.enabled}
        onToggle={(v) => toggleSource('perplexityResearch', v)}
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Domain Allowlist</Label>
          <TagInput
            tags={config.perplexityResearch.domainAllowlist}
            onChange={(v) => updateSource('perplexityResearch', { domainAllowlist: v })}
            placeholder="e.g. tripadvisor.com, lonelyplanet.com"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Domain Blocklist</Label>
          <TagInput
            tags={config.perplexityResearch.domainBlocklist}
            onChange={(v) => updateSource('perplexityResearch', { domainBlocklist: v })}
            placeholder="e.g. spam-site.com"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Recency Filter</Label>
          <Select
            value={config.perplexityResearch.recencyFilter}
            onValueChange={(v: 'week' | 'month' | 'none') =>
              updateSource('perplexityResearch', { recencyFilter: v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Past Week</SelectItem>
              <SelectItem value="month">Past Month</SelectItem>
              <SelectItem value="none">No Filter</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </DataSourceCard>

      {/* ---------------------------------------------------------------- */}
      {/* Train Schedule */}
      {/* ---------------------------------------------------------------- */}
      <DataSourceCard
        title="Train Schedule"
        description="Train routes and schedules from major cities"
        enabled={config.trainSchedule.enabled}
        onToggle={(v) => toggleSource('trainSchedule', v)}
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Nearest Station</Label>
          <Input
            value={config.trainSchedule.nearestStation}
            onChange={(e) => updateSource('trainSchedule', { nearestStation: e.target.value })}
            placeholder="e.g. Sinaia, Busteni"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Origin Cities</Label>
          <TagInput
            tags={config.trainSchedule.originCities}
            onChange={(v) => updateSource('trainSchedule', { originCities: v })}
            placeholder="e.g. Bucuresti Nord, Brasov"
          />
        </div>
      </DataSourceCard>

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
