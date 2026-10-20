'use client';

import { MultilingualInput } from '../multilingual-input';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { DEFAULT_BADGE_TEXT, type AutoBadgeKind } from '@/lib/website/openStays';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

type Ml = string | Record<string, string>;
type Pin = { start: string; text: Ml };

const BADGES: { kind: AutoBadgeKind; label: string; hint: string }[] = [
  { kind: 'lastFree', label: 'Last free weekend of a month', hint: 'Shown when a month has one free weekend left. {month} is filled in.' },
  { kind: 'highDemand', label: 'High demand', hint: 'On the stay most searched on the booking page in the last 14 days.' },
  { kind: 'bestPrice', label: 'Best price', hint: 'Only when one stay is at least 15% cheaper per night than the next.' },
];

const num = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Math.floor(Number(v)) || 0));

/**
 * Settings for the free periods widget. The rows themselves are never typed here: they come from the
 * live calendar and prices. What the owner sets is where it shows, how many rows, and the badges.
 */
export function OpenStaysForm({ content, onChange }: BlockFormProps) {
  const badges = (content.badges as Partial<Record<AutoBadgeKind, Ml | false>>) || {};
  const pinned = (content.pinned as Pin[]) || [];

  const setBadge = (kind: AutoBadgeKind, value: Ml | false | undefined) => {
    const next = { ...badges, [kind]: value };
    if (value === undefined) delete next[kind];
    onChange({ ...content, badges: Object.keys(next).length ? next : undefined });
  };
  const setPinned = (next: Pin[]) => onChange({ ...content, pinned: next.length ? next : undefined });

  return (
    <div className="space-y-6">
      <div>
        <Label>Look</Label>
        <Select value={(content.variant as string) || 'section'} onValueChange={(v) => onChange({ ...content, variant: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="section">Section (homepage)</SelectItem>
            <SelectItem value="inline">Slim box (gallery, details)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <MultilingualInput
        label="Heading (empty = Free dates coming up / Date libere în curând)"
        value={content.title as Ml | undefined}
        onChange={(v) => onChange({ ...content, title: v })}
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Rows</Label>
          <Input type="number" min={1} max={8} placeholder="4" value={(content.maxRows as number) ?? ''}
            onChange={(e) => onChange({ ...content, maxRows: num(e.target.value) })} />
        </div>
        <div>
          <Label>Days ahead</Label>
          <Input type="number" min={14} max={180} placeholder="75" value={(content.horizonDays as number) ?? ''}
            onChange={(e) => onChange({ ...content, horizonDays: num(e.target.value) })} />
        </div>
      </div>

      <div>
        <Label>Between gallery photos: after photo number</Label>
        <Input type="number" min={0} placeholder="0 = own place on the page" value={(content.galleryAfter as number) ?? ''}
          onChange={(e) => onChange({ ...content, galleryAfter: num(e.target.value) })} />
        <p className="mt-1 text-xs text-muted-foreground">Only on a page with a photo grid.</p>
      </div>

      <div className="space-y-4">
        <Label className="text-base">Automatic badges (at most two per block)</Label>
        {BADGES.map(({ kind, label, hint }) => {
          const value = badges[kind];
          const on = value !== false;
          return (
            <div key={kind} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch checked={on} onCheckedChange={(c) => setBadge(kind, c ? undefined : false)} />
              </div>
              <p className="text-xs text-muted-foreground">{hint}</p>
              {on && (
                <MultilingualInput
                  label={`Wording (empty = ${DEFAULT_BADGE_TEXT[kind].en} / ${DEFAULT_BADGE_TEXT[kind].ro})`}
                  value={(value as Ml | undefined) ?? undefined}
                  onChange={(v) => setBadge(kind, v)}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <Label className="text-base">Your own badges</Label>
        <p className="text-xs text-muted-foreground">Shown on the stay that starts on this date, when it is in the list. They win over the automatic ones.</p>
        {pinned.map((p, i) => (
          <div key={i} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Input type="date" value={p.start} onChange={(e) => setPinned(pinned.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon" onClick={() => setPinned(pinned.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            </div>
            <MultilingualInput label="Text" value={p.text} onChange={(v) => setPinned(pinned.map((x, j) => (j === i ? { ...x, text: v } : x)))} />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setPinned([...pinned, { start: '', text: { en: '', ro: '' } }])}>
          <Plus className="mr-1 h-4 w-4" />Add badge
        </Button>
      </div>
    </div>
  );
}
