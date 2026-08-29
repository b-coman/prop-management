'use client';

/**
 * The pricing position, as one screen you can read in ten seconds.
 *
 * The old page had one tab per Firestore collection, so every screen was a form over a table and none
 * answered a question. This answers the only one that matters first — *where do I stand and what is it
 * costing me* — by rolling everything to the PERIOD, which is the unit prices are actually set in.
 *
 * Design rules here, each earned:
 *  - ONE unit everywhere: guest-facing totals for a real stay. Per-night list prices are labelled as such.
 *  - Plain thousands separators. Romanian locale renders 1598 as "1.598", which on an English page
 *    reads as one-point-five-nine-eight — the same decimal ambiguity that produced a real parser bug.
 *  - The owner's 3% band is honoured: a sub-3% gap is `level`, not red. Reporting +0.5% as a failure
 *    buries the +36% row underneath it.
 *  - Money, not percentages, sizes the problem. 12% on a fully-booked period costs nothing; 36% across
 *    38 open nights is the year.
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, HelpCircle, TrendingDown } from 'lucide-react';

type Verdict = 'losing' | 'level' | 'thin' | 'healthy' | 'overshoot' | 'unmeasured';

export interface PositionRow {
  id: string; name: string; startDate: string; endDate: string; tier: string;
  nights: number; booked: number; openNights: number; occupancyPct: number;
  weekdayPrice: number | null; weekendPrice: number | null; valueAtRisk: number;
  verdict: Verdict; worstGapPct: number | null;
  worstWindow: { nights: number; guests: number; direct: number | null; bestChannel: string | null;
                 bestPrice: number | null; floor: number | null; targetPrice: number | null } | null;
  measuredWindows: number; freshestAgeDays: number | null; action: string | null;
}
export interface PositionSummaryShape {
  periods: number; losing: number; level: number; thin: number; healthy: number;
  overshoot: number; unmeasured: number; openNights: number;
  valueAtRiskLosing: number; valueAtRiskUnmeasured: number; totalValueAtRisk: number;
}

/** Plain grouping. Never `toLocaleString('ro-RO')` — "1.598" is unreadable on an English page. */
const lei = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * Labels in the owner's language, not the trade's.
 *
 * These read "losing", "thin", "overshoot", "dearer" in the first version — words from channel-pricing
 * jargon that mean nothing to the person using the screen, and that nothing on the page defined. He
 * asked, reasonably, "losing what?". A label that needs explaining is the wrong label.
 */
const V: Record<Verdict, { label: string; chip: string; rail: string; means: string }> = {
  losing:     { label: 'You cost more',   chip: 'bg-red-100 text-red-900 border-red-200',           rail: 'bg-red-500',
                means: 'A guest who compares finds your own site more expensive, books the platform, and you pay its commission.' },
  overshoot:  { label: 'You are too low', chip: 'bg-amber-100 text-amber-900 border-amber-200',     rail: 'bg-amber-500',
                means: 'Your price is so low that after card fees you keep less than the platform would have paid you.' },
  level:      { label: 'Same price',      chip: 'bg-orange-50 text-orange-900 border-orange-200',   rail: 'bg-orange-300',
                means: 'Within 3% of the cheapest platform — no reason for a guest to prefer booking with you directly.' },
  thin:       { label: 'Barely cheaper',  chip: 'bg-yellow-50 text-yellow-800 border-yellow-200',   rail: 'bg-yellow-400',
                means: 'Cheaper than the platforms, but by less than the 10% you aim for.' },
  healthy:    { label: 'You are cheaper', chip: 'bg-emerald-100 text-emerald-900 border-emerald-200', rail: 'bg-emerald-500',
                means: 'Cheaper than every platform by at least your target, and you still keep more than they would pay you.' },
  unmeasured: { label: 'Not checked',     chip: 'bg-slate-100 text-slate-600 border-slate-200',     rail: 'bg-slate-300',
                means: 'No one has compared this period against the platforms yet. Unknown, not safe.' },
};

const shortDate = (d: string) => {
  const [, m, day] = d.split('-');
  return `${Number(day)} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m) - 1]}`;
};

