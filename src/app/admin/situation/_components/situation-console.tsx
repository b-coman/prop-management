'use client';

/**
 * Situation console (Move 2 · P3) — the read-only surface for the in-app analyst. A "Run analysis"
 * button triggers the analyst + persists; the latest report + routed opportunities render below.
 * Read-only: no edit / challenge / approve yet (those are P4/P5). This is where the owner reads real
 * reports and calibrates before any action exists.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, AlertTriangle, MapPin, ArrowRight } from 'lucide-react';
import type { SituationReport, Flag, AnalystOpportunity } from '@/lib/growth/contracts';
import { runAnalysisAction } from '../actions';

interface ReportDoc {
  id: string;
  propertyId: string;
  asOf: string;
  createdAt?: string;
  createdBy?: string;
  status: string;
  report: SituationReport;
  warnings?: string[];
}
type OppDoc = AnalystOpportunity & { id: string; runId: string; propertyId: string; status: string };
interface SituationData {
  report: ReportDoc;
  opportunities: OppDoc[];
}

const SEV_STYLE: Record<string, string> = {
  red: 'border-red-300 bg-red-50/60 text-red-900',
  amber: 'border-amber-300 bg-amber-50/60 text-amber-900',
  yellow: 'border-yellow-300 bg-yellow-50/50 text-yellow-900',
};
const SEV_DOT: Record<string, string> = { red: '🔴', amber: '🟠', yellow: '🟡' };
const ACTION_STYLE: Record<string, string> = {
  whatsapp: 'bg-emerald-100 text-emerald-800',
  ads: 'bg-blue-100 text-blue-800',
  page: 'bg-violet-100 text-violet-800',
  price: 'bg-amber-100 text-amber-800',
  minstay: 'bg-amber-100 text-amber-800',
  los: 'bg-amber-100 text-amber-800',
  ota: 'bg-slate-100 text-slate-800',
  none: 'bg-slate-100 text-slate-600',
};

export function SituationConsole({ propertyId, initial }: { propertyId: string; initial: SituationData | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [running, startRun] = useTransition();
  const [data] = useState<SituationData | null>(initial);

  const run = () =>
    startRun(async () => {
      const res = await runAnalysisAction(propertyId);
      if (res.ok) {
        toast({ title: 'Analysis complete', description: `${res.opportunities} opportunit${res.opportunities === 1 ? 'y' : 'ies'} · ${res.warnings} grounding warning${res.warnings === 1 ? '' : 's'}.` });
        router.refresh();
      } else {
        toast({ title: 'Analysis failed', description: res.error, variant: 'destructive' });
      }
    });

  const r = data?.report.report;

  return (
    <div className="space-y-6">
      {/* Run bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {data ? (
            <>Last run <span className="font-medium text-foreground">{data.report.asOf}</span>{data.report.createdBy ? ` · by ${data.report.createdBy}` : ''}{data.report.createdAt ? ` · ${new Date(data.report.createdAt).toLocaleString()}` : ''}</>
          ) : (
            <>No analysis yet for this property.</>
          )}
        </div>
        <Button onClick={run} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {running ? 'Analysing… (~a minute)' : 'Run analysis'}
        </Button>
      </div>

      {!data && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Press <strong>Run analysis</strong> to generate the first Situation Report. It reads the deterministic fact pack and takes about a minute. Nothing is sent or spent — it only proposes.
          </CardContent>
        </Card>
      )}

      {data && r && (
        <>
          {/* Headline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-muted-foreground" /> Situation
                {(data.report.warnings?.length ?? 0) > 0 && (
                  <Badge variant="outline" className="ml-auto text-[10px] text-amber-700">
                    {data.report.warnings!.length} grounding warning{data.report.warnings!.length === 1 ? '' : 's'}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-[15px] leading-relaxed text-foreground">{r.headline}</CardDescription>
            </CardHeader>
          </Card>

          {/* Flags */}
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

          {/* Opportunities */}
          {data.opportunities.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Opportunities <span className="text-muted-foreground">· proposals only — nothing runs yet</span></h3>
              {data.opportunities.map((o) => (
                <Card key={o.id}>
                  <CardContent className="space-y-2 pt-5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={`uppercase ${ACTION_STYLE[o.action] ?? 'bg-slate-100 text-slate-700'}`}>{o.action}</Badge>
                      {o.window && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" /> {o.window.start} → {o.window.end} ({o.window.nights}n)
                        </span>
                      )}
                      {o.valueAtRisk ? <span className="text-xs text-muted-foreground">· ~{o.valueAtRisk.toLocaleString()} RON</span> : null}
                      {o.occasion ? <Badge variant="outline" className="text-[10px]">{o.occasion}</Badge> : null}
                    </div>
                    {o.audience && <p className="text-xs"><span className="font-medium">Audience:</span> <span className="text-muted-foreground">{o.audience}</span></p>}
                    <p><span className="font-medium">Why:</span> {o.rationale}</p>
                    {o.rejected && (
                      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Rejected:</span> {o.rejected}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Supporting sections */}
          <div className="grid gap-3 md:grid-cols-2">
            {r.normal?.length > 0 && (
              <Section title="Normal — looks alarming but isn't">
                {r.normal.map((n, i) => <li key={i}>{n}</li>)}
              </Section>
            )}
            {r.questions?.length > 0 && (
              <Section title="Questions for you">
                {r.questions.map((q, i) => <li key={i}>{q}</li>)}
              </Section>
            )}
            {(r.confidence?.thin?.length > 0 || r.confidence?.guessing?.length > 0) && (
              <Section title="Confidence — the thin bits">
                {r.confidence.thin.map((t, i) => <li key={`t${i}`}><span className="text-amber-700">thin:</span> {t}</li>)}
                {r.confidence.guessing.map((g, i) => <li key={`g${i}`}><span className="text-muted-foreground">guessing:</span> {g}</li>)}
              </Section>
            )}
            {(r.packGaps?.length ?? 0) > 0 && (
              <Section title="Pack gaps — facts it couldn't get">
                {r.packGaps!.map((g, i) => <li key={i}>{g}</li>)}
              </Section>
            )}
          </div>

          {(data.report.warnings?.length ?? 0) > 0 && (
            <details className="rounded-md border bg-muted/30 p-3 text-xs">
              <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" /> {data.report.warnings!.length} grounding warning{data.report.warnings!.length === 1 ? '' : 's'} (soft — a cited value didn't exactly match the pack)
              </summary>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {data.report.warnings!.map((w, i) => <li key={i} className="font-mono">{w}</li>)}
              </ul>
            </details>
          )}

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowRight className="h-3.5 w-3.5" /> Read-only for now. Editing, challenging, and approving an opportunity into a draft come next.
          </p>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">{children}</ul>
      </CardContent>
    </Card>
  );
}
