'use client';

/**
 * Gate 1 — review a PREPARED proposal (the Opportunity-Engine path).
 *
 * Unlike the manual composer, the copy is already written: the planner picked the audience and
 * the copywriter drafted a bespoke message per recipient. The owner reads the "what & why now",
 * then each recipient's own message with the reason it was chosen, edits or excludes any, and
 * approves. "Approve & queue" pushes the reviewed bodies through the gateway into the outbox — it
 * sends nothing; the owner sends manually in Gate 2. All guardrails re-run at send time.
 */
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Trash2, Sparkles, Tag, CheckCircle2, Circle, AlertTriangle } from 'lucide-react';
import { fetchProposalAction, approveProposalAction, discardDraftCampaignAction, type ProposalReviewRow } from '../actions';
import type { CampaignProposal } from '@/lib/growth/contracts';

export function ProposalReview({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [approving, startApprove] = useTransition();
  const [discarding, startDiscard] = useTransition();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<CampaignProposal | null>(null);
  const [rows, setRows] = useState<ProposalReviewRow[]>([]);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    fetchProposalAction(campaignId).then((res) => {
      if (!alive) return;
      if (res.success && res.proposal && res.rows) {
        setProposal(res.proposal);
        setRows(res.rows);
        setBodies(Object.fromEntries(res.rows.map((r) => [r.guestId, r.body])));
      } else {
        setError(res.error ?? 'Failed to load proposal');
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [campaignId]);

  const toggle = (guestId: string) =>
    setExcluded((prev) => { const next = new Set(prev); next.has(guestId) ? next.delete(guestId) : next.add(guestId); return next; });

  const includedCount = rows.filter((r) => !excluded.has(r.guestId)).length;

  const approve = () =>
    startApprove(async () => {
      const edits = rows.map((r) => ({ guestId: r.guestId, body: bodies[r.guestId] ?? r.body, include: !excluded.has(r.guestId) }));
      const res = await approveProposalAction(campaignId, edits);
      if (res.success) {
        toast({
          title: `Queued ${res.queued ?? 0} message${res.queued === 1 ? '' : 's'}`,
          description: 'Nothing sent yet — send them from the list on the next screen.',
        });
        router.refresh(); // status → sending: page swaps to the send list (Gate 2)
      } else {
        toast({ title: 'Could not queue', description: res.error, variant: 'destructive' });
      }
    });

  const discard = () =>
    startDiscard(async () => {
      const res = await discardDraftCampaignAction(campaignId);
      if (res.success) router.push('/admin/campaigns');
      else { toast({ title: 'Could not discard', description: res.error, variant: 'destructive' }); setConfirmDiscard(false); }
    });

  if (loading) return <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading the prepared campaign…</div>;
  if (error) return <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>;

  const offer = proposal?.offer;

  return (
    <div className="space-y-6">
      {/* What & why now */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            {proposal?.occasion.name || 'Prepared campaign'}
          </CardTitle>
          <CardDescription>{proposal?.occasion.point}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {offer && (offer.discountPct || offer.description) && (
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              {offer.discountPct ? <Badge variant="secondary">{offer.discountPct}% off</Badge> : null}
              <span className="text-muted-foreground">{offer.description}</span>
            </div>
          )}
          {proposal?.rationale && (
            <p className="text-muted-foreground"><span className="font-medium text-foreground">Why: </span>{proposal.rationale}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {includedCount} of {rows.length} recipient{rows.length === 1 ? '' : 's'} selected. Each message was written for that
            person and is grounded in what we know about them. Edit anything before you approve.
          </p>
        </CardContent>
      </Card>

      {/* Per-recipient messages */}
      <Card>
        <CardHeader>
          <CardTitle>Recipients &amp; messages</CardTitle>
          <CardDescription>Review each message, edit if needed, and untick anyone you don’t want to contact this round.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((r) => {
            const isOut = excluded.has(r.guestId);
            return (
              <div key={r.guestId} className={`rounded-md border p-3 ${isOut ? 'opacity-50' : ''}`}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      <Badge variant="outline" className="uppercase text-[10px]">{r.language}</Badge>
                      {(r.careFlags ?? []).map((f) => (
                        <Badge key={f} variant="outline" className="border-amber-300 text-[10px] text-amber-700">
                          <AlertTriangle className="mr-1 h-3 w-3" />{f}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.phone ?? 'no number on file'} · {r.angle}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 shrink-0 text-xs" onClick={() => toggle(r.guestId)}>
                    {isOut ? <><Circle className="mr-1 h-3.5 w-3.5" /> Excluded</> : <><CheckCircle2 className="mr-1 h-3.5 w-3.5 text-green-600" /> Included</>}
                  </Button>
                </div>
                <Textarea
                  value={bodies[r.guestId] ?? r.body}
                  onChange={(e) => setBodies((prev) => ({ ...prev, [r.guestId]: e.target.value }))}
                  rows={5}
                  disabled={isOut}
                  className="text-sm"
                />
                {r.factsUsed.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Grounded in: {r.factsUsed.join(', ')}</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t pt-4">
        <Button onClick={approve} disabled={approving || includedCount === 0}>
          {approving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
          Approve &amp; queue ({includedCount})
        </Button>
        {confirmDiscard ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Delete this draft?</span>
            <Button size="sm" variant="destructive" className="h-7" onClick={discard} disabled={discarding}>
              {discarding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Yes, discard'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setConfirmDiscard(false)} disabled={discarding}>Cancel</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => setConfirmDiscard(true)}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Discard draft
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Approving queues the messages to your outbox — nothing sends automatically. You send each one by hand in the next
        screen. Consent, frequency-cap and booking checks run again at that point.
      </p>
    </div>
  );
}
