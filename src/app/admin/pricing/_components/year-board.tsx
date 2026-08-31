'use client';

/**
 * The year, as one picture you can point at.
 *
 * The owner's verdict on the four-tab version was: *"impossible to use and comprehend. I don't have a
 * real picture to see these dates are mispriced, this season / range is somehow wrong, click here to
 * update, I recommend to do that and that."* That sentence is the specification, and it has four parts:
 *
 *   a real picture      -> the calendar strip. Every forward night, coloured by how it stands against
 *                          the platforms. A bad stretch is a red BLOCK you see before you read anything.
 *   these dates         -> the night is the cell. Hovering one says what it costs and why.
 *   this range is wrong -> the period ribbon under each month. It is the thing that sets the price,
 *                          so it is the thing you click.
 *   I recommend that    -> the cards on top, ranked by money, each ending in a button that opens the
 *                          editor already filled in with the answer.
 *
 * DESIGN RULES, each one a reaction to something on the screens this replaces:
 *  - One colour scale, defined once, used by the cards, the calendar and the ribbon. Two panels
 *    disagreeing about the same window is what taught him not to trust the page.
 *  - Money sizes every problem. A 12% gap on a sold-out period costs nothing; the same gap across 39
 *    open nights is the autumn.
 *  - Plain thousands separators. `toLocaleString('ro-RO')` renders 1303 as "1.303", which reads as a
 *    decimal on an English page. That ambiguity has already caused one real bug here.
 *  - What is NOT known is drawn, not omitted. Uncovered nights are hatched and counted; the total that
 *    excludes them says so on its face.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight, CalendarOff, TrendingDown, Wrench } from 'lucide-react';
import { PeriodEditor, type EditorPeriod } from './period-editor';

export type BoardVerdict = 'losing' | 'level' | 'thin' | 'healthy' | 'overshoot' | 'unmeasured' | 'uncovered';

export interface BoardDay {
  date: string; price: number | null; available: boolean; isWeekend: boolean; flatRate: boolean;
  periodId: string | null; periodName: string | null; verdict: BoardVerdict; sourceName: string | null;
}
export interface BoardRecommendation {
  valueAtRisk: number; verdict: string; headline: string;
  conflictsWithFloor?: boolean; floorWeekday?: number | null;
  bindingStay?: { checkIn: string; checkOut: string; nights: number; guests: number; discountPct: number } | null;
  currentWeekend?: number | null; projectedWeekend?: number | null;
  staysMeasured?: number; worstGapAfter?: number | null; deepestGapAfter?: number | null; belowFloorAfter?: number;
  wantedWeekday: number; currentWeekday: number | null;
  lever: { kind: 'tier'; tier: string; weekday: number } | { kind: 'fixed'; weekday: number };
  evidence: { checkIn: string; checkOut: string; nights: number; guests: number;
              direct: number; bestChannel: string; bestPrice: number; ageDays: number } | null;
}
export interface BoardPeriodRow {
  id: string; name: string; startDate: string; endDate: string; tier: string;
  fixedNightPrice: number | null; flatRate: boolean; minStay: number | null;
  nights: number; booked: number; openNights: number; occupancyPct: number;
  weekdayPrice: number | null; weekendPrice: number | null; valueAtRisk: number;
  verdict: BoardVerdict; worstGapPct: number | null; measuredWindows: number; freshestAgeDays: number | null;
  recommendation: BoardRecommendation | null;
}
export interface BoardGap {
  startDate: string; endDate: string; nights: number; openNights: number; value: number; atBaseRate: boolean;
}
export interface YearBoardData {
  currency: string; basePrice: number; tierMultipliers: Record<string, number>; tiers: string[];
  days: BoardDay[]; periods: BoardPeriodRow[]; gaps: BoardGap[];
  summary: {
    periods: number; openNights: number; totalValueAtRisk: number;
    valueAtRiskLosing: number; valueAtRiskUnmeasured: number;
    uncoveredValue: number; uncoveredOpenNights: number; openNightsAll: number; totalValueAll: number;
  };
  meta: {
    generatedAt: string; parityAvailable: boolean; parityError: string | null;
    measuredWindows: number; horizonEnd: string | null; freshestReadingDays: number | null;
  };
}

/** One scale for the whole screen. Cards, calendar and ribbon all read from here. */
export const V: Record<BoardVerdict, { label: string; means: string; chip: string; fill: string; rail: string }> = {
  losing:     { label: 'You cost more',  means: 'A guest who compares finds your site dearer, books the platform, and you pay its commission.',
                chip: 'bg-red-100 text-red-900 border-red-200',        fill: 'bg-red-500',     rail: 'bg-red-500' },
  overshoot:  { label: 'You are too low', means: 'So cheap that after card fees you keep less than the platform would have paid you.',
                chip: 'bg-amber-100 text-amber-900 border-amber-200',  fill: 'bg-amber-400',   rail: 'bg-amber-500' },
  level:      { label: 'Same price',     means: 'Within 3% of the cheapest platform, so a guest has no reason to prefer booking with you.',
                chip: 'bg-orange-50 text-orange-900 border-orange-200', fill: 'bg-orange-300', rail: 'bg-orange-300' },
  thin:       { label: 'Barely cheaper', means: 'Cheaper than the platforms, but by less than the 10% you aim for.',
                chip: 'bg-yellow-50 text-yellow-800 border-yellow-200', fill: 'bg-yellow-300', rail: 'bg-yellow-400' },
  healthy:    { label: 'You are cheaper', means: 'Cheaper than every platform by at least your target, and you still keep more than they would pay you.',
                chip: 'bg-emerald-100 text-emerald-900 border-emerald-200', fill: 'bg-emerald-500', rail: 'bg-emerald-500' },
  unmeasured: { label: 'Not checked',    means: 'Nobody has compared these dates against the platforms. Unknown, not safe.',
                chip: 'bg-slate-100 text-slate-600 border-slate-200',  fill: 'bg-slate-300',   rail: 'bg-slate-300' },
  uncovered:  { label: 'No period',      means: 'These nights are on sale but no period sets their price. They fall back to the plain base rate.',
                chip: 'bg-slate-50 text-slate-500 border-dashed border-slate-300', fill: 'bg-slate-100', rail: 'bg-slate-200' },
};

