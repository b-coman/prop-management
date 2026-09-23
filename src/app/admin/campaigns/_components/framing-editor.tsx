'use client';

/**
 * Gate 0 — the campaign FRAMING editor (the owner's hand on the campaign idea).
 *
 * The owner edits WHAT the campaign says — the occasion, the offer, the news to announce, the angle
 * — then hits "Save & regenerate", which runs the in-app copywriter to rewrite every per-guest
 * message from the edited framing. The copywriter adapts (voice, per-guest history, channel, which
 * news applies); the owner shapes the substance here, once, instead of editing 14 messages.
 *
 * Optional MASTER MESSAGE: draft one message from the framing, edit it until it reads right, and
 * "Save & personalise" rewrites THAT text per guest (greeting, tu/voi, their history) instead of
 * writing each message from the angle. Empty master = the old behaviour.
 */
import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, Plus, X, AlertCircle, FileText, Save } from 'lucide-react';
import { generateMessagesAction, draftMasterMessageAction, saveFramingAction } from '../actions';
import type { CampaignProposal, CampaignOffer, CampaignUpdate, CampaignOfferType } from '@/lib/growth/contracts';

type OfferType = NonNullable<CampaignOfferType>;

export function FramingEditor({
  campaignId,
  proposal,
  copywriterAvailable,
  onRegenerated,
}: {
  campaignId: string;
  proposal: CampaignProposal;
  copywriterAvailable: boolean;
  onRegenerated: () => void;
}) {
  const { toast } = useToast();
  const [busy, startGen] = useTransition();

  const [point, setPoint] = useState(proposal.occasion?.point ?? '');
  const [occasionName, setOccasionName] = useState(proposal.occasion?.name ?? '');
  const [generalAngle, setGeneralAngle] = useState(proposal.generalAngle ?? '');
  const [offerType, setOfferType] = useState<OfferType>((proposal.offer?.type as OfferType) ?? (proposal.offer?.discountPct != null ? 'percent' : 'none'));
  const [discountPct, setDiscountPct] = useState(String(proposal.offer?.discountPct ?? ''));
  const [freeNightAfter, setFreeNightAfter] = useState(String(proposal.offer?.freeNightAfter ?? ''));
  const [amount, setAmount] = useState(String(proposal.offer?.amount ?? ''));
  const [offerDesc, setOfferDesc] = useState(proposal.offer?.description ?? '');
  const [updates, setUpdates] = useState<CampaignUpdate[]>(proposal.updates ?? []);
  const [errors, setErrors] = useState<string[]>([]);
  const [masterMessage, setMasterMessage] = useState(proposal.masterMessage ?? '');
  const [masterNote, setMasterNote] = useState<string[]>([]);
  const [drafting, startDraft] = useTransition();
  const [saving, startSave] = useTransition();

  const buildOffer = (): CampaignOffer => {
    const base = { type: offerType, description: offerDesc } as CampaignOffer;
    if (offerType === 'percent') base.discountPct = discountPct ? Number(discountPct) : null;
    if (offerType === 'free_night') base.freeNightAfter = freeNightAfter ? Number(freeNightAfter) : undefined;
    if (offerType === 'fixed') base.amount = amount ? Number(amount) : undefined;
    return base;
  };

  const setUpdate = (i: number, patch: Partial<CampaignUpdate>) =>
    setUpdates((prev) => prev.map((u, idx) => (idx === i ? { ...u, ...patch } : u)));
  const addUpdate = () => setUpdates((prev) => [...prev, { id: `u${prev.length + 1}`, text: '', effectiveDate: '' }]);
  const removeUpdate = (i: number) => setUpdates((prev) => prev.filter((_, idx) => idx !== i));

  const currentFraming = () => ({
    occasion: { name: occasionName || null, point },
    offer: buildOffer(),
    updates: updates.filter((u) => u.text.trim() && u.effectiveDate.trim()),
    generalAngle,
  });

  const draftMaster = () =>
    startDraft(async () => {
      setMasterNote([]);
      try {
        const res = await draftMasterMessageAction(campaignId, currentFraming());
        if (res.success && res.body) {
          setMasterMessage(res.body);
          setMasterNote([...(res.errors ?? []), ...(res.warnings ?? []), ...(res.notes ? [res.notes] : [])]);
          toast({ title: 'Master message drafted and saved', description: 'Edit it, then Save, or personalise when it reads right.' });
        } else {
          toast({ title: 'Could not draft', description: res.error ?? res.errors?.join('; '), variant: 'destructive' });
        }
      } catch (e) {
        toast({ title: 'Could not draft', description: (e as Error)?.message || 'Unexpected error', variant: 'destructive' });
      }
    });

  const save = () =>
    startSave(async () => {
      try {
        const res = await saveFramingAction(campaignId, { ...currentFraming(), masterMessage: masterMessage.trim() });
        if (res.success) toast({ title: 'Saved', description: 'Framing and master message saved. No guest messages were written.' });
        else toast({ title: 'Could not save', description: res.error, variant: 'destructive' });
      } catch (e) {
        toast({ title: 'Could not save', description: (e as Error)?.message || 'Unexpected error', variant: 'destructive' });
      }
    });

  const regenerate = () =>
    startGen(async () => {
      setErrors([]);
      try {
        const res = await generateMessagesAction(campaignId, { ...currentFraming(), masterMessage: masterMessage.trim() });
        if (res.success && res.ok) {
          toast({ title: `Wrote ${res.count ?? 0} messages`, description: 'Review them below, then approve to queue.' });
          onRegenerated();
        } else if (res.success && !res.ok) {
          setErrors(res.errors ?? ['The copywriter output failed validation.']);
          toast({
            title: res.count ? `Wrote ${res.count} messages, some failed` : 'Generation rejected',
            description: res.count ? 'Guests listed below kept their previous message.' : 'No message passed the checks. Nothing was changed.',
            variant: 'destructive',
          });
          if (res.count) onRegenerated();
        } else {
          toast({ title: 'Could not generate', description: res.error, variant: 'destructive' });
        }
      } catch (e) {
        // Never let a rejection bubble to the root error boundary — show it inline.
        toast({ title: 'Could not generate', description: (e as Error)?.message || 'Unexpected error', variant: 'destructive' });
      }
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign framing</CardTitle>
        <CardDescription>
          Shape the idea here — occasion, offer, and any news to announce. Hit “Save &amp; regenerate” and the
          copywriter rewrites every message in your voice, adapting the offer and news per guest.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs">Occasion — what &amp; why now</Label>
          <Input value={occasionName} onChange={(e) => setOccasionName(e.target.value)} placeholder="e.g. Quiet September escape" className="mb-1" />
          <Textarea value={point} onChange={(e) => setPoint(e.target.value)} rows={2} placeholder="One or two lines the copywriter anchors on." />
        </div>

        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <div className="space-y-1">
            <Label className="text-xs">Offer</Label>
            <select
              value={offerType}
              onChange={(e) => setOfferType(e.target.value as OfferType)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="none">No discount (first-pick)</option>
              <option value="percent">Percent off</option>
              <option value="free_night">Free night</option>
              <option value="fixed">Fixed amount off</option>
            </select>
            {offerType === 'percent' && (
              <Input value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} placeholder="% e.g. 10" inputMode="numeric" />
            )}
            {offerType === 'free_night' && (
              <Input value={freeNightAfter} onChange={(e) => setFreeNightAfter(e.target.value)} placeholder="free after N nights, e.g. 3" inputMode="numeric" />
            )}
            {offerType === 'fixed' && (
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="RON off, e.g. 200" inputMode="numeric" />
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Offer wording (the copywriter may adapt it per guest)</Label>
            <Textarea value={offerDesc} onChange={(e) => setOfferDesc(e.target.value)} rows={2} placeholder="e.g. acces prioritar: le spun inainte sa promovez datele altundeva" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">News to announce (only reaches guests who last stayed before each date)</Label>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={addUpdate}><Plus className="mr-1 h-3.5 w-3.5" /> Add</Button>
          </div>
          {updates.length === 0 && <p className="text-xs text-muted-foreground">No news — the copywriter won’t announce anything new.</p>}
          {updates.map((u, i) => (
            <div key={i} className="flex items-start gap-2">
              <Textarea value={u.text} onChange={(e) => setUpdate(i, { text: e.target.value })} rows={2} placeholder="e.g. am pus un ciubar cu apa calda afara" className="flex-1 text-sm" />
              <div className="flex flex-col gap-1">
                <Input type="date" value={u.effectiveDate} onChange={(e) => setUpdate(i, { effectiveDate: e.target.value })} className="w-40 text-xs" />
                <Button size="icon" variant="ghost" className="h-7 w-7 self-end" onClick={() => removeUpdate(i)} aria-label="Remove"><X className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Angle (guidance for the copywriter — not sent to guests)</Label>
          <Textarea value={generalAngle} onChange={(e) => setGeneralAngle(e.target.value)} rows={2} />
        </div>

        <div className="space-y-1 rounded-md border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="flex items-center gap-1 text-xs"><FileText className="h-3.5 w-3.5" /> Master message (optional)</Label>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={draftMaster} disabled={drafting || busy || !copywriterAvailable}>
              {drafting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1 h-3.5 w-3.5" />}
              {masterMessage.trim() ? 'Redraft from framing' : 'Draft from framing'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Write or draft one message and edit it until it reads right. Each guest then gets this message adapted to them:
            their name, tu or voi, your past conversation, and anything that doesn&apos;t fit them. Leave it empty to write each
            message from the angle instead.
          </p>
          <Textarea value={masterMessage} onChange={(e) => setMasterMessage(e.target.value)} rows={7} className="bg-background text-sm" placeholder="Buna! ..." />
          {masterNote.length > 0 && (
            <ul className="space-y-0.5 text-xs text-amber-700">{masterNote.map((n, i) => <li key={i}>• {n}</li>)}</ul>
          )}
        </div>

        {errors.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
            <p className="mb-1 flex items-center gap-1 font-medium"><AlertCircle className="h-3.5 w-3.5" /> These guests failed the checks and kept their previous message:</p>
            <ul className="space-y-0.5">{errors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
          </div>
        )}

        <div className="flex items-center gap-3 border-t pt-3">
          <Button variant="outline" onClick={save} disabled={saving || busy || drafting}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Save
          </Button>
          <Button onClick={regenerate} disabled={busy || drafting || saving || !copywriterAvailable}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
            {masterMessage.trim() ? 'Save & personalise for each guest' : 'Save & write each message'}
          </Button>
          {!copywriterAvailable && <span className="text-xs text-muted-foreground">Copywriter unavailable — ANTHROPIC_API_KEY not set.</span>}
          {busy && <span className="text-xs text-muted-foreground">Writing one message per guest, about 2-3 minutes for 20…</span>}
        </div>
      </CardContent>
    </Card>
  );
}
