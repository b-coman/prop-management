'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Loader2, ExternalLink, RefreshCw, Ban, ShieldCheck, Rocket } from 'lucide-react';
import type { AdCampaign } from '@/types';
import { approveAdAction, activateAdAction, pauseAdAction, refreshAdInsightsAction } from '../actions';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  pending_approval: 'secondary',
  approved: 'secondary',
  active: 'default',
  paused: 'outline',
  failed: 'destructive',
};

const PROBLEM_EFFECTIVE_STATUSES = new Set(['DISAPPROVED', 'REJECTED', 'WITH_ISSUES', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED']);

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
  const [approving, startApprove] = useTransition();
  const [activating, startActivate] = useTransition();
  const [pausing, startPause] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [approveOpen, setApproveOpen] = useState(false);
  const [spendCapRon, setSpendCapRon] = useState('50');

  const days = daysToEndTime(campaign.endTime);
  const projectedSpendMinor =
    days && campaign.dailyBudgetMinor ? Math.round(campaign.dailyBudgetMinor * days * 1.25) : undefined;

  const approve = () => {
    const spendCapMinor = Math.round(Number(spendCapRon) * 100);
    if (!Number.isFinite(spendCapMinor) || spendCapMinor <= 0) {
      toast({ title: 'Invalid spend cap', variant: 'destructive' });
      return;
    }
    startApprove(async () => {
      const res = await approveAdAction(campaign.id, spendCapMinor);
      if (res.ok) {
        toast({ title: 'Approved', description: `Spend cap set to ${spendCapRon} RON.` });
        setApproveOpen(false);
        router.refresh();
      } else {
        toast({ title: 'Approve failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  const activate = () => {
    startActivate(async () => {
      const res = await activateAdAction(campaign.id);
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
      if (res.success) {
        toast({ title: 'Paused' });
      } else {
        toast({ title: 'Pause failed', description: res.error, variant: 'destructive' });
      }
      router.refresh();
    });
  };

  const refresh = () => {
    startRefresh(async () => {
      const res = await refreshAdInsightsAction(campaign.id);
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

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Campaign
            <Badge variant={STATUS_VARIANT[campaign.status] || 'outline'}>{campaign.status}</Badge>
            {campaign.effectiveStatus && PROBLEM_EFFECTIVE_STATUSES.has(campaign.effectiveStatus) && (
              <Badge variant="destructive">{campaign.effectiveStatus}</Badge>
            )}
          </CardTitle>
          <CardDescription>{campaign.metaCampaignId ?? 'No Meta campaign id recorded'}</CardDescription>
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
        <CardFooter>
          <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
            Refresh insights
          </Button>
        </CardFooter>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Approve sets a spend cap. Activate spends real money once both engine switches are on.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" variant="secondary" disabled={campaign.status !== 'draft'}>
                <ShieldCheck className="mr-1 h-4 w-4" />
                Approve
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Approve this ad</DialogTitle>
                <DialogDescription>
                  Set a spend cap. The server rejects the cap unless{' '}
                  <code>dailyBudget × days-to-end-time × 1.25 ≤ spendCap</code>.
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
                <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={approving}>
                  Cancel
                </Button>
                <Button onClick={approve} disabled={approving}>
                  {approving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm approval
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="w-full" disabled={campaign.status !== 'approved' || activating}>
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

          <Button className="w-full" variant="destructive" onClick={pause} disabled={pausing}>
            {pausing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Ban className="mr-1 h-4 w-4" />}
            Pause
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
