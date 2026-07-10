'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, ImageOff, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdCallToAction, CityTarget, ComposeAndCreateAdInput } from '@/types';
import type { CityMatch } from '@/services/growth/metaAds/geo';
import { composeAdAction, searchCitiesAction } from '../actions';

/**
 * Mirrors `adComposer`'s `MAX_IMAGES`/`MAX_COPY_VARIANTS` ceilings (Meta's
 * `asset_feed_spec.images[]`/`bodies[]`/`titles[]` limits,
 * docs/meta-ads-infrastructure-2026.md §10). UI-side guard only — `adComposer`
 * re-checks both server-side regardless of what this form sends.
 */
const MAX_IMAGES = 10;
const MAX_COPY_VARIANTS = 5;

/** Default radius (km) applied to a newly-picked city — operator can edit per-chip. */
const DEFAULT_CITY_RADIUS_KM = 40;

/** Debounce delay before firing `searchCitiesAction` on keystroke. */
const CITY_SEARCH_DEBOUNCE_MS = 300;

/** Minimum trimmed query length before searching — avoids a Graph call per single keystroke. */
const CITY_SEARCH_MIN_CHARS = 2;

const CTA_OPTIONS: Array<{ value: AdCallToAction; label: string; verified: boolean }> = [
  { value: 'learn_more', label: 'Learn more', verified: true },
  { value: 'book_now', label: 'Book now', verified: false },
  { value: 'contact_us', label: 'Contact us', verified: false },
];

interface GalleryImage {
  storagePath: string;
  url: string;
  alt: string;
  thumbnailUrl?: string;
}

interface ComposeFormProps {
  propertyId: string;
  images: GalleryImage[];
  defaultLandingUrl: string;
  /** Bani — server's `MAX_DAILY_BUDGET_MINOR`. Display/UX guard only; `adComposer.validateDailyBudget` is the real enforcement (B2). */
  maxDailyBudgetMinor: number;
}

