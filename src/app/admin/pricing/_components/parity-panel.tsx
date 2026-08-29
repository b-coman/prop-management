'use client';

/**
 * The parity picture, as one screen.
 *
 * The design problem here is not "show the numbers" — the CLI already does that. It is that the
 * decision has FOUR numbers and they only mean something together: what the guest pays you, what the
 * guest pays the cheapest OTA, where your floor is, and how old the reading is. Shown apart, each one
 * misleads. So every row draws them on a single scale, and the row's colour is the verdict.
 *
 * Two things are deliberately loud rather than tucked away:
 *  - the Airbnb correction (a captured price is NOT what a guest pays), and
 *  - staleness and partial coverage, which read `unknown`/`partial` rather than borrowing a verdict.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Info, RefreshCw } from 'lucide-react';

type Verdict = 'losing' | 'thin' | 'healthy' | 'overshoot' | 'partial' | 'unknown';

interface Cell {
  channel: string; status: string; captured: number | null; effective: number | null;
  listTotal: number | null; promoActive: boolean; ratePlan: string; reason?: string;
  ageDays: number; stale: boolean; corrected: boolean;
}
export interface ParityWindow {
  key: string; checkIn: string; checkOut: string; nights: number; guests: number; label: string;
  direct: number | null; cells: Cell[]; best: { channel: string; effective: number } | null;
  verdict: Verdict; gapPct: number | null; floor: number | null; targetPrice: number | null;
  netAdvantage: number | null; upliftAtTarget: number | null; oldestAgeDays: number; warnings: string[];
}
export interface ParitySummaryShape {
  total: number; losing: number; thin: number; healthy: number; overshoot: number;
  partial: number; unknown: number; actionable: number;
}

const VERDICT: Record<Verdict, { label: string; cls: string; bar: string; help: string }> = {
  losing:    { label: 'LOSING',    cls: 'bg-red-100 text-red-900 border-red-300',
               bar: 'bg-red-500',    help: 'The guest pays LESS on the OTA. You lose the booking and pay commission on it.' },
  overshoot: { label: 'TOO LOW',   cls: 'bg-amber-100 text-amber-900 border-amber-300',
               bar: 'bg-amber-500',  help: 'Priced below your floor — you would earn more letting the OTA have it.' },
  thin:      { label: 'thin',      cls: 'bg-yellow-50 text-yellow-900 border-yellow-300',
               bar: 'bg-yellow-400', help: 'Cheaper, but by less than your target. Rarely enough to make anyone switch.' },
  healthy:   { label: 'OK',        cls: 'bg-green-100 text-green-900 border-green-300',
               bar: 'bg-green-500',  help: 'Cheaper by at least your target, and still above your floor.' },
  partial:   { label: 'partial',   cls: 'bg-slate-100 text-slate-700 border-slate-300',
               bar: 'bg-slate-400',  help: 'A channel in scope has no usable reading. A cheaper unmeasured channel could be setting the real floor.' },
  unknown:   { label: 'unknown',   cls: 'bg-slate-100 text-slate-500 border-slate-300',
               bar: 'bg-slate-300',  help: 'Nothing usable was measured for this window.' },
};

const lei = (n: number | null) => (n === null ? '—' : `${Math.round(n).toLocaleString('ro-RO')}`);
const pct = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : ''}${(n * 100).toFixed(1)}%`);

/**
 * One window on a single scale: floor ── target ── direct ── best OTA.
 * Seeing them apart is what makes a 22%-cheaper window that is BELOW the floor look like a win.
 */
function PriceScale({ w }: { w: ParityWindow }) {
  if (w.direct === null || w.best === null || w.floor === null) {
    return <div className="text-xs text-muted-foreground">no scale — nothing comparable measured</div>;
  }
  const lo = Math.min(w.floor, w.direct, w.best.effective) * 0.96;
  const hi = Math.max(w.floor, w.direct, w.best.effective) * 1.04;
  const at = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const v = VERDICT[w.verdict];
  return (
    <div className="pt-1">
      <div className="relative h-8">
        <div className="absolute inset-x-0 top-3 h-1 rounded bg-slate-200" />
        {/* the band you may price into: floor → target */}
        {w.targetPrice !== null && (
          <div className="absolute top-3 h-1 rounded bg-emerald-300"
               style={{ left: `${at(w.floor)}%`, width: `${Math.max(0, at(w.targetPrice) - at(w.floor))}%` }} />
        )}
        <Marker at={at(w.floor)} colour="bg-slate-700" label="floor" value={lei(w.floor)} />
        {w.targetPrice !== null && <Marker at={at(w.targetPrice)} colour="bg-emerald-600" label="target" value={lei(w.targetPrice)} />}
        <Marker at={at(w.direct)} colour={v.bar} label="direct" value={lei(w.direct)} strong />
        <Marker at={at(w.best.effective)} colour="bg-sky-600" label={w.best.channel} value={lei(w.best.effective)} />
      </div>
    </div>
  );
}

