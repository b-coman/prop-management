'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Loader2, ExternalLink, RefreshCw, Ban, Rocket, Sparkles, Trash2, MapPin, Send, Save } from 'lucide-react';
import type { AdCampaign, CopyVariant } from '@/types';
import {
  approveAdAction,
  activateAdAction,
  pauseAdAction,
  refreshAdInsightsAction,
  discardAdDraftAction,
  pushAdToMetaAction,
  updateAdDraftAction,
} from '../actions';

/**
 * A server-action reference baked into a page older than the running deployment no longer resolves on
 * the server: Next returns an empty payload, so the client receives `undefined` rather than a rejected
 * promise. Reading `.ok` / `.status` / `.success` on that throws, and the error boundary takes down the
 * entire console — which is how deploying mid-edit looked like data loss. It never is: the action did
 * not execute at all, so nothing was written. Guard every call site, not just the editable ones — push,
 * approve, activate and pause fail the same way, and those are money paths.
 */
function isStaleAction(
  res: unknown,
  toast: ReturnType<typeof useToast>['toast'],
): res is null | undefined {
  if (res != null) return false;
  toast({
    title: 'Page is out of date',
    description:
      'This page was loaded before the last deploy, so the server no longer recognises the action. Nothing was changed — reload the page and try again.',
    variant: 'destructive',
  });
  return true;
}

/**
 * The AI proposal (copy + photos + geo + rationale) shown for in-console review. While the campaign is
 * a Firestore-only `draft` (nothing on Meta yet) the copy + daily budget are EDITABLE — what you save
 * here is exactly what Push sends to Meta. Once pushed, it renders read-only.
 */
