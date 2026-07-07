'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users } from 'lucide-react';
import { SEGMENT_CATALOG, TEMPLATE_CATALOG } from '@/lib/growth/catalog';
import { previewSegmentAction, createCampaignAction } from '../actions';

export function CampaignComposer({ propertyId }: { propertyId: string }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [segmentKey, setSegmentKey] = useState(SEGMENT_CATALOG[0].key);
  const [templateName, setTemplateName] = useState(TEMPLATE_CATALOG[0].key);
  const [preview, setPreview] = useState<{
    count: number;
    reachable: number;
    suppressed: number;
    ro: number;
    en: number;
  } | null>(null);
  const [previewing, startPreview] = useTransition();
  const [creating, startCreate] = useTransition();

  const runPreview = (key: string) => {
    setPreview(null);
    startPreview(async () => {
      const res = await previewSegmentAction(key, propertyId);
      if (res.success)
        setPreview({
          count: res.count ?? 0,
          reachable: res.reachable ?? 0,
          suppressed: res.suppressed ?? 0,
          ro: res.ro ?? 0,
          en: res.en ?? 0,
        });
      else toast({ title: 'Preview failed', description: res.error, variant: 'destructive' });
    });
  };

  // Preview the default segment on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { runPreview(segmentKey); }, [propertyId]);

  const onSegmentChange = (key: string) => {
    setSegmentKey(key);
    runPreview(key);
  };

  const create = () =>
    startCreate(async () => {
      const res = await createCampaignAction({ name, propertyId, segmentKey, templateName });
      if (res.success) {
        toast({ title: 'Campaign created', description: 'Saved as draft. Approve, then run (dry-run).' });
        setName('');
      } else {
        toast({ title: 'Create failed', description: res.error, variant: 'destructive' });
      }
    });

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>New campaign</CardTitle>
        <CardDescription>Pick an audience and a message. Nothing sends — dry-run only.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="campaign-name">Name</Label>
          <Input
            id="campaign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Winter reactivation"
          />
        </div>

        <div className="space-y-2">
          <Label>Audience</Label>
          <Select value={segmentKey} onValueChange={onSegmentChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEGMENT_CATALOG.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex min-h-[46px] items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
            {previewing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Counting…
              </>
            ) : preview ? (
              <>
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  <strong>{preview.reachable}</strong> reachable
                  {preview.suppressed > 0 ? ` (${preview.suppressed} opted out)` : ''}
                  {' · '}
                  <strong>{preview.ro}</strong> RO / <strong>{preview.en}</strong> EN
                  {' · '}
                  <span className="text-muted-foreground">{preview.count} total</span>
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Select an audience to preview the count.</span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Message template</Label>
          <Select value={templateName} onValueChange={setTemplateName}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_CATALOG.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={create} disabled={creating || !name.trim()} className="w-full">
          {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create campaign
        </Button>
      </CardFooter>
    </Card>
  );
}
