'use client';

/**
 * Generate an ad from an OPPORTUNITY (framing → generate). The operator gives the window + occasion;
 * the intelligence chain (plan → creative) drafts a PAUSED, zero-spend ad, and the next screen is
 * the review. This is the ads-side analog of the campaigns framing/proposal flow — the operator
 * shapes the substance (which window, which occasion), the AI does the geo + budget + copy + photos.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { generateAdProposalAction } from '../actions';

export function GenerateForm({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [occasion, setOccasion] = useState('');
  const [goal, setGoal] = useState('');
  const [audience, setAudience] = useState('');
  const [value, setValue] = useState('');
  const [declined, setDeclined] = useState<string | null>(null);

  const generate = () => {
    if (!startDate || !endDate) {
      toast({ title: 'Pick the window', description: 'Both start and end dates are required.', variant: 'destructive' });
      return;
    }
    if (Date.parse(endDate) <= Date.parse(startDate)) {
      toast({ title: 'Check the dates', description: 'End must be after start.', variant: 'destructive' });
      return;
    }
    setDeclined(null);
    start(async () => {
      const res = await generateAdProposalAction({
        propertyId,
        start: startDate,
        end: endDate,
        occasion: occasion.trim() || undefined,
        goal: goal.trim() || undefined,
        audience: audience.trim() || undefined,
        valueAtRisk: value ? Number(value) : undefined,
      });
      if (!res.ok) {
        toast({ title: 'Could not generate', description: `${res.stage ? `[${res.stage}] ` : ''}${res.error}`, variant: 'destructive' });
        return;
      }
      if ('declined' in res) {
        setDeclined(res.rationale);
        return;
      }
      toast({ title: 'Draft created', description: 'PAUSED on Meta, zero spend. Review and approve it next.' });
      router.push(`/admin/ads/${res.adCampaignId}`);
    });
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          Generate from an opportunity
        </CardTitle>
        <CardDescription>
          Give the window and the occasion. The engine plans the geo + budget, writes the copy, and picks photos from
          this property&apos;s gallery — then drops a PAUSED, zero-spend draft you review and approve. Nothing spends.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="start">Window start</Label>
            <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="end">Window end</Label>
            <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="occasion">Occasion (optional but strong)</Label>
          <Textarea
            id="occasion"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            rows={2}
            placeholder="e.g. Autumn school break — a family week in the mountains before winter"
          />
          <p className="text-xs text-muted-foreground">
            A real reason to come now. With no occasion the planner may decline — an ad with nothing to say wastes spend.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="goal">Goal — the outcome you want (optional)</Label>
          <Textarea
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            placeholder="e.g. Fill these nights with high-margin DIRECT bookings — quality over volume"
          />
          <p className="text-xs text-muted-foreground">Shapes the whole ad — angle, budget posture, and the call to action.</p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="audience">Audience — who it&apos;s for (optional)</Label>
          <Textarea
            id="audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            rows={2}
            placeholder="e.g. Adult couples wanting a quiet off-peak weekend — food, fire, no crowds"
          />
          <p className="text-xs text-muted-foreground">
            Steers the copy angle and which photos are picked (not Meta targeting — Advantage+ handles that).
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="value">Revenue at risk (RON, optional)</Label>
          <Input id="value" type="number" min={0} step="1" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 6000" />
          <p className="text-xs text-muted-foreground">Nights × rate for this window, if known — it caps the spend envelope.</p>
        </div>

        {declined && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="mb-1 flex items-center gap-1 font-medium">
              <AlertCircle className="h-4 w-4" /> The planner declined — no draft was created
            </p>
            <p className="text-amber-800">{declined}</p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={generate} disabled={pending}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Generate draft
        </Button>
      </CardFooter>
    </Card>
  );
}
