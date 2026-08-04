'use client';

/**
 * Situation console (Move 2 · P3 + P4) — the owner's surface for the in-app analyst. Run it, read the
 * report, and act on it: CHALLENGE & re-run with a steer, EDIT a proposal, DISMISS/SNOOZE/RESTORE.
 * Still NO arm hand-off — approving an opportunity into a real draft is P5. Nothing here sends or spends.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, AlertTriangle, MapPin, MessageSquareWarning, Pencil, Ban, Clock, RotateCcw, Check, X, ArrowRight, ExternalLink } from 'lucide-react';
import type { SituationReport, Flag, AnalystOpportunity, RecommendedAction } from '@/lib/growth/contracts';
import {
  runAnalysisAction,
  reRunWithSteerAction,
  editOpportunityAction,
  dismissOpportunityAction,
  snoozeOpportunityAction,
  restoreOpportunityAction,
  approveOpportunityAction,
} from '../actions';

type OppDoc = AnalystOpportunity & { id: string; runId: string; propertyId: string; status: string; edited?: boolean; dismissReason?: string | null; handoff?: { arm: string; ref?: string; url?: string; note?: string } | null };
interface ReportDoc {
  id: string; propertyId: string; asOf: string; createdAt?: string; createdBy?: string; status: string; report: SituationReport; warnings?: string[]; steer?: string | null;
}
interface SituationData { report: ReportDoc; opportunities: OppDoc[] }

const MENU: RecommendedAction[] = ['whatsapp', 'ads', 'page', 'price', 'minstay', 'los', 'ota', 'none'];
const SEV_STYLE: Record<string, string> = {
  red: 'border-red-300 bg-red-50/60 text-red-900',
  amber: 'border-amber-300 bg-amber-50/60 text-amber-900',
  yellow: 'border-yellow-300 bg-yellow-50/50 text-yellow-900',
};
const SEV_DOT: Record<string, string> = { red: '🔴', amber: '🟠', yellow: '🟡' };
const ACTION_STYLE: Record<string, string> = {
  whatsapp: 'bg-emerald-100 text-emerald-800', ads: 'bg-blue-100 text-blue-800', page: 'bg-violet-100 text-violet-800',
  price: 'bg-amber-100 text-amber-800', minstay: 'bg-amber-100 text-amber-800', los: 'bg-amber-100 text-amber-800',
  ota: 'bg-slate-100 text-slate-800', none: 'bg-slate-100 text-slate-600',
};

export function SituationConsole({ propertyId, initial }: { propertyId: string; initial: SituationData | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [running, startRun] = useTransition();
  const [challenging, startChallenge] = useTransition();
  const [steer, setSteer] = useState('');
  const data = initial;

  const run = () =>
    startRun(async () => {
      const res = await runAnalysisAction(propertyId);
      if (res.ok) { toast({ title: 'Analysis complete', description: `${res.opportunities} opportunit${res.opportunities === 1 ? 'y' : 'ies'} · ${res.warnings} grounding warning${res.warnings === 1 ? '' : 's'}.` }); router.refresh(); }
      else toast({ title: 'Analysis failed', description: res.error, variant: 'destructive' });
    });

  const challenge = () => {
    if (!steer.trim()) { toast({ title: 'Write a note first', description: 'What should it reconsider?', variant: 'destructive' }); return; }
    startChallenge(async () => {
      const res = await reRunWithSteerAction(propertyId, steer.trim());
      if (res.ok) { toast({ title: 're-analysed with your steer', description: 'The report below reflects your challenge.' }); setSteer(''); router.refresh(); }
      else toast({ title: 'Re-run failed', description: res.error, variant: 'destructive' });
    });
  };

  const r = data?.report.report;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {data ? (<>Last run <span className="font-medium text-foreground">{data.report.asOf}</span>{data.report.createdBy ? ` · by ${data.report.createdBy}` : ''}{data.report.createdAt ? ` · ${new Date(data.report.createdAt).toLocaleString()}` : ''}</>) : (<>No analysis yet for this property.</>)}
        </div>
        <Button onClick={run} disabled={running || challenging}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {running ? 'Analysing… (~a minute)' : 'Run analysis'}
        </Button>
      </div>

      {!data && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Press <strong>Run analysis</strong> to generate the first Situation Report. It reads the deterministic fact pack and takes about a minute. Nothing is sent or spent — it only proposes.
        </CardContent></Card>
      )}

      {data && r && (
        <>
          {data.report.steer && (
            <div className="rounded-md border border-blue-200 bg-blue-50/50 p-2 text-xs text-blue-900">
              <span className="font-medium">This run reflects your steer:</span> “{data.report.steer}”
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-muted-foreground" /> Situation
                {(data.report.warnings?.length ?? 0) > 0 && (
                  <Badge variant="outline" className="ml-auto text-[10px] text-amber-700">{data.report.warnings!.length} grounding warning{data.report.warnings!.length === 1 ? '' : 's'}</Badge>
                )}
              </CardTitle>
              <CardDescription className="text-[15px] leading-relaxed text-foreground">{r.headline}</CardDescription>
            </CardHeader>
          </Card>

          {/* Challenge & re-run */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><MessageSquareWarning className="h-4 w-4 text-muted-foreground" /> Challenge it</CardTitle>
              <CardDescription>Disagree, or want it to reconsider something? Write a note and re-run — it folds your steer in (and pushes back with the data if you're wrong).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea value={steer} onChange={(e) => setSteer(e.target.value)} rows={2} placeholder='e.g. "September is fine, do not flag it" · "push October families harder" · "the WhatsApp list is bigger than you think"' />
              <Button size="sm" variant="secondary" onClick={challenge} disabled={challenging || running}>
                {challenging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareWarning className="mr-2 h-4 w-4" />}
                {challenging ? 'Re-analysing…' : 'Re-run with this steer'}
              </Button>
            </CardContent>
          </Card>

          {r.flags?.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Flags <span className="text-muted-foreground">· ranked by money at risk</span></h3>
              {r.flags.map((f: Flag, i: number) => (
                <div key={i} className={`rounded-md border p-3 text-sm ${SEV_STYLE[f.severity] ?? 'border-border'}`}>
                  <p className="font-medium">{SEV_DOT[f.severity] ?? ''} {f.what}</p>
                  <p className="mt-1 font-mono text-[11px] opacity-80">{f.evidence?.path} = {f.evidence?.value} · <span className="uppercase">{f.whoActs}</span></p>
                </div>
              ))}
            </div>
          )}

          {data.opportunities.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Opportunities <span className="text-muted-foreground">· proposals — edit, dismiss, or set aside (nothing runs yet)</span></h3>
              {data.opportunities.map((o) => <OpportunityCard key={o.id} opp={o} onChanged={() => router.refresh()} />)}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {r.normal?.length > 0 && <Section title="Normal — looks alarming but isn't">{r.normal.map((n, i) => <li key={i}>{n}</li>)}</Section>}
            {r.questions?.length > 0 && <Section title="Questions for you">{r.questions.map((q, i) => <li key={i}>{q}</li>)}</Section>}
            {(r.confidence?.thin?.length > 0 || r.confidence?.guessing?.length > 0) && (
              <Section title="Confidence — the thin bits">
                {r.confidence.thin.map((t, i) => <li key={`t${i}`}><span className="text-amber-700">thin:</span> {t}</li>)}
                {r.confidence.guessing.map((g, i) => <li key={`g${i}`}><span className="text-muted-foreground">guessing:</span> {g}</li>)}
              </Section>
            )}
            {(r.packGaps?.length ?? 0) > 0 && <Section title="Pack gaps — facts it couldn't get">{r.packGaps!.map((g, i) => <li key={i}>{g}</li>)}</Section>}
          </div>

          {(data.report.warnings?.length ?? 0) > 0 && (
            <details className="rounded-md border bg-muted/30 p-3 text-xs">
              <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> {data.report.warnings!.length} grounding warning{data.report.warnings!.length === 1 ? '' : 's'} (soft — a cited value didn't exactly match the pack)</summary>
              <ul className="mt-2 space-y-1 text-muted-foreground">{data.report.warnings!.map((w, i) => <li key={i} className="font-mono">{w}</li>)}</ul>
            </details>
          )}

          <p className="text-xs text-muted-foreground">Approving an opportunity into a real draft (ads review-before-push / WhatsApp Gate-1) comes next. Nothing here sends or spends.</p>
        </>
      )}
    </div>
  );
}