/** End-of-day ISO 8601 for a `YYYY-MM-DD` date input value — `endTime` is required (B2), so a bare date needs a concrete time-of-day. */
function endOfDayIso(dateStr: string): string | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T23:59:59`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function ComposeForm({ propertyId, images, defaultLandingUrl, maxDailyBudgetMinor }: ComposeFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // ---- photos (multi-select, 1-MAX_IMAGES) ---------------------------------
  const [selectedPaths, setSelectedPaths] = useState<string[]>(images[0] ? [images[0].storagePath] : []);

  // ---- copy (1-MAX_COPY_VARIANTS primary-text variants, shared headline+CTA) ----
  const [primaryTexts, setPrimaryTexts] = useState<string[]>(['']);
  const [headline, setHeadline] = useState('');
  const [cta, setCta] = useState<AdCallToAction>('learn_more');

  // ---- city targeting (typeahead -> chips with per-city radius) ------------
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<CityMatch[]>([]);
  const [citySearchPending, setCitySearchPending] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [selectedCities, setSelectedCities] = useState<CityTarget[]>([]);
  const latestCityQueryRef = useRef('');

  // ---- rest of the form ------------------------------------------------
  const [landingBaseUrl, setLandingBaseUrl] = useState(defaultLandingUrl);
  const [dailyBudgetRon, setDailyBudgetRon] = useState<string>('20');
  const [endDate, setEndDate] = useState('');

  const maxDailyBudgetRon = maxDailyBudgetMinor / 100;

  // Debounced city search — a stale-response guard (`latestCityQueryRef`)
  // discards a slow/out-of-order response for a query the operator has since
  // typed past, same discipline as any race-prone autocomplete.
  useEffect(() => {
    const trimmed = cityQuery.trim();
    latestCityQueryRef.current = trimmed;
    if (trimmed.length < CITY_SEARCH_MIN_CHARS) {
      setCityResults([]);
      setCitySearchPending(false);
      return;
    }
    setCitySearchPending(true);
    const handle = setTimeout(async () => {
      const matches = await searchCitiesAction(propertyId, trimmed);
      if (latestCityQueryRef.current === trimmed) {
        setCityResults(matches);
        setCitySearchPending(false);
      }
    }, CITY_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [cityQuery, propertyId]);

  const toggleImage = (path: string) => {
    setSelectedPaths((prev) => {
      if (prev.includes(path)) return prev.filter((p) => p !== path);
      if (prev.length >= MAX_IMAGES) {
        toast({ title: 'Too many photos', description: `Select up to ${MAX_IMAGES} photos.`, variant: 'destructive' });
        return prev;
      }
      return [...prev, path];
    });
  };

  const updatePrimaryText = (idx: number, value: string) => {
    setPrimaryTexts((prev) => prev.map((t, i) => (i === idx ? value : t)));
  };
  const addPrimaryText = () => {
    setPrimaryTexts((prev) => (prev.length >= MAX_COPY_VARIANTS ? prev : [...prev, '']));
  };
  const removePrimaryText = (idx: number) => {
    setPrimaryTexts((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const selectCity = (match: CityMatch) => {
    setSelectedCities((prev) => {
      if (prev.some((c) => c.key === match.key)) return prev;
      return [...prev, { key: match.key, name: match.name, region: match.region, radius: DEFAULT_CITY_RADIUS_KM }];
    });
    setCityQuery('');
    setCityResults([]);
    setShowCityDropdown(false);
  };
  const removeCity = (key: string) => setSelectedCities((prev) => prev.filter((c) => c.key !== key));
  const updateCityRadius = (key: string, radius: number) => {
    setSelectedCities((prev) => prev.map((c) => (c.key === key ? { ...c, radius } : c)));
  };

  const validate = (): string | null => {
    if (selectedPaths.length === 0) return 'Select at least one photo.';
    if (selectedPaths.length > MAX_IMAGES) return `Select at most ${MAX_IMAGES} photos.`;
    const trimmedTexts = primaryTexts.map((t) => t.trim()).filter(Boolean);
    if (trimmedTexts.length === 0) return 'Add at least one primary text.';
    if (trimmedTexts.length > MAX_COPY_VARIANTS) return `Add at most ${MAX_COPY_VARIANTS} primary text variants.`;
    if (!landingBaseUrl.trim()) return 'Landing URL is required.';
    try {
      new URL(landingBaseUrl);
    } catch {
      return 'Landing URL is not a valid URL.';
    }
    const budget = Number(dailyBudgetRon);
    if (!Number.isFinite(budget) || budget <= 0) return 'Daily budget must be a positive number.';
    if (selectedCities.length === 0) return 'Add at least one city to target.';
    for (const c of selectedCities) {
      if (!Number.isFinite(c.radius) || c.radius <= 0) return `Radius for ${c.name} must be a positive number (km).`;
    }
    const endIso = endOfDayIso(endDate);
    if (!endIso) return 'End date is required.';
    if (Date.parse(endIso) <= Date.now()) return 'End date must be in the future.';
    return null;
  };

  const submit = () => {
    const validationError = validate();
    if (validationError) {
      toast({ title: 'Check the form', description: validationError, variant: 'destructive' });
      return;
    }

    const trimmedTexts = primaryTexts.map((t) => t.trim()).filter(Boolean);
    const trimmedHeadline = headline.trim() || undefined;

    const input: ComposeAndCreateAdInput = {
      propertyId,
      // Phase 2b: 1 photo -> single-image object_story_spec; 2+ -> Dynamic
      // Creative (adComposer/campaignBuilder decide the branch from lengths).
      assetRefs: selectedPaths.map((storagePath) => ({ kind: 'gallery', storagePath })),
      // Each primary-text variant shares the one headline + CTA — Meta A/B
      // tests the primary-text variants against each other.
      copy: trimmedTexts.map((primary) => ({ primary, headline: trimmedHeadline, cta })),
      objective: 'sales',
      landingBaseUrl: landingBaseUrl.trim(),
      dailyBudgetMinor: Math.round(Number(dailyBudgetRon) * 100),
      // No countries fallback in this UI (2b makes cities the primary/only
      // control here) — `adComposer` requires at least one city or country;
      // `validate()` above already enforces >=1 city.
      targeting: { cities: selectedCities },
      endTime: endOfDayIso(endDate)!,
    };

    startTransition(async () => {
      const result = await composeAdAction(input);
      if (result.ok) {
        toast({ title: 'Draft created', description: 'PAUSED on Meta, zero spend. Review and approve it next.' });
        router.push(`/admin/ads/${result.adCampaignId}`);
      } else {
        toast({
          title: 'Compose failed',
          description: `[${result.stage}] ${result.error}`,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
            <CardDescription>
              Pick 1–{MAX_IMAGES} photos from this property&apos;s gallery. Selecting 2 or more lets Meta run Dynamic
              Creative — it auto-tests image/copy combinations for you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {images.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <ImageOff className="h-8 w-8" />
                <p className="text-sm">No gallery images with a stored file found for this property.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {images.map((img) => {
                    const selected = selectedPaths.includes(img.storagePath);
                    return (
                      <button
                        key={img.storagePath}
                        type="button"
                        onClick={() => toggleImage(img.storagePath)}
                        className={cn(
                          'relative aspect-square rounded-md overflow-hidden border-2 transition-all',
                          selected
                            ? 'border-primary ring-2 ring-primary/30'
                            : 'border-transparent hover:border-muted-foreground/30'
                        )}
                      >
                        <Image
                          src={img.thumbnailUrl || img.url}
                          alt={img.alt || ''}
                          fill
                          className="object-cover"
                          sizes="150px"
                        />
                        {selected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <div className="rounded-full bg-primary p-1">
                              <Check className="h-4 w-4 text-primary-foreground" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {selectedPaths.length} of {MAX_IMAGES} selected
                  {selectedPaths.length >= 2 ? ' — Dynamic Creative will test them.' : '.'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Copy</CardTitle>
            <CardDescription>
              Add 1–{MAX_COPY_VARIANTS} primary-text variants. Meta will A/B-test them against each other
              automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>Primary text</Label>
              {primaryTexts.map((text, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <Textarea
                    value={text}
                    onChange={(e) => updatePrimaryText(idx, e.target.value)}
                    placeholder={
                      idx === 0
                        ? 'e.g. Escape to the mountains — book your stay at Prahova Chalet'
                        : `Variant ${idx + 1}`
                    }
                    rows={2}
                    className="flex-1"
                  />
                  {primaryTexts.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePrimaryText(idx)}
                      aria-label={`Remove variant ${idx + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {primaryTexts.length < MAX_COPY_VARIANTS && (
                <Button type="button" variant="outline" size="sm" onClick={addPrimaryText}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add variant
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="headline">Headline (optional)</Label>
              <Input
                id="headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Prahova Mountain Chalet"
              />
              <p className="text-xs text-muted-foreground">Shared across every primary-text variant above.</p>
            </div>

            <div className="space-y-2">
              <Label>Call to action</Label>
              <Select value={cta} onValueChange={(v) => setCta(v as AdCallToAction)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CTA_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                      {!o.verified ? ' (unverified against this account)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>City targeting</CardTitle>
            <CardDescription>
              Search a city, pick it, then set a radius. Meta&apos;s Advantage+ audience finds the right people
              within these areas — for exact age or interests, edit the ad in Ads Manager.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Input
                value={cityQuery}
                onChange={(e) => {
                  setCityQuery(e.target.value);
                  setShowCityDropdown(true);
                }}
                onFocus={() => setShowCityDropdown(true)}
                onBlur={() => setShowCityDropdown(false)}
                placeholder="Search a city, e.g. Ploiești"
              />
              {showCityDropdown && cityQuery.trim().length >= CITY_SEARCH_MIN_CHARS && (
                <div
                  className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-md border bg-popover shadow-md"
                  // Prevents the input's blur (which would close this dropdown
                  // before the click below fires) when clicking inside it.
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {citySearchPending ? (
                    <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Searching…
                    </div>
                  ) : cityResults.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">No matches.</div>
                  ) : (
                    cityResults.map((match) => (
                      <button
                        key={match.key}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => selectCity(match)}
                      >
                        <span>{match.name}</span>
                        {match.region && <span className="text-xs text-muted-foreground">{match.region}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedCities.length === 0 ? (
              <p className="text-xs text-muted-foreground">No cities selected yet.</p>
            ) : (
              <div className="space-y-2">
                {selectedCities.map((c) => (
                  <div key={c.key} className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {c.name}
                      {c.region ? `, ${c.region}` : ''}
                      <button
                        type="button"
                        onClick={() => removeCity(c.key)}
                        aria-label={`Remove ${c.name}`}
                        className="ml-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={1}
                        step="1"
                        className="h-7 w-16"
                        value={c.radius}
                        onChange={(e) => updateCityRadius(c.key, Number(e.target.value))}
                      />
                      <span className="text-xs text-muted-foreground">km radius</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Ad details</CardTitle>
          <CardDescription>Composing always creates a PAUSED, zero-spend draft on Meta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="landing-url">Landing URL</Label>
            <Input id="landing-url" value={landingBaseUrl} onChange={(e) => setLandingBaseUrl(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Defaults to the property&apos;s canonical custom domain — keep it that way so Meta&apos;s conversion
              tracking matches the pixel domain.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="daily-budget">Daily budget (RON)</Label>
            <Input
              id="daily-budget"
              type="number"
              min={1}
              max={maxDailyBudgetRon}
              step="0.01"
              value={dailyBudgetRon}
              onChange={(e) => setDailyBudgetRon(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Max {maxDailyBudgetRon} RON/day (server-enforced, this is a display hint only).</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-date">End date (required)</Label>
            <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">Bounds real spend — Meta&apos;s campaign-level spend-cap floor is too high for a small first test.</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={submit} disabled={pending} className="w-full">
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create draft
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