function Marker({ at, colour, label, value, strong }: { at: number; colour: string; label: string; value: string; strong?: boolean }) {
  return (
    <div className="absolute -translate-x-1/2 text-center" style={{ left: `${Math.max(2, Math.min(98, at))}%` }}>
      <div className={`mx-auto h-4 w-1 rounded ${colour}`} />
      <div className={`whitespace-nowrap text-[10px] leading-tight ${strong ? 'font-semibold' : ''}`}>
        {value}<span className="ml-1 text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

export function ParityPanel({ windows, summary, meta }: {
  windows: ParityWindow[]; summary: ParitySummaryShape; meta: { generatedAt: string; excluded: string[]; targetDiscountPct: number };
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = useMemo(
    () => (showAll ? windows : windows.filter((w) => w.verdict !== 'healthy' && w.verdict !== 'unknown')),
    [windows, showAll],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where you sit against the OTAs</CardTitle>
        <CardDescription>
          Guest-facing totals, compared like with like. Airbnb prices carry a correction for the standing
          top-rated-guests discount that no capture can see — the raw captured number is not what a guest pays.
          Target is {Math.round(meta.targetDiscountPct * 100)}% under the cheapest channel, never below your floor.
          {meta.excluded.length > 0 && ` ${meta.excluded.join(', ')} excluded.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Stat n={summary.losing}    label="losing"   tone="bg-red-100 text-red-900" />
          <Stat n={summary.overshoot} label="too low"  tone="bg-amber-100 text-amber-900" />
          <Stat n={summary.thin}      label="thin"     tone="bg-yellow-50 text-yellow-900" />
          <Stat n={summary.healthy}   label="ok"       tone="bg-green-100 text-green-900" />
          <Stat n={summary.partial}   label="partial"  tone="bg-slate-100 text-slate-700" />
          <Stat n={summary.unknown}   label="unknown"  tone="bg-slate-100 text-slate-500" />
        </div>

        {summary.partial + summary.unknown > 0 && (
          <p className="flex items-start gap-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {summary.partial + summary.unknown} window(s) are not fully measured. A verdict over a subset of
              channels can be wrong in the dangerous direction, so these deliberately show no verdict rather
              than borrowing one.
            </span>
          </p>
        )}

        <div className="space-y-2">
          {shown.map((w) => <Row key={w.key} w={w} />)}
          {!shown.length && <p className="text-sm text-muted-foreground">Nothing needing attention in the measured windows.</p>}
        </div>

        <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <span>{windows.length} forward window(s) measured · read {new Date(meta.generatedAt).toLocaleString('ro-RO')}</span>
          <Button variant="ghost" size="sm" onClick={() => setShowAll((s) => !s)}>
            <RefreshCw className="mr-1 h-3 w-3" />{showAll ? 'Only what needs attention' : `Show all ${windows.length}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className={`rounded px-3 py-1.5 text-sm ${tone}`}>
      <span className="font-semibold tabular-nums">{n}</span> <span className="text-xs">{label}</span>
    </div>
  );
}

function Row({ w }: { w: ParityWindow }) {
  const [open, setOpen] = useState(false);
  const v = VERDICT[w.verdict];
  return (
    <div className={`rounded border p-3 ${v.cls}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <Badge variant="outline" className="border-current bg-white/60 text-[11px]">{v.label}</Badge>
          <span className="font-medium tabular-nums">{w.checkIn} → {w.checkOut}</span>
          <span className="text-xs opacity-75">{w.nights}n · {w.guests} guests</span>
        </div>
        <div className="flex items-baseline gap-4 text-sm tabular-nums">
          <span>direct <strong>{lei(w.direct)}</strong></span>
          {w.best && <span className="opacity-80">{w.best.channel} {lei(w.best.effective)}</span>}
          <span className="font-semibold">{pct(w.gapPct)}</span>
        </div>
      </div>

      <PriceScale w={w} />

      {(w.verdict === 'losing' || w.verdict === 'thin') && w.targetPrice !== null && (
        <p className="mt-2 rounded bg-white/70 px-2 py-1.5 text-xs">
          To be {Math.round((1 - w.targetPrice / (w.best?.effective ?? 1)) * 100)}% under {w.best?.channel},
          direct would be <strong className="tabular-nums">{lei(w.targetPrice)}</strong> —
          that is <strong className="tabular-nums">{lei(w.targetPrice - (w.direct ?? 0))}</strong> from today,
          and still <strong className="tabular-nums">{lei((w.targetPrice) - (w.floor ?? 0))}</strong> above your floor.
        </p>
      )}
      {w.verdict === 'overshoot' && (
        <p className="mt-2 rounded bg-white/70 px-2 py-1.5 text-xs">
          Direct is <strong>below the floor of {lei(w.floor)}</strong>. At this price you would earn more by
          letting {w.best?.channel} take the booking.
        </p>
      )}

      <button onClick={() => setOpen((o) => !o)} className="mt-2 text-[11px] underline opacity-70">
        {open ? 'hide' : 'per-channel detail'} {w.warnings.length > 0 && `· ${w.warnings.length} note(s)`}
      </button>

      {open && (
        <div className="mt-2 space-y-2 border-t border-current/20 pt-2">
          <table className="w-full text-[11px] tabular-nums">
            <thead className="text-left opacity-70">
              <tr><th className="pb-1">channel</th><th>captured</th><th>effective</th><th>list</th><th>plan</th><th>age</th></tr>
            </thead>
            <tbody>
              {w.cells.map((c) => (
                <tr key={c.channel} className={c.stale ? 'opacity-50' : ''}>
                  <td className="py-0.5">{c.channel}</td>
                  <td>{c.status === 'captured' ? lei(c.captured) : <em className="not-italic opacity-70">{c.status}</em>}</td>
                  <td className={c.corrected ? 'font-semibold' : ''}>{lei(c.effective)}{c.corrected && ' *'}</td>
                  <td className="opacity-70">{lei(c.listTotal)}</td>
                  <td className="opacity-70">{c.ratePlan}</td>
                  <td className="opacity-70">{Number.isFinite(c.ageDays) ? `${c.ageDays}d` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {w.warnings.map((warn, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[11px] opacity-80">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{warn}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
