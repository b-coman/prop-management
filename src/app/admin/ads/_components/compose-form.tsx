'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdCallToAction, ComposeAndCreateAdInput } from '@/types';
import { composeAdAction } from '../actions';

// A short, curated list — a Romanian vacation-rental audience realistically
// targets these; the neutral compose input takes an arbitrary countries[]
// array so this list is a UX convenience, not a platform limit.
const COUNTRY_OPTIONS = [
  { code: 'RO', label: 'Romania' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'IT', label: 'Italy' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'US', label: 'United States' },
];

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

  const [storagePath, setStoragePath] = useState<string>(images[0]?.storagePath ?? '');
  const [primary, setPrimary] = useState('');
  const [headline, setHeadline] = useState('');
  const [cta, setCta] = useState<AdCallToAction>('learn_more');
  const [landingBaseUrl, setLandingBaseUrl] = useState(defaultLandingUrl);
  const [dailyBudgetRon, setDailyBudgetRon] = useState<string>('20');
  const [countries, setCountries] = useState<string[]>(['RO']);
  const [endDate, setEndDate] = useState('');

  const maxDailyBudgetRon = maxDailyBudgetMinor / 100;

  const toggleCountry = (code: string) => {
    setCountries((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const validate = (): string | null => {
    if (!storagePath) return 'Select a photo.';
    if (!primary.trim()) return 'Primary text is required.';
    if (!landingBaseUrl.trim()) return 'Landing URL is required.';
    try {
      new URL(landingBaseUrl);
    } catch {
      return 'Landing URL is not a valid URL.';
    }
    const budget = Number(dailyBudgetRon);
    if (!Number.isFinite(budget) || budget <= 0) return 'Daily budget must be a positive number.';
    if (countries.length === 0) return 'Select at least one country.';
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

    const input: ComposeAndCreateAdInput = {
      propertyId,
      // Phase 2b widened this to an array (multi-image Dynamic Creative) and
      // dropped age targeting (Advantage+ Audience owns demographics now) —
      // this form still only offers single-photo/country-only selection; a
      // city picker + multi-photo picker is Build B's job for 2b, not done here.
      assetRefs: [{ kind: 'gallery', storagePath }],
      copy: [{ primary: primary.trim(), headline: headline.trim() || undefined, cta }],
      objective: 'sales',
      landingBaseUrl: landingBaseUrl.trim(),
      dailyBudgetMinor: Math.round(Number(dailyBudgetRon) * 100),
      targeting: { cities: [], countries },
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
      <Card>
        <CardHeader>
          <CardTitle>Photo</CardTitle>
          <CardDescription>Pick one photo from this property&apos;s gallery. Meta auto-fits it to each placement.</CardDescription>
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <ImageOff className="h-8 w-8" />
              <p className="text-sm">No gallery images with a stored file found for this property.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {images.map((img) => (
                <button
                  key={img.storagePath}
                  type="button"
                  onClick={() => setStoragePath(img.storagePath)}
                  className={cn(
                    'relative aspect-square rounded-md overflow-hidden border-2 transition-all',
                    storagePath === img.storagePath
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
                  {storagePath === img.storagePath && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="rounded-full bg-primary p-1">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Ad details</CardTitle>
          <CardDescription>Composing always creates a PAUSED, zero-spend draft on Meta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="primary">Primary text</Label>
            <Textarea
              id="primary"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              placeholder="e.g. Escape to the mountains — book your stay at Prahova Chalet"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="headline">Headline (optional)</Label>
            <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Prahova Mountain Chalet" />
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

          <div className="space-y-2">
            <Label htmlFor="landing-url">Landing URL</Label>
            <Input
              id="landing-url"
              value={landingBaseUrl}
              onChange={(e) => setLandingBaseUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Defaults to the property&apos;s canonical custom domain — keep it that way so Meta&apos;s conversion tracking matches the pixel domain.
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
            <Label>Countries</Label>
            <div className="grid grid-cols-2 gap-2">
              {COUNTRY_OPTIONS.map((c) => (
                <label key={c.code} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={countries.includes(c.code)} onCheckedChange={() => toggleCountry(c.code)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          {/* Age targeting removed (Phase 2b, §9f): the baked-in Advantage+
              Audience default owns demographics and rejects a hard age range
              outright — GEO (countries/cities) + copy qualify the audience
              instead. A city + radius picker is Build B's job for 2b. */}

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