/** Never `toLocaleString('ro-RO')`: "1.303" reads as a decimal on an English page. */
export const lei = (n: number | null | undefined) =>
  n === null || n === undefined ? '-' : Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const shortDate = (d: string) => { const [, m, day] = d.split('-'); return `${Number(day)} ${MONTHS[Number(m) - 1]}`; };
const daysInMonth = (ym: string) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };

export function YearBoard({ data, propertyId }: { data: YearBoardData; propertyId: string }) {
  const [editing, setEditing] = useState<{ period: EditorPeriod; prefill: BoardRecommendation | null } | null>(null);

  const byMonth = useMemo(() => {
    const m = new Map<string, BoardDay[]>();
    for (const d of data.days) {
      const ym = d.date.slice(0, 7);
      if (!m.has(ym)) m.set(ym, []);
      m.get(ym)!.push(d);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data.days]);

  const periodById = useMemo(() => new Map(data.periods.map((p) => [p.id, p])), [data.periods]);

  const todo = useMemo(
    () => data.periods.filter((p) => p.recommendation).sort((a, b) => b.valueAtRisk - a.valueAtRisk),
    [data.periods],
  );

  const openEditor = (p: BoardPeriodRow, prefill: BoardRecommendation | null) =>
    setEditing({
      period: {
        id: p.id, name: p.name, startDate: p.startDate, endDate: p.endDate, tier: p.tier,
        fixedNightPrice: p.fixedNightPrice, flatRate: p.flatRate, minStay: p.minStay,
        weekdayPrice: p.weekdayPrice, weekendPrice: p.weekendPrice, openNights: p.openNights,
        valueAtRisk: p.valueAtRisk, verdict: p.verdict, worstGapPct: p.worstGapPct,
      },
      prefill,
    });

  return (
    <div className="space-y-5">
      <Money data={data} />

      {todo.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Wrench className="h-4 w-4" /> Do this first
            <span className="font-normal text-muted-foreground">
              ranked by how much money is sitting behind it
            </span>
          </h2>
          <div className="grid gap-3 lg:grid-cols-3">
            {todo.slice(0, 3).map((p, i) => (
              <RecommendationCard key={p.id} rank={i + 1} p={p} currency={data.currency}
                                  onFix={() => openEditor(p, p.recommendation)} />
            ))}
          </div>
        </section>
      )}

      <YearStrip
        byMonth={byMonth}
        periodById={periodById}
        onPickPeriod={(id) => { const p = periodById.get(id); if (p) openEditor(p, p.recommendation); }}
      />

      {data.gaps.length > 0 && <Gaps gaps={data.gaps} horizonEnd={data.meta.horizonEnd} />}

      <PeriodTable periods={data.periods} onEdit={(p) => openEditor(p, p.recommendation)} />

      <p className="text-xs text-muted-foreground">
        {data.meta.measuredWindows} measured stay windows
        {data.meta.freshestReadingDays !== null && (
          data.meta.freshestReadingDays === 0
            ? ', read today'
            : `, newest reading ${data.meta.freshestReadingDays} day${data.meta.freshestReadingDays === 1 ? '' : 's'} old`
        )}. Checked {new Date(data.meta.generatedAt).toLocaleString('en-GB')}.
        {!data.meta.parityAvailable && ` No platform comparison available: ${data.meta.parityError}.`}
      </p>

      {editing && (
        <PeriodEditor
          propertyId={propertyId}
          period={editing.period}
          prefill={editing.prefill}
          currency={data.currency}
          tiers={data.tiers}
          tierMultipliers={data.tierMultipliers}
          basePrice={data.basePrice}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/**
 * The money, split the way it actually is rather than the way that looks tidiest.
 *
 * The screen this replaces headlined one number that silently excluded every night outside a period.
 * Here the uncovered money sits beside the covered money and is labelled, so the total is never a
 * quiet understatement.
 */
function Money({ data }: { data: YearBoardData }) {
  const s = data.summary;
  const seg = [
    { v: s.valueAtRiskLosing, cls: 'bg-red-500', label: 'you cost more' },
    { v: s.valueAtRiskUnmeasured, cls: 'bg-slate-400', label: 'never checked' },
    { v: s.uncoveredValue, cls: 'bg-slate-200', label: 'no period set' },
    { v: Math.max(0, s.totalValueAll - s.valueAtRiskLosing - s.valueAtRiskUnmeasured - s.uncoveredValue),
      cls: 'bg-emerald-500', label: 'priced where you want it' },
  ].filter((x) => x.v > 0);
  const total = Math.max(1, s.totalValueAll);

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-semibold tabular-nums">{lei(s.totalValueAll)} {data.currency}</span>
          <span className="text-sm text-muted-foreground">
            still to sell, across {s.openNightsAll} open nights between now and{' '}
            {data.meta.horizonEnd ? shortDate(data.meta.horizonEnd) : 'the end of the calendar'}
          </span>
        </div>

        <div className="flex h-3 w-full overflow-hidden rounded">
          {seg.map((x) => (
            <div key={x.label} className={x.cls} style={{ width: `${(x.v / total) * 100}%` }} title={`${x.label}: ${lei(x.v)}`} />
          ))}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {seg.map((x) => (
            <span key={x.label} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${x.cls}`} />
              <span className="font-medium tabular-nums">{lei(x.v)}</span>
              <span className="text-muted-foreground">{x.label}</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** A negative gap means cheaper than the platform, which is the direction that wins bookings. */
const fmtPct = (n: number | null | undefined) =>
  n === null || n === undefined ? '-' : `${n > 0 ? '+' : ''}${(n * 100).toFixed(0)}%`;

function PriceMove({ label, from, to }: { label: string; from: number | null; to: number }) {
  const moved = from !== null && Math.abs(from - to) >= 0.5;
  return (
    <div className="flex items-baseline gap-2 tabular-nums">
      {moved && <span className="text-muted-foreground line-through">{lei(from)}</span>}
      {moved && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      <span className="font-semibold">{lei(to)}</span>
      <span className="text-xs font-normal text-muted-foreground">per {label} night</span>
    </div>
  );
}

function RecommendationCard({ rank, p, currency, onFix }: {
  rank: number; p: BoardPeriodRow; currency: string; onFix: () => void;
}) {
  const r = p.recommendation!;
  const v = V[p.verdict];
  const canPrice = r.verdict !== 'unmeasured';
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              <span className="mr-1.5 text-muted-foreground">{rank}.</span>{p.name}
            </CardTitle>
            <CardDescription>
              {shortDate(p.startDate)} to {shortDate(p.endDate)} · {p.openNights} nights open
            </CardDescription>
          </div>
          <Badge variant="outline" className={`shrink-0 text-[11px] ${v.chip}`}>{v.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="text-2xl font-semibold tabular-nums">{lei(p.valueAtRisk)} {currency}</div>
        <p className="text-sm text-slate-700">{r.headline}</p>

        {canPrice && (
          <div className="rounded-md border bg-slate-50 p-2.5 text-sm">
            {/*
              BOTH nights, always. The first version printed only the weekday number, so a hand-set
              price that also took the weekend from 614 to 413 looked like a 60-lei change. The
              weekend is the bigger move and it was invisible until you opened the editor.
            */}
            <div className="space-y-1">
              <PriceMove label="weekday" from={r.currentWeekday} to={r.lever.weekday} />
              {r.projectedWeekend != null && (
                <PriceMove label="weekend" from={r.currentWeekend ?? null} to={r.projectedWeekend} />
              )}
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">
              {r.lever.kind === 'tier'
                ? `by moving this period to the "${r.lever.tier}" tier`
                : 'no tier reaches this, so it would be one price you set for every night, weekends included'}
            </div>

            {/*
              One nightly rate cannot put every stay at the same discount: each stay carries its own
              length-of-stay discount, extra-guest fee and platform price. Showing the spread is the
              honest answer, and it is what makes the floor count meaningful.
            */}
            {r.staysMeasured ? (
              <div className="mt-2 border-t pt-2 text-xs text-slate-600">
                Across the {r.staysMeasured} stays measured here, this would put you between{' '}
                <strong>{fmtPct(r.worstGapAfter)}</strong> and <strong>{fmtPct(r.deepestGapAfter)}</strong>{' '}
                against the cheapest platform.
                {r.belowFloorAfter ? (
                  <span className="text-amber-800">
                    {' '}On {r.belowFloorAfter} of them you would keep less than if the platform had
                    taken the booking.
                  </span>
                ) : null}
              </div>
            ) : null}

            {r.conflictsWithFloor && r.floorWeekday != null && (
              <div className="mt-2 border-t pt-2 text-xs text-amber-800">
                Being under the platforms everywhere needs <strong>{lei(r.lever.weekday)}</strong> a
                night. Never earning less than the platform would pay you needs at least{' '}
                <strong>{lei(r.floorWeekday)}</strong>
                {r.bindingStay && (
                  <>
                    , because of {shortDate(r.bindingStay.checkIn)} to {shortDate(r.bindingStay.checkOut)},{' '}
                    {r.bindingStay.nights} nights for {r.bindingStay.guests}
                    {r.bindingStay.discountPct > 0 &&
                      `, where your ${Math.round(r.bindingStay.discountPct * 100)}% long-stay discount comes off on top`}
                  </>
                )}. Both cannot be true. Which matters more is your call.
              </div>
            )}
          </div>
        )}

        {r.evidence && (
          <p className="text-xs text-muted-foreground">
            Measured on {shortDate(r.evidence.checkIn)} to {shortDate(r.evidence.checkOut)},{' '}
            {r.evidence.nights} nights for {r.evidence.guests}: you {lei(r.evidence.direct)},{' '}
            {r.evidence.bestChannel} {lei(r.evidence.bestPrice)}.{' '}
            {r.evidence.ageDays === 0 ? 'Read today.' : `Read ${r.evidence.ageDays} day${r.evidence.ageDays === 1 ? '' : 's'} ago.`}
          </p>
        )}

        {/*
          Deliberately NOT the brand red. On this screen red already means "you are losing money" —
          in the verdict chips, in the calendar cells and in the money bar. Three red CTAs alongside
          them made the page read as an alarm and made the one meaning ambiguous. One colour, one
          meaning: red is the problem, slate is the action.
        */}
        <Button className="mt-auto w-full bg-slate-900 text-white hover:bg-slate-800" onClick={onFix}>
          {canPrice ? 'Change this price' : 'Open this period'}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * The calendar strip: every forward night as a cell, one row per month.
 *
 * A linear 1..31 strip rather than a seven-column grid on purpose. Fourteen months of real calendar
 * grids is six screens tall and you cannot see a season in it; fourteen strips fit on one screen and a
 * bad stretch shows up as a solid block of colour before you read a single number.
 */
function YearStrip({ byMonth, periodById, onPickPeriod }: {
  byMonth: Array<[string, BoardDay[]]>;
  periodById: Map<string, BoardPeriodRow>;
  onPickPeriod: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">The year</CardTitle>
        <CardDescription>
          Every night you have on sale, coloured by whether a guest comparing you with Airbnb and
          Booking would book with you or with them. Hover a night to see what it costs and why.
          The bar under each month is the period that sets those prices: click it to change them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {/* A month whose only remaining night is today renders 30 empty boxes and reads as broken. */}
        {byMonth.filter(([, days]) => days.length > 1).map(([ym, days]) => (
          <MonthRow key={ym} ym={ym} days={days} periodById={periodById} onPickPeriod={onPickPeriod} />
        ))}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t pt-3 text-[11px]">
          {(Object.keys(V) as BoardVerdict[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5" title={V[k].means}>
              <span className={`h-3 w-3 rounded-sm ${V[k].fill} ${k === 'uncovered' ? 'border border-dashed border-slate-400' : ''}`} />
              <span className="text-slate-600">{V[k].label}</span>
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-slate-300 opacity-40 ring-1 ring-inset ring-slate-500" />
            <span className="text-slate-600">Already booked</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthRow({ ym, days, periodById, onPickPeriod }: {
  ym: string; days: BoardDay[]; periodById: Map<string, BoardPeriodRow>; onPickPeriod: (id: string) => void;
}) {
  const dim = daysInMonth(ym);
  const [y, m] = ym.split('-').map(Number);
  const byDay = new Map(days.map((d) => [Number(d.date.slice(8, 10)), d]));

  // Contiguous runs of one period, so the ribbon can be drawn and labelled once per range.
  const runs: Array<{ periodId: string | null; from: number; to: number }> = [];
  for (let d = 1; d <= dim; d++) {
    const pid = byDay.get(d)?.periodId ?? null;
    const last = runs[runs.length - 1];
    if (last && last.periodId === pid && last.to === d - 1) last.to = d;
    else runs.push({ periodId: pid, from: d, to: d });
  }

  return (
    <div className="flex items-start gap-2">
      <div className="w-16 shrink-0 pt-0.5 text-xs font-medium text-slate-600">
        {MONTHS[m - 1]} {String(y).slice(2)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex gap-[2px]">
          {Array.from({ length: dim }, (_, i) => i + 1).map((d) => {
            const day = byDay.get(d);
            if (!day) return <div key={d} className="h-6 flex-1 rounded-sm bg-slate-50" />;
            const v = V[day.verdict];
            const booked = !day.available;
            return (
              <div
                key={d}
                title={`${d} ${MONTHS[m - 1]} ${y}\n${day.price !== null ? `${lei(day.price)} per night` : 'no price'}${day.flatRate ? ' (whole house, any party size)' : ''}\n${day.periodName ?? 'No period sets this price'}\n${booked ? 'Already booked' : 'Open'}${day.sourceName ? `\nfrom: ${day.sourceName}` : ''}`}
                className={[
                  'relative h-6 min-w-0 flex-1 rounded-sm text-[9px] leading-6 text-center select-none',
                  v.fill,
                  day.verdict === 'uncovered' ? 'border border-dashed border-slate-400 text-slate-500' : 'text-white/85',
                  booked ? 'opacity-35 ring-1 ring-inset ring-slate-600' : '',
                  day.isWeekend ? 'font-semibold' : '',
                ].join(' ')}
              >
                {d}
              </div>
            );
          })}
        </div>
        <div className="mt-[3px] flex gap-[2px]">
          {runs.map((run) => {
            const p = run.periodId ? periodById.get(run.periodId) : null;
            const span = run.to - run.from + 1;
            return (
              <button
                key={`${run.from}`}
                type="button"
                disabled={!p}
                onClick={() => p && onPickPeriod(p.id)}
                style={{ flexGrow: span, flexBasis: 0 }}
                title={p ? `${p.name}: click to change this price` : 'No period sets these nights'}
                className={[
                  'h-4 min-w-0 truncate rounded-sm px-1 text-[9px] leading-4',
                  p ? `${V[p.verdict].rail} text-white/95 hover:brightness-110 cursor-pointer`
                    : 'border border-dashed border-slate-300 text-slate-400',
                ].join(' ')}
              >
                {span > 2 ? (p ? p.name : 'no period') : ''}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Uncovered runs, named as decisions rather than counted as a statistic. */
function Gaps({ gaps, horizonEnd }: { gaps: BoardGap[]; horizonEnd: string | null }) {
  const total = gaps.reduce((s, g) => s + g.value, 0);
  return (
    <Card className="border-slate-300">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarOff className="h-4 w-4" />
          {gaps.reduce((s, g) => s + g.openNights, 0)} open nights have no period setting their price
        </CardTitle>
        <CardDescription>
          They are on sale at {lei(total)} in total, priced at the plain base rate because no season or
          period covers them. Nothing is deciding what these nights are worth, and they are invisible to
          every comparison against the platforms.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-sm">
          {gaps.map((g) => (
            <li key={g.startDate} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{shortDate(g.startDate)} to {shortDate(g.endDate)}</span>
              <span className="text-muted-foreground">{g.openNights} of {g.nights} nights open,</span>
              <span className="tabular-nums font-medium">{lei(g.value)}</span>
              {g.atBaseRate && <span className="text-xs text-muted-foreground">at the bare base rate</span>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Fixing this means creating periods that cover them, which is the same job as pricing next year.
          {horizonEnd && ` The calendar currently runs to ${shortDate(horizonEnd)}.`}
        </p>
      </CardContent>
    </Card>
  );
}

function PeriodTable({ periods, onEdit }: { periods: BoardPeriodRow[]; onEdit: (p: BoardPeriodRow) => void }) {
  const maxRisk = Math.max(1, ...periods.map((p) => p.valueAtRisk));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Every period</CardTitle>
        <CardDescription>
          The ranges that set your prices, in order. Each one is a thing you can change.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pl-6">Period</th>
              <th className="py-2">Full</th>
              <th className="py-2 text-right">Weekday</th>
              <th className="py-2 text-right">Weekend</th>
              <th className="py-2 pl-4">If a guest compares</th>
              <th className="py-2 text-right">Still to sell</th>
              <th className="py-2 pr-6" />
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => {
              const v = V[p.verdict];
              return (
                <tr key={p.id} className="border-b last:border-0 align-middle">
                  <td className="py-2.5 pl-6">
                    <div className="flex items-center gap-2">
                      <span className={`h-7 w-1 rounded ${v.rail}`} />
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {shortDate(p.startDate)} to {shortDate(p.endDate)} · {p.nights}n ·{' '}
                          {p.fixedNightPrice !== null ? `set by hand${p.flatRate ? ', whole house' : ''}` : `tier ${p.tier}`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5">
                    <div className="flex w-24 items-center gap-1.5">
                      <div className="h-1.5 w-14 overflow-hidden rounded bg-slate-200">
                        <div className="h-full rounded bg-slate-700" style={{ width: `${p.occupancyPct}%` }} />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">{p.occupancyPct}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{lei(p.weekdayPrice)}</td>
                  <td className="py-2.5 text-right tabular-nums">{lei(p.weekendPrice)}</td>
                  <td className="py-2.5 pl-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[11px] ${v.chip}`}>{v.label}</Badge>
                      {p.worstGapPct !== null && (
                        <span className="text-xs font-medium tabular-nums">
                          {p.worstGapPct > 0 ? '+' : ''}{(p.worstGapPct * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="tabular-nums">{lei(p.valueAtRisk)}</div>
                    <div className="ml-auto mt-1 h-1 w-16 overflow-hidden rounded bg-slate-100">
                      <div className={`h-full rounded ${v.rail}`} style={{ width: `${(p.valueAtRisk / maxRisk) * 100}%` }} />
                    </div>
                  </td>
                  <td className="py-2.5 pr-6 text-right">
                    <Button size="sm" variant="outline" onClick={() => onEdit(p)}>Change</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export { TrendingDown, AlertTriangle };
