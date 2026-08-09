'use client';
/**
 * Landing pages list + "generate from campaign" control (P3). Row → /admin/landing/{slug} editor.
 * Shapes are redeclared here because the 'use server' actions file can't export types.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, ExternalLink, Pencil, Trash2, Loader2, Megaphone } from 'lucide-react';
import { generateLandingAction, setLandingStatusAction, deleteLandingAction } from '../actions';

type Ml = string | { en?: string; ro?: string };
const ml = (v: Ml | undefined) => (v == null ? '' : typeof v === 'string' ? v : v.ro || v.en || '');

interface LandingRow {
  slug: string; status?: string; campaignRef?: string; defaultLanguage?: string;
  period?: { kind?: string; start?: string | null; end?: string | null; label?: Ml };
  hero?: { headline?: Ml }; updatedAt?: string;
}
interface CampaignOption {
  id: string; status: string; occasionName: string; window: string | null;
  suggestedSlug: string; hasLanding: boolean;
}

export function LandingList({ propertyId, landings, campaigns }: {
  propertyId: string; landings: Array<Record<string, unknown>>; campaigns: CampaignOption[];
}) {
  const rows = landings as unknown as LandingRow[];
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [campaignId, setCampaignId] = useState<string>('');
  const [slug, setSlug] = useState<string>('');

  const onPickCampaign = (id: string) => {
    setCampaignId(id);
    setSlug(campaigns.find(c => c.id === id)?.suggestedSlug ?? '');
  };

  const onGenerate = () => {
    if (!campaignId) { toast({ variant: 'destructive', description: 'Pick a campaign first.' }); return; }
    startTransition(async () => {
      const res = await generateLandingAction(campaignId, slug);
      if (res.ok) { toast({ description: `Draft landing “${res.slug}” created.` }); router.push(`/admin/landing/${res.slug}`); }
      else toast({ variant: 'destructive', description: res.error });
    });
  };

  const onToggleStatus = (row: LandingRow) => {
    const next = row.status === 'published' ? 'draft' : 'published';
    startTransition(async () => {
      const res = await setLandingStatusAction(row.slug, next);
      if (res.ok) { toast({ description: next === 'published' ? 'Published.' : 'Unpublished.' }); router.refresh(); }
      else toast({ variant: 'destructive', description: res.error });
    });
  };

  const onDelete = (row: LandingRow) => {
    if (!window.confirm(`Delete landing “${row.slug}”? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteLandingAction(row.slug);
      if (res.ok) { toast({ description: 'Deleted.' }); router.refresh(); }
      else toast({ variant: 'destructive', description: res.error });
    });
  };

  return (
    <div className="space-y-6">
      {/* Generate from campaign */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4" /> Generate from a campaign</CardTitle>
          <CardDescription>Creates a draft that echoes the ad (same photos + copy) and proposes real, calendar-valid stays. You edit it before publishing.</CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ad campaigns for this property yet. Create one in <Link href={`/admin/ads?propertyId=${propertyId}`} className="underline">Ads</Link> first.</p>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Campaign</label>
                <Select value={campaignId} onValueChange={onPickCampaign}>
                  <SelectTrigger><SelectValue placeholder="Choose a campaign…" /></SelectTrigger>
                  <SelectContent>
                    {campaigns.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.occasionName.slice(0, 48)}{c.window ? ` · ${c.window}` : ''}{c.hasLanding ? ' · (has landing)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:w-56">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Slug (/lp/…)</label>
                <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="autumn-break" />
              </div>
              <Button onClick={onGenerate} disabled={pending || !campaignId}>
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Generate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing landings */}
      <Card>
        <CardHeader><CardTitle className="text-base">Landing pages</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No landing pages yet — generate one above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead><TableHead>Status</TableHead>
                  <TableHead>Window</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => {
                  const lang = row.defaultLanguage || 'ro';
                  return (
                    <TableRow key={row.slug}>
                      <TableCell>
                        <div className="font-medium">{ml(row.hero?.headline) || row.slug}</div>
                        <div className="text-xs text-muted-foreground">/lp/{row.slug} · {ml(row.period?.label)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.status === 'published' ? 'default' : 'secondary'}>{row.status || 'draft'}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.period?.start && row.period?.end ? `${row.period.start} → ${row.period.end}` : (row.period?.kind || '—')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="ghost" size="sm"><Link href={`/admin/landing/${row.slug}`}><Pencil className="h-4 w-4" /></Link></Button>
                          <Button asChild variant="ghost" size="sm"><a href={`/lp/${row.slug}/${lang}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                          <Button variant="ghost" size="sm" disabled={pending} onClick={() => onToggleStatus(row)}>
                            {row.status === 'published' ? 'Unpublish' : 'Publish'}
                          </Button>
                          <Button variant="ghost" size="sm" disabled={pending} onClick={() => onDelete(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