function OpportunityCard({ opp, onChanged }: { opp: OppDoc; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, startBusy] = useTransition();
  const [mode, setMode] = useState<'view' | 'edit' | 'dismiss'>('view');
  const [reason, setReason] = useState('');
  const [f, setF] = useState({
    action: opp.action as RecommendedAction,
    start: opp.window?.start ?? '',
    end: opp.window?.end ?? '',
    nights: opp.window?.nights ?? 0,
    occasion: opp.occasion ?? '',
    audience: opp.audience ?? '',
    valueAtRisk: opp.valueAtRisk ?? 0,
    rationale: opp.rationale ?? '',
  });

  const disposed = opp.status === 'dismissed' || opp.status === 'snoozed';

  const save = () =>
    startBusy(async () => {
      const window = f.start && f.end ? { start: f.start, end: f.end, nights: Number(f.nights) || 0 } : null;
      const res = await editOpportunityAction(opp.id, { action: f.action, window, occasion: f.occasion || null, audience: f.audience || null, valueAtRisk: Number(f.valueAtRisk) || null, rationale: f.rationale });
      if (res.ok) { toast({ title: 'Opportunity edited' }); setMode('view'); onChanged(); }
      else toast({ title: 'Edit failed', description: res.error, variant: 'destructive' });
    });
  const dismiss = () =>
    startBusy(async () => {
      const res = await dismissOpportunityAction(opp.id, reason);
      if (res.ok) { toast({ title: 'Dismissed' }); setMode('view'); onChanged(); }
      else toast({ title: 'Failed', description: res.error, variant: 'destructive' });
    });
  const snooze = () => startBusy(async () => { const res = await snoozeOpportunityAction(opp.id); if (res.ok) onChanged(); else toast({ title: 'Failed', description: res.error, variant: 'destructive' }); });
  const restore = () => startBusy(async () => { const res = await restoreOpportunityAction(opp.id); if (res.ok) onChanged(); else toast({ title: 'Failed', description: res.error, variant: 'destructive' }); });
  const approve = () =>
    startBusy(async () => {
      const res = await approveOpportunityAction(opp.id);
      if (res.ok) { toast({ title: res.status === 'approved' ? 'Approved — draft created' : 'Accepted', description: res.handoffUrl ? `Draft ready at ${res.handoffUrl}` : res.note }); onChanged(); }
      else toast({ title: 'Approve failed', description: res.error, variant: 'destructive' });
    });

  const approved = opp.status === 'approved' || opp.status === 'accepted';
  const isCampaign = opp.action === 'ads' || opp.action === 'page' || opp.action === 'whatsapp';

  if (mode === 'edit') {
    return (
      <Card>
        <CardContent className="space-y-2 pt-5 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1"><Label className="text-xs">Action</Label>
              <select value={f.action} onChange={(e) => setF({ ...f, action: e.target.value as RecommendedAction })} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                {MENU.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Value at risk (RON)</Label><Input type="number" value={f.valueAtRisk} onChange={(e) => setF({ ...f, valueAtRisk: Number(e.target.value) })} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">Window start</Label><Input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">Window end</Label><Input type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">Nights</Label><Input type="number" value={f.nights} onChange={(e) => setF({ ...f, nights: Number(e.target.value) })} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">Occasion</Label><Input value={f.occasion} onChange={(e) => setF({ ...f, occasion: e.target.value })} className="h-9" /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Audience</Label><Input value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} className="h-9" /></div>
          <div className="space-y-1"><Label className="text-xs">Why (rationale)</Label><Textarea value={f.rationale} onChange={(e) => setF({ ...f, rationale: e.target.value })} rows={3} /></div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={busy}>{busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />} Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('view')} disabled={busy}><X className="mr-1 h-3.5 w-3.5" /> Cancel</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={disposed ? 'opacity-60' : ''}>
      <CardContent className="space-y-2 pt-5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={`uppercase ${ACTION_STYLE[opp.action] ?? 'bg-slate-100 text-slate-700'}`}>{opp.action}</Badge>
          {opp.window && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {opp.window.start} → {opp.window.end} ({opp.window.nights}n)</span>}
          {opp.valueAtRisk ? <span className="text-xs text-muted-foreground">· ~{opp.valueAtRisk.toLocaleString()} RON</span> : null}
          {opp.occasion ? <Badge variant="outline" className="text-[10px]">{opp.occasion}</Badge> : null}
          {opp.edited ? <Badge variant="outline" className="text-[10px] text-emerald-700">edited</Badge> : null}
          {opp.status === 'dismissed' ? <Badge variant="outline" className="text-[10px] text-destructive">dismissed</Badge> : null}
          {opp.status === 'snoozed' ? <Badge variant="outline" className="text-[10px]">snoozed</Badge> : null}
          {approved ? <Badge variant="outline" className="text-[10px] text-emerald-700">{opp.status}</Badge> : null}
        </div>
        {opp.audience && <p className="text-xs"><span className="font-medium">Audience:</span> <span className="text-muted-foreground">{opp.audience}</span></p>}
        <p><span className="font-medium">Why:</span> {opp.rationale}</p>
        {opp.rejected && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Rejected:</span> {opp.rejected}</p>}
        {opp.dismissReason && <p className="text-xs text-destructive"><span className="font-medium">Dismissed:</span> {opp.dismissReason}</p>}

        {approved ? (
          <div className="text-xs text-muted-foreground">
            {opp.handoff?.url ? (
              <a href={opp.handoff.url} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                Open the {opp.handoff.arm} draft <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
            {opp.handoff?.note ? <p className="mt-1">{opp.handoff.note}</p> : null}
          </div>
        ) : mode === 'dismiss' ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why dismiss? (a calibration signal)" className="h-8 flex-1 min-w-[200px]" />
            <Button size="sm" variant="destructive" onClick={dismiss} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm'}</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('view')} disabled={busy}>Cancel</Button>
          </div>
        ) : disposed ? (
          <Button size="sm" variant="outline" onClick={restore} disabled={busy}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore</Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            {opp.action !== 'none' && (
              <Button size="sm" onClick={approve} disabled={busy}>
                {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="mr-1 h-3.5 w-3.5" />}
                {isCampaign ? 'Approve →' : 'Accept'}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setMode('edit')} disabled={busy}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('dismiss')} disabled={busy}><Ban className="mr-1 h-3.5 w-3.5" /> Dismiss</Button>
            <Button size="sm" variant="ghost" onClick={snooze} disabled={busy}><Clock className="mr-1 h-3.5 w-3.5" /> Snooze</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent><ul className="list-disc space-y-1 pl-4 text-sm text-foreground">{children}</ul></CardContent>
    </Card>
  );
}