function ProposalCard({
  proposal,
  editable,
  adCampaignId,
  dailyBudgetMinor,
}: {
  proposal: NonNullable<AdCampaign['proposal']>;
  editable: boolean;
  adCampaignId: string;
  dailyBudgetMinor?: number;
}) {
  const { toast } = useToast();
  const router = useRouter();

  const [saving, startSave] = useTransition();
  const [copy, setCopy] = useState<CopyVariant[]>(proposal.copy);
  const [budgetRon, setBudgetRon] = useState(((dailyBudgetMinor ?? 0) / 100).toFixed(0));

  const dirty =
    editable &&
    (JSON.stringify(copy) !== JSON.stringify(proposal.copy) ||
      Math.round(Number(budgetRon) * 100) !== (dailyBudgetMinor ?? 0));

  const patchVariant = (i: number, field: 'headline' | 'primary', value: string) =>
    setCopy((prev) => prev.map((v, idx) => (idx === i ? { ...v, [field]: value } : v)));
  const removeVariant = (i: number) => setCopy((prev) => prev.filter((_, idx) => idx !== i));

  const save = () =>
    startSave(async () => {
      const dailyMinor = Math.round(Number(budgetRon) * 100);
      const res = await updateAdDraftAction(adCampaignId, { copy, dailyBudgetMinor: dailyMinor });
      if (isStaleAction(res, toast)) return;
      if (res.ok) {
        toast({ title: 'Draft updated', description: 'Your edits are what Push will send to Meta.' });
        router.refresh();
      } else {
        toast({ title: 'Could not save', description: res.error, variant: 'destructive' });
      }
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          Proposal
          <Badge variant="secondary" className="text-[10px]">Opportunity Engine</Badge>
          {editable && <Badge variant="outline" className="text-[10px] text-emerald-700">editable</Badge>}
        </CardTitle>
        {proposal.occasion && (
          <CardDescription>
            {proposal.occasion.name ? `${proposal.occasion.name} · ` : ''}
            {proposal.occasion.start} → {proposal.occasion.end} ({proposal.occasion.nights}n)
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {(proposal.goal || proposal.audience) && (
          <div className="space-y-1 rounded-md border bg-muted/30 p-2 text-xs">
            {proposal.goal && (
              <p>
                <span className="font-medium text-foreground">Goal: </span>
                <span className="text-muted-foreground">{proposal.goal}</span>
              </p>
            )}
            {proposal.audience && (
              <p>
                <span className="font-medium text-foreground">Audience: </span>
                <span className="text-muted-foreground">{proposal.audience}</span>
              </p>
            )}
          </div>
        )}

        {editable && (
          <div className="flex items-center gap-2">
            <Label htmlFor="daily-budget" className="text-xs text-muted-foreground">Daily budget (RON)</Label>
            <Input
              id="daily-budget"
              type="number"
              min={1}
              step="1"
              value={budgetRon}
              onChange={(e) => setBudgetRon(e.target.value)}
              className="h-8 w-24"
            />
          </div>
        )}

        {proposal.cities.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            {proposal.cities.map((c) => (
              <Badge key={c.name} variant="outline" className="text-[11px]">
                {c.name} · {c.radius}km
              </Badge>
            ))}
            {editable && <span className="text-[10px] text-muted-foreground">(geo edits: discard &amp; regenerate for now)</span>}
          </div>
        )}
        {proposal.photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {proposal.photos.map((p) => (
              <div key={p.storagePath} className="relative aspect-square overflow-hidden rounded-md border">
                {p.url ? (
                  <Image src={p.url} alt="" fill className="object-cover" sizes="120px" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">no preview</div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Copy variants ({copy.length})</p>
          {copy.map((v, i) =>
            editable ? (
              <div key={i} className="space-y-1 rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={v.headline ?? ''}
                    onChange={(e) => patchVariant(i, 'headline', e.target.value)}
                    placeholder="Headline"
                    className="h-8 text-xs font-medium"
                  />
                  {copy.length > 1 && (
                    <Button size="sm" variant="ghost" className="h-8 shrink-0 px-2 text-destructive" onClick={() => removeVariant(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <Textarea
                  value={v.primary}
                  onChange={(e) => patchVariant(i, 'primary', e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <p className="text-[10px] uppercase text-muted-foreground">{v.cta}</p>
              </div>
            ) : (
              <div key={i} className="rounded-md border p-2">
                {v.headline && <p className="text-xs font-medium">{v.headline}</p>}
                <p className="text-sm">{v.primary}</p>
                <p className="mt-1 text-[10px] uppercase text-muted-foreground">{v.cta}</p>
              </div>
            )
          )}
          {editable && (
            <Button size="sm" onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
              Save changes
            </Button>
          )}
        </div>

        {proposal.creativeBrief && (
          <details className="rounded-md border bg-muted/30 p-2">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Creative brief &amp; rationale</summary>
            <p className="mt-2 text-xs text-muted-foreground">{proposal.creativeBrief}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Why: </span>
              {proposal.rationale}
            </p>
          </details>
        )}

        {(proposal.assetGaps?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-amber-700">
              Missing shots the AI wanted ({proposal.assetGaps!.length}) — generate these &amp; upload, and they self-describe
            </p>
            {proposal.assetGaps!.map((g, i) => (
              <div key={i} className="rounded-md border border-amber-200 bg-amber-50/40 p-2 text-xs">
                <p className="font-medium">
                  {g.need}
                  <Badge variant="outline" className="ml-1 text-[10px]">{g.transform}</Badge>
                </p>
                <p className="mt-0.5 text-muted-foreground">{g.whyInsufficient}</p>
                <div className="mt-2 flex items-start gap-2">
                  {g.nearestAssetUrl && (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border" title="Edit this base photo">
                      <Image src={g.nearestAssetUrl} alt="" fill className="object-cover" sizes="56px" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-[10px] text-muted-foreground">Paste into your image-AI, using the photo on the left as the base:</p>
                    <code className="block whitespace-pre-wrap rounded bg-muted p-1.5 text-[10px] leading-snug">{g.generationPrompt}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 h-6 text-[10px]"
                      onClick={() => {
                        void navigator.clipboard?.writeText(g.generationPrompt);
                        toast({ title: 'Prompt copied' });
                      }}
                    >
                      Copy prompt
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  pushed: 'secondary',
  pending_approval: 'secondary',
  approved: 'secondary',
  active: 'default',
  paused: 'outline',
  failed: 'destructive',
};

const PROBLEM_EFFECTIVE_STATUSES = new Set(['DISAPPROVED', 'REJECTED', 'WITH_ISSUES', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED']);

const STATUS_HELP: Record<string, string> = {
  draft: 'Nothing is on Meta yet. Review and adjust the copy/budget, then Push to Meta.',
  pushed: 'On Meta as PAUSED (zero spend) — Meta is reviewing the creative. Go live is the only step that spends.',
  approved: 'Spend cap set. Activate to start delivery (spends only when the engine is in live mode).',
  active: 'Delivering on Meta. Pause to stop spend immediately.',
  paused: 'Paused on Meta — no spend.',
  failed: 'Something went wrong creating this on Meta. Discard and regenerate.',
};

function formatMinor(minor: number | undefined): string {
  if (minor === undefined || minor === null) return '—';
  return `${(minor / 100).toFixed(2)} RON`;
}

/** Mirrors `validateApprovalCap`'s own day-count so the operator sees the SAME projection the server will check against — display only, never trusted for the actual gate. */
function daysToEndTime(endTime: string | undefined): number | null {
  if (!endTime) return null;
  const endMs = Date.parse(endTime);
  if (Number.isNaN(endMs)) return null;
  const days = Math.ceil((endMs - Date.now()) / (24 * 60 * 60 * 1000));
  return days > 0 ? days : null;
}

export function AdDetailPanel({ campaign }: { campaign: AdCampaign & { adsManagerUrl?: string } }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pushing, startPush] = useTransition();
  const [goingLive, startGoLive] = useTransition();
  const [activating, startActivate] = useTransition();
  const [pausing, startPause] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [discarding, startDiscard] = useTransition();
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [spendCapRon, setSpendCapRon] = useState('50');

  const days = daysToEndTime(campaign.endTime);
  const projectedSpendMinor =
    days && campaign.dailyBudgetMinor ? Math.round(campaign.dailyBudgetMinor * days * 1.25) : undefined;

  const pushToMeta = () => {
    startPush(async () => {
      const res = await pushAdToMetaAction(campaign.id);
      if (isStaleAction(res, toast)) return;
      if (res.ok) {
        toast({ title: 'Pushed to Meta (PAUSED)', description: 'Zero spend. Meta will review the creative and email you — that email is expected now.' });
        router.push(`/admin/ads/${res.adCampaignId}`);
      } else {
        toast({ title: 'Push failed', description: `${res.error}${res.stage ? ` (${res.stage})` : ''}`, variant: 'destructive' });
      }
    });
  };

  // Go live = approve (set spend cap) then activate, in one operator step. Activation only spends when
  // both engine switches are on; otherwise it reports a dry-run and the cap is still saved.
  const goLive = () => {
    const spendCapMinor = Math.round(Number(spendCapRon) * 100);
    if (!Number.isFinite(spendCapMinor) || spendCapMinor <= 0) {
      toast({ title: 'Invalid spend cap', variant: 'destructive' });
      return;
    }
    startGoLive(async () => {
      const ap = await approveAdAction(campaign.id, spendCapMinor);
      if (isStaleAction(ap, toast)) return;
      if (!ap.ok) {
        toast({ title: 'Go live blocked at approval', description: ap.error, variant: 'destructive' });
        return;
      }
      const res = await activateAdAction(campaign.id);
      if (isStaleAction(res, toast)) return;
      if (res.status === 'activated') {
        toast({ title: 'Live', description: `Meta is serving this ad, capped at ${spendCapRon} RON.` });
      } else if (res.status === 'dry-run') {
        toast({ title: 'Approved · dry-run', description: 'Spend cap saved, but GROWTH_ADS_MODE is not live yet — nothing spends until the engine is switched to live.' });
      } else {
        toast({ title: 'Approved, activation rejected', description: res.reason, variant: 'destructive' });
      }
      setGoLiveOpen(false);
      router.refresh();
    });
  };

  const activate = () => {
    startActivate(async () => {
      const res = await activateAdAction(campaign.id);
      if (isStaleAction(res, toast)) return;
      if (res.status === 'activated') {
        toast({ title: 'Activated', description: 'Meta is now serving this ad.' });
      } else if (res.status === 'dry-run') {
        toast({ title: 'Dry-run', description: 'GROWTH_ADS_MODE is not live — no Meta call was made.' });
      } else {
        toast({ title: 'Rejected', description: res.reason, variant: 'destructive' });
      }
      router.refresh();
    });
  };

  const pause = () => {
    startPause(async () => {
      const res = await pauseAdAction(campaign.id);
      if (isStaleAction(res, toast)) return;
      if (res.success) {
        toast({ title: 'Paused' });
      } else {
        toast({ title: 'Pause failed', description: res.error, variant: 'destructive' });
      }
      router.refresh();
    });
  };

  const discard = () => {
    startDiscard(async () => {
      const res = await discardAdDraftAction(campaign.id);
      if (isStaleAction(res, toast)) return;
      if (res.ok) {
        toast({ title: 'Discarded' });
        router.push('/admin/ads');
      } else {
        toast({ title: 'Could not discard', description: res.error, variant: 'destructive' });
      }
    });
  };

  const refresh = () => {
    startRefresh(async () => {
      const res = await refreshAdInsightsAction(campaign.id);
      if (isStaleAction(res, toast)) return;
      if (res.ok) {
        toast({
          title: 'Insights refreshed',
          description: `ROAS ${res.insights.roas.toFixed(2)} · spend ${res.insights.spend.toFixed(2)}${
            res.effectiveStatus ? ` · ${res.effectiveStatus}` : ''
          }`,
        });
      } else {
        toast({ title: 'Refresh failed', description: res.error, variant: 'destructive' });
      }
      router.refresh();
    });
  };

  const canDiscard = campaign.status === 'draft' || campaign.status === 'pushed' || campaign.status === 'failed';

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {campaign.proposal && (
          <ProposalCard
            proposal={campaign.proposal}
            // Not editable while the chain is still running: it finishes with a whole-document write,
            // so anything typed in the meantime would be silently overwritten.
            editable={campaign.status === 'draft' && !campaign.generating}
            adCampaignId={campaign.id}
            dailyBudgetMinor={campaign.dailyBudgetMinor}
          />
        )}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Campaign
              <Badge variant={STATUS_VARIANT[campaign.status] || 'outline'}>{campaign.status}</Badge>
              {campaign.effectiveStatus && PROBLEM_EFFECTIVE_STATUSES.has(campaign.effectiveStatus) && (
                <Badge variant="destructive">{campaign.effectiveStatus}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              {campaign.status === 'draft'
                ? 'Firestore draft — no Meta campaign exists yet'
                : campaign.metaCampaignId ?? 'No Meta campaign id recorded'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-y-2">
              <dt className="text-muted-foreground">Objective</dt>
              <dd>{campaign.objective ?? '—'}</dd>
              <dt className="text-muted-foreground">Daily budget</dt>
              <dd>{formatMinor(campaign.dailyBudgetMinor)}</dd>
              <dt className="text-muted-foreground">Spend cap</dt>
              <dd>{formatMinor(campaign.spendCapMinor)}</dd>
              <dt className="text-muted-foreground">End time</dt>
              <dd>{campaign.endTime ? new Date(campaign.endTime).toLocaleString() : '—'}</dd>
              <dt className="text-muted-foreground">Approved by</dt>
              <dd>{campaign.approvedBy ?? '—'}</dd>
              <dt className="text-muted-foreground">Effective status</dt>
              <dd>{campaign.effectiveStatus ?? 'not synced yet'}</dd>
            </dl>

            {campaign.insights && (
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="font-medium mb-1">Insights</p>
                <dl className="grid grid-cols-2 gap-y-1">
                  <dt className="text-muted-foreground">Spend</dt>
                  <dd>{campaign.insights.spend.toFixed(2)} RON</dd>
                  <dt className="text-muted-foreground">Impressions</dt>
                  <dd>{campaign.insights.impressions}</dd>
                  <dt className="text-muted-foreground">Clicks</dt>
                  <dd>{campaign.insights.clicks}</dd>
                  <dt className="text-muted-foreground">Bookings</dt>
                  <dd>{campaign.insights.bookings ?? 0}</dd>
                  <dt className="text-muted-foreground">ROAS</dt>
                  <dd>{campaign.insights.roas?.toFixed(2) ?? '—'}</dd>
                </dl>
              </div>
            )}

            {campaign.adsManagerUrl && (
              <a
                href={campaign.adsManagerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Open in Ads Manager <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </CardContent>
          {campaign.status !== 'draft' && (
            <CardFooter>
              <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
                {refreshing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                Refresh insights
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>{STATUS_HELP[campaign.status] ?? ''}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* DRAFT (Firestore only) → Push to Meta */}
          {campaign.status === 'draft' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" disabled={pushing}>
                  {pushing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                  Push to Meta
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Push this draft to Meta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This creates the campaign on Meta as <strong>PAUSED (zero spend)</strong>. Meta will review the creative
                    and send you a &ldquo;your ad was approved&rdquo; email — that email is expected at this step and does not
                    mean anything is spending. Nothing spends until you press <strong>Go live</strong>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={pushing}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={pushToMeta} disabled={pushing}>
                    {pushing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Push to Meta
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* PUSHED (PAUSED on Meta) → Go live (approve cap + activate) */}
          {campaign.status === 'pushed' && (
            <Dialog open={goLiveOpen} onOpenChange={setGoLiveOpen}>
              <DialogTrigger asChild>
                <Button className="w-full" disabled={goingLive}>
                  {goingLive ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Rocket className="mr-1 h-4 w-4" />}
                  Go live
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Go live</DialogTitle>
                  <DialogDescription>
                    Sets a spend cap and un-pauses the campaign on Meta. The cap is rejected unless{' '}
                    <code>dailyBudget × days-to-end-time × 1.25 ≤ spendCap</code>. Real spend happens only when the engine is
                    in live mode; otherwise the cap is saved and delivery stays a dry-run.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="spend-cap">Spend cap (RON)</Label>
                  <Input id="spend-cap" type="number" min={1} step="0.01" value={spendCapRon} onChange={(e) => setSpendCapRon(e.target.value)} />
                  {days !== null && projectedSpendMinor !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      Projected: {formatMinor(campaign.dailyBudgetMinor)}/day × {days} day{days === 1 ? '' : 's'} × 1.25 ={' '}
                      <strong>{formatMinor(projectedSpendMinor)}</strong> — your cap must be at least this.
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setGoLiveOpen(false)} disabled={goingLive}>
                    Cancel
                  </Button>
                  <Button onClick={goLive} disabled={goingLive}>
                    {goingLive && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Go live
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* APPROVED → Activate (e.g. retry after the engine switch is turned on) */}
          {campaign.status === 'approved' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" disabled={activating}>
                  {activating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Rocket className="mr-1 h-4 w-4" />}
                  Activate
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Activate this ad?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This un-pauses the campaign, every ad set, and every ad on Meta. If the engine is live, this starts real
                    spend up to the approved cap. If it&apos;s still in dry-run mode, nothing spends.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={activating}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={activate} disabled={activating}>
                    {activating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Yes, activate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Pause is available whenever there is something on Meta that could deliver */}
          {(campaign.status === 'active' || campaign.status === 'approved' || campaign.status === 'pushed') && (
            <Button className="w-full" variant="destructive" onClick={pause} disabled={pausing}>
              {pausing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Ban className="mr-1 h-4 w-4" />}
              Pause
            </Button>
          )}

          {canDiscard &&
            (confirmDiscard ? (
              <div className="flex items-center justify-center gap-2 text-xs">
                <span className="text-muted-foreground">
                  {campaign.status === 'draft' ? 'Delete this draft?' : 'Delete on Meta + here?'}
                </span>
                <Button size="sm" variant="destructive" className="h-7" onClick={discard} disabled={discarding}>
                  {discarding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Yes, discard'}
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => setConfirmDiscard(false)} disabled={discarding}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button className="w-full" variant="ghost" size="sm" onClick={() => setConfirmDiscard(true)}>
                <Trash2 className="mr-1 h-4 w-4" /> {campaign.status === 'draft' ? 'Discard draft' : 'Discard'}
              </Button>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