export function PositionView({ rows, summary, meta }: {
  rows: PositionRow[]; summary: PositionSummaryShape;
  meta: { generatedAt: string; parityAvailable: boolean; parityError: string | null; measuredWindows: number };
}) {
  const worst = [...rows].filter((r) => r.verdict === 'losing').sort((a, b) => b.valueAtRisk - a.valueAtRisk).slice(0, 3);
  const maxRisk = Math.max(1, ...rows.map((r) => r.valueAtRisk));

  return (
    <div className="space-y-4">
      {/* ---- the money, first, because percentages do not size a problem ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Your position</CardTitle>
          <CardDescription>
            One row per pricing period for the rest of the year: how full it is, what you charge, and
            whether someone comparing your site with Airbnb and Booking would book with you or with them.
            Every comparison is the <strong>total a guest actually pays</strong> for a real stay — all
            fees in, both platform discounts applied — not a nightly rate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Headline value={`${lei(summary.totalValueAtRisk)} lei`}
                      label={`still unsold — ${summary.openNights} open nights at your current prices`} />
            <Headline value={`${lei(summary.valueAtRiskLosing)} lei`} tone="text-red-700"
                      label={`of it where you cost a guest MORE than Airbnb or Booking do`} />
            <Headline value={`${lei(summary.valueAtRiskUnmeasured)} lei`} tone="text-slate-600"
                      label={`of it never checked against the platforms`} />
          </div>

          {worst.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-red-900">
                <TrendingDown className="h-4 w-4" /> Where the most money sits while you are the expensive option
              </p>
              <ul className="space-y-1 text-sm text-red-900">
                {worst.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline gap-x-2">
                    <strong>{r.name}</strong>
                    <span className="tabular-nums">{lei(r.valueAtRisk)} lei</span>
                    <span className="opacity-70">across {r.openNights} open nights,</span>
                    <span className="font-medium tabular-nums">{(r.worstGapPct! * 100).toFixed(0)}% more expensive</span>
                    <span className="opacity-70">than {r.worstWindow?.bestChannel}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!meta.parityAvailable && (
            <p className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              No channel comparison available: {meta.parityError}. Occupancy and prices below are still real;
              every parity column reads unmeasured.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ---- the timeline: one row per period, chronological, because that is how a year is read ---- */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pl-4">Period</th>
                <th className="py-2">Occupancy</th>
                <th className="py-2 text-right">Weekday</th>
                <th className="py-2 text-right">Weekend</th>
                <th className="py-2 pl-4">If a guest compares</th>
                <th className="py-2 pr-4 text-right">Still unsold</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <PeriodRow key={r.id} r={r} maxRisk={maxRisk} />
              ))}
            </tbody>
          </table>
          <div className="border-t bg-slate-50/60 px-4 py-3">
            <p className="mb-2 text-xs font-medium text-slate-700">What the words mean</p>
            <div className="grid gap-x-6 gap-y-1.5 text-[11px] text-slate-600 sm:grid-cols-2">
              {(Object.keys(V) as Verdict[]).map((k) => (
                <div key={k} className="flex items-start gap-2">
                  <Badge variant="outline" className={`shrink-0 text-[10px] ${V[k].chip}`}>{V[k].label}</Badge>
                  <span>{V[k].means}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-600">
              <strong>Still unsold</strong> is the open nights in that period multiplied by what you currently
              ask for them. It is money not yet earned, not money at risk of being lost.
            </p>
          </div>
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            {summary.periods} forward periods · {meta.measuredWindows} measured stay windows ·
            read {new Date(meta.generatedAt).toLocaleString('en-GB')}. Weekday and weekend are the
            average nightly asking price in that period, before length-of-stay discounts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Headline({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-slate-50/60 p-3">
      <div className={`text-2xl font-semibold tabular-nums ${tone ?? ''}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PeriodRow({ r, maxRisk }: { r: PositionRow; maxRisk: number }) {
  const v = V[r.verdict];
  const needsAttention = r.verdict === 'losing' || r.verdict === 'overshoot' || r.verdict === 'unmeasured';
  return (
    <>
      <tr className="border-b align-middle">
        <td className="py-3 pl-4">
          <div className="flex items-center gap-2">
            <span className={`h-8 w-1 rounded ${v.rail}`} />
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-muted-foreground">
                {shortDate(r.startDate)} – {shortDate(r.endDate)} · {r.nights}n · tier {r.tier}
              </div>
            </div>
          </div>
        </td>
        <td className="py-3">
          <div className="flex w-32 items-center gap-2">
            <div className="h-2 w-20 overflow-hidden rounded bg-slate-200">
              <div className="h-full rounded bg-slate-700" style={{ width: `${r.occupancyPct}%` }} />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {r.occupancyPct}%
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">{r.openNights} open</div>
        </td>
        <td className="py-3 text-right tabular-nums">{lei(r.weekdayPrice)}</td>
        <td className="py-3 text-right tabular-nums">{lei(r.weekendPrice)}</td>
        <td className="py-3 pl-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[11px] ${v.chip}`}>{v.label}</Badge>
            {r.worstGapPct !== null && (
              <span className="text-xs font-medium tabular-nums">
                {r.worstGapPct > 0 ? '+' : ''}{(r.worstGapPct * 100).toFixed(1)}%
              </span>
            )}
            {r.verdict === 'unmeasured' && <HelpCircle className="h-3.5 w-3.5 text-slate-400" />}
          </div>
          {r.measuredWindows > 0 && (
            <div className="text-[11px] text-muted-foreground">
              {r.measuredWindows} window{r.measuredWindows === 1 ? '' : 's'}
              {r.freshestAgeDays !== null && `, newest ${r.freshestAgeDays}d old`}
            </div>
          )}
        </td>
        <td className="py-3 pr-4 text-right">
          <div className="tabular-nums">{lei(r.valueAtRisk)}</div>
          <div className="ml-auto mt-1 h-1.5 w-20 overflow-hidden rounded bg-slate-100">
            <div className={`h-full rounded ${v.rail}`} style={{ width: `${(r.valueAtRisk / maxRisk) * 100}%` }} />
          </div>
        </td>
      </tr>
      {needsAttention && r.action && (
        <tr className="border-b bg-slate-50/70">
          <td colSpan={6} className="px-4 py-2 pl-11 text-xs text-slate-700">{r.action}</td>
        </tr>
      )}
    </>
  );
}
