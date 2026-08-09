'use client';
/**
 * Landing-page editor (P3). Holds the whole config in React state; edits copy (bilingual), hero + gallery
 * images (picked from the property's images), the reasoner's example stays (editable + "regenerate from
 * calendar"), and publish status. Saves the writable fields via saveLandingAction. Reuses the website
 * editor toolkit (MultilingualInput / ImagePicker / SortableList) so there's no duplication.
 */
import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Save, RotateCcw, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { MultilingualInput } from '@/app/admin/website/_components/multilingual-input';
import { ImagePicker } from '@/app/admin/website/_components/image-picker';
import { SortableList } from '@/app/admin/website/_components/sortable-list';
import { saveLandingAction, regenerateStaysAction, setLandingStatusAction } from '../actions';
import type { LandingConfig, ExampleStay } from '@/lib/landing/contracts';

type PropImg = { url: string; storagePath: string; thumbnailUrl?: string; alt?: string };
type MlObj = Record<string, string>;
const asMl = (v: unknown): MlObj | undefined =>
  v == null ? undefined : typeof v === 'string' ? { ro: v } : (v as MlObj);
const daysBetween = (a?: string | null, b?: string | null) =>
  a && b ? Math.max(0, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)) : 0;

export function LandingEditor({ initialConfig, propertyImages }: {
  initialConfig: LandingConfig; propertyImages: Array<Record<string, unknown>>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, startSave] = useTransition();
  const [busy, startBusy] = useTransition();

  const images = useMemo<PropImg[]>(() => propertyImages.map(i => ({
    url: String(i.url ?? ''), storagePath: String(i.storagePath ?? ''),
    thumbnailUrl: i.thumbnailUrl as string | undefined, alt: (typeof i.alt === 'string' ? i.alt : undefined),
  })), [propertyImages]);
  const pickerImages = useMemo(() => images.map(i => ({ url: i.url, alt: i.alt, thumbnailUrl: i.thumbnailUrl })), [images]);
  const urlOf = (sp?: string) => images.find(i => i.storagePath === sp)?.url ?? '';
  const pathOf = (url?: string | null) => (url ? images.find(i => i.url === url)?.storagePath ?? url : '');

  const [cfg, setCfg] = useState<LandingConfig>(initialConfig);
  const savedRef = useRef<LandingConfig>(initialConfig);
  const [dirty, setDirty] = useState(false);

  const patch = (p: Partial<LandingConfig>) => { setCfg(c => ({ ...c, ...p })); setDirty(true); };
  const lang = cfg.defaultLanguage || 'ro';

  // ── save / discard / publish ──
  const onSave = () => startSave(async () => {
    const res = await saveLandingAction(cfg.slug, {
      period: cfg.period, hero: cfg.hero, story: cfg.story, exampleStays: cfg.exampleStays,
      gallery: cfg.gallery, offer: cfg.offer, cta: cfg.cta, defaultLanguage: cfg.defaultLanguage, status: cfg.status,
    });
    if (res.ok) { savedRef.current = cfg; setDirty(false); toast({ description: 'Saved.' }); router.refresh(); }
    else toast({ variant: 'destructive', description: res.error });
  });
  const onDiscard = () => { setCfg(savedRef.current); setDirty(false); };
  const onTogglePublish = () => startBusy(async () => {
    const next = cfg.status === 'published' ? 'draft' : 'published';
    const res = await setLandingStatusAction(cfg.slug, next);
    if (res.ok) { setCfg(c => ({ ...c, status: next })); savedRef.current = { ...savedRef.current, status: next }; toast({ description: next === 'published' ? 'Published — live now.' : 'Unpublished.' }); }
    else toast({ variant: 'destructive', description: res.error });
  });
  const onRegenStays = () => startBusy(async () => {
    const res = await regenerateStaysAction(cfg.slug);
    if (res.ok) { setCfg(c => ({ ...c, exampleStays: res.stays })); savedRef.current = { ...savedRef.current, exampleStays: res.stays }; toast({ description: `Refreshed ${res.stays.length} stay(s) from the live calendar.` }); }
    else toast({ variant: 'destructive', description: res.error });
  });

  // ── example stays helpers ──
  const stays = cfg.exampleStays ?? [];
  const setStays = (next: ExampleStay[]) => patch({ exampleStays: next });
  const updateStay = (i: number, u: Partial<ExampleStay>) => {
    const next = stays.map((s, idx) => (idx === i ? { ...s, ...u } : s));
    if (u.start !== undefined || u.end !== undefined) next[i].nights = daysBetween(next[i].start, next[i].end);
    setStays(next);
  };
  const addStay = () => setStays([...stays, { start: '', end: '', nights: 0, label: { ro: '' }, occasion: null, priceHint: null, guests: null }]);

  // ── gallery helpers (stored as storagePaths) ──
  const gallery = cfg.gallery ?? [];
  const setGallery = (next: string[]) => patch({ gallery: next });

  return (
    <div className="space-y-6 pb-24">
      {/* Header: status + preview + language */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <Badge variant={cfg.status === 'published' ? 'default' : 'secondary'}>{cfg.status || 'draft'}</Badge>
          <Button variant="outline" size="sm" disabled={busy} onClick={onTogglePublish}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {cfg.status === 'published' ? 'Unpublish' : 'Publish'}
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/lp/${cfg.slug}/${lang}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Preview</a>
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Default language</Label>
            <Select value={lang} onValueChange={v => patch({ defaultLanguage: v })}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ro">Română</SelectItem><SelectItem value="en">English</SelectItem></SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Hero + period */}
      <Card>
        <CardHeader><CardTitle className="text-base">Hero</CardTitle><CardDescription>The first thing visitors see — scent-matched to the ad.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Hero image</Label>
            <ImagePicker value={urlOf(cfg.hero?.imagePath)} onChange={u => patch({ hero: { ...cfg.hero, imagePath: pathOf(u) } })} propertyImages={pickerImages} />
          </div>
          <MultilingualInput label="Headline" value={asMl(cfg.hero?.headline)} onChange={v => patch({ hero: { ...cfg.hero, headline: v } })} />
          <MultilingualInput label="Sub-copy" multiline value={asMl(cfg.hero?.subcopy)} onChange={v => patch({ hero: { ...cfg.hero, subcopy: v } })} />
          <MultilingualInput label="Period badge" value={asMl(cfg.period?.label)} onChange={v => patch({ period: { ...cfg.period, kind: cfg.period?.kind ?? 'season', label: v } })} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Type</Label>
              <Select value={cfg.period?.kind ?? 'season'} onValueChange={v => patch({ period: { ...cfg.period, kind: v as 'window' | 'season' } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="window">Window (dated)</SelectItem><SelectItem value="season">Season (broad)</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Start</Label>
              <Input type="date" value={cfg.period?.start ?? ''} onChange={e => patch({ period: { ...cfg.period, kind: cfg.period?.kind ?? 'window', start: e.target.value || null } })} />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">End</Label>
              <Input type="date" value={cfg.period?.end ?? ''} onChange={e => patch({ period: { ...cfg.period, kind: cfg.period?.kind ?? 'window', end: e.target.value || null } })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Story */}
      <Card>
        <CardHeader><CardTitle className="text-base">Story</CardTitle><CardDescription>The emotional invitation.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <MultilingualInput label="Title" value={asMl(cfg.story?.title)} onChange={v => patch({ story: { ...cfg.story, title: v } })} />
          <MultilingualInput label="Body" multiline value={asMl(cfg.story?.body)} onChange={v => patch({ story: { ...cfg.story, body: v } })} />
        </CardContent>
      </Card>

      {/* Example stays */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle className="text-base">Example stays</CardTitle><CardDescription>Real, calendar-valid, priced stays. Regenerate pulls fresh from the live calendar.</CardDescription></div>
            <Button variant="outline" size="sm" disabled={busy} onClick={onRegenStays}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Regenerate from calendar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <SortableList
            items={stays}
            addLabel="Add a stay"
            onReorder={setStays}
            onRemove={i => setStays(stays.filter((_, idx) => idx !== i))}
            onAdd={addStay}
            renderItem={(s, i) => (
              <div className="flex-1 space-y-3">
                <MultilingualInput label="Card label" value={asMl(s.label)} onChange={v => updateStay(i, { label: v })} />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div><Label className="mb-1 block text-xs text-muted-foreground">Check-in</Label><Input type="date" value={s.start} onChange={e => updateStay(i, { start: e.target.value })} /></div>
                  <div><Label className="mb-1 block text-xs text-muted-foreground">Check-out</Label><Input type="date" value={s.end} onChange={e => updateStay(i, { end: e.target.value })} /></div>
                  <div><Label className="mb-1 block text-xs text-muted-foreground">Nights</Label><Input type="number" value={s.nights} readOnly className="bg-muted/50" /></div>
                  <div><Label className="mb-1 block text-xs text-muted-foreground">Guests</Label><Input type="number" value={s.guests ?? ''} onChange={e => updateStay(i, { guests: e.target.value ? Number(e.target.value) : null })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="mb-1 block text-xs text-muted-foreground">From-price (RON)</Label><Input type="number" value={s.priceHint ?? ''} onChange={e => updateStay(i, { priceHint: e.target.value ? Number(e.target.value) : null })} /></div>
                  <div><Label className="mb-1 block text-xs text-muted-foreground">Occasion tag</Label><Input value={s.occasion ?? ''} onChange={e => updateStay(i, { occasion: e.target.value || null })} /></div>
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Gallery */}
      <Card>
        <CardHeader><CardTitle className="text-base">Gallery</CardTitle><CardDescription>A mosaic below the story. Pick from the property's images.</CardDescription></CardHeader>
        <CardContent>
          <SortableList
            items={gallery}
            addLabel="Add an image"
            compact
            onReorder={setGallery}
            onRemove={i => setGallery(gallery.filter((_, idx) => idx !== i))}
            onAdd={() => setGallery([...gallery, ''])}
            renderItem={(sp, i) => (
              <div className="flex-1">
                <ImagePicker value={urlOf(sp)} onChange={u => setGallery(gallery.map((g, idx) => (idx === i ? pathOf(u) : g)))} propertyImages={pickerImages} />
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Offer + CTA */}
      <Card>
        <CardHeader><CardTitle className="text-base">Offer &amp; call-to-action</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <MultilingualInput label="Offer strip" value={asMl(cfg.offer?.text)} onChange={v => patch({ offer: { text: v } })} />
          <div className="flex items-center gap-3">
            <Switch checked={cfg.cta?.showBooking !== false} onCheckedChange={c => patch({ cta: { ...cfg.cta, showBooking: c } })} />
            <Label className="text-sm">Show the “Check dates / booking” buttons</Label>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Phone override (optional — defaults to the property phone)</Label>
            <Input value={cfg.cta?.phone ?? ''} onChange={e => patch({ cta: { ...cfg.cta, phone: e.target.value || null } })} placeholder="+40…" className="sm:w-64" />
          </div>
        </CardContent>
      </Card>

      {/* Sticky save bar */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-end gap-3 px-4 py-3">
            <span className="mr-auto text-sm text-muted-foreground">Unsaved changes</span>
            <Button variant="ghost" onClick={onDiscard} disabled={saving}><RotateCcw className="mr-2 h-4 w-4" />Discard</Button>
            <Button onClick={onSave} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save</Button>
          </div>
        </div>
      )}
    </div>
  );
}
