'use client';

/**
 * Changing what a period costs, with the consequence shown before anything is written.
 *
 * This is the control the pricing admin never had. The old Rules tab let the owner edit a season's
 * multiplier, but every live season carries `provenance.source: 'period-compiler'` and the next
 * compile re-emits it, so those edits were silently reverted. The edit belongs on the PERIOD, which
 * is what this writes.
 *
 * WHY A PREVIEW IS NOT OPTIONAL HERE. There is no staging environment: applying changes what a guest
 * is quoted on the live site. And the number the owner wants to move is a nightly rate, while the
 * number that decides whether he wins the booking is a guest-facing stay total with weekend
 * compounding, an occupancy ladder and a length-of-stay discount folded into it. Nobody can do that
 * arithmetic in their head, so the screen does it: which nights move, what a real guest would pay
 * before and after, and where that leaves him against the platform he is actually losing to.
 *
 * The projection is checked against reality before it is shown. Every sample stay was captured live
 * from the site; the server rebuilds that same total from the calendar and refuses to project when
 * the rebuild disagrees. A confident wrong number here costs real money.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, ArrowRight, Check, Loader2 } from 'lucide-react';
import { previewPeriodProposal, applyPeriodProposal } from '../year-actions';
import { V, lei, type BoardVerdict, type BoardRecommendation } from './year-board';

export interface EditorPeriod {
  id: string; name: string; startDate: string; endDate: string; tier: string;
  fixedNightPrice: number | null; flatRate: boolean; minStay: number | null;
  weekdayPrice: number | null; weekendPrice: number | null; openNights: number;
  valueAtRisk: number; verdict: BoardVerdict; worstGapPct: number | null;
}

interface SampleStay {
  checkIn: string; checkOut: string; nights: number; guests: number;
  from: number | null; to: number | null;
  bestChannel: string | null; bestPrice: number | null;
  currentGapPct: number | null; projectedGapPct: number | null;
  verified: boolean; belowFloor: boolean; floor: number | null;
}
interface Preview {
  changedNights: Array<{ date: string; from: number | null; to: number; available: boolean }>;
  unchangedNights: number;
  weekday: { from: number | null; to: number | null };
  weekend: { from: number | null; to: number | null };
  valueAtRisk: { from: number; to: number };
  worstGap: { from: number | null; to: number | null };
  belowFloorWindows: unknown[];
  unverifiableWindows: unknown[];
  sampleStays: SampleStay[];
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const shortDate = (d: string) => { const [, m, day] = d.split('-'); return `${Number(day)} ${MONTHS[Number(m) - 1]}`; };
const pct = (n: number | null) => (n === null ? '-' : `${n > 0 ? '+' : ''}${(n * 100).toFixed(1)}%`);

export function PeriodEditor({
  propertyId, period, prefill, currency, tiers, tierMultipliers, basePrice, onClose,
}: {
  propertyId: string; period: EditorPeriod; prefill: BoardRecommendation | null;
  currency: string; tiers: string[]; tierMultipliers: Record<string, number>; basePrice: number;
  onClose: () => void;
}) {
  // Prefilled with the recommendation when there is one, so the common case is "look, then apply"
  // rather than "work out the number yourself".
  const suggested = prefill?.lever ?? null;
  const [mode, setMode] = useState<'tier' | 'fixed'>(
    suggested?.kind === 'fixed' || period.fixedNightPrice !== null ? 'fixed' : 'tier');
  const [tier, setTier] = useState(suggested?.kind === 'tier' ? suggested.tier : period.tier);
  const [fixed, setFixed] = useState<string>(
    String(suggested?.kind === 'fixed' ? suggested.weekday : (period.fixedNightPrice ?? period.weekdayPrice ?? basePrice)));
  const [flatRate, setFlatRate] = useState(period.flatRate);
  const [minStay, setMinStay] = useState<string>(String(period.minStay ?? ''));

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const proposal = useCallback(() => ({
    tier,
    fixedNightPrice: mode === 'fixed' ? Number(fixed) || null : null,
    minStay: minStay.trim() === '' ? null : Number(minStay),
    flatRate: mode === 'fixed' ? flatRate : false,
  }), [mode, tier, fixed, flatRate, minStay]);

  useEffect(() => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    setConfirming(false);
    const t = setTimeout(async () => {
      const res = await previewPeriodProposal(propertyId, period.id, proposal());
      if (id !== seq.current) return; // a newer keystroke already won
      setLoading(false);
      if (res.ok) setPreview(res.preview as Preview);
      else { setPreview(null); setError(res.error ?? 'Could not work out what this would do.'); }
    }, 250);
    return () => clearTimeout(t);
  }, [propertyId, period.id, proposal]);

  const onApply = async () => {
    setLoading(true);
    const res = await applyPeriodProposal(propertyId, period.id, proposal());
    setLoading(false);
    if (res.ok) {
      const a = res.applied as { nightsChanged: number };
      setApplied(`Done. ${a.nightsChanged} night(s) repriced on the live site.`);
    } else {
      setError(res.error ?? 'Could not save.');
      setConfirming(false);
    }
  };

  const v = V[period.verdict];
  const changed = preview?.changedNights.length ?? 0;
  const moneyDelta = preview ? preview.valueAtRisk.to - preview.valueAtRisk.from : 0;

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="space-y-1">
          <SheetTitle className="flex items-center gap-2">
            {period.name}
            <Badge variant="outline" className={`text-[11px] ${v.chip}`}>{v.label}</Badge>
          </SheetTitle>
          <SheetDescription>
            {shortDate(period.startDate)} to {shortDate(period.endDate)} · {period.openNights} nights open ·{' '}
            {lei(period.valueAtRisk)} {currency} still to sell
          </SheetDescription>
        </SheetHeader>

        {prefill && (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="text-slate-700">{prefill.headline}</p>
            {prefill.conflictsWithFloor && prefill.floorWeekday != null && (
              <p className="mt-1.5 text-xs text-amber-800">
                These two goals conflict here. Undercutting the platforms by your usual margin means{' '}
                {lei(prefill.lever.weekday)} a night; keeping every measured stay worth more to you than
                the platform booking needs at least {lei(prefill.floorWeekday)}. The table below shows
                what each stay does, so you can see which stays you would be giving away.
              </p>
            )}
            {prefill.evidence && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                From a real comparison of {shortDate(prefill.evidence.checkIn)} to{' '}
                {shortDate(prefill.evidence.checkOut)}, {prefill.evidence.nights} nights for{' '}
                {prefill.evidence.guests} guests: you {lei(prefill.evidence.direct)},{' '}
                {prefill.evidence.bestChannel} {lei(prefill.evidence.bestPrice)}.
              </p>
            )}
          </div>
        )}

        {/* ---- the lever ---- */}
        <div className="mt-5 space-y-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">How this period is priced</div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={mode === 'tier' ? 'default' : 'outline'} onClick={() => setMode('tier')}>
                A demand tier
              </Button>
              <Button type="button" size="sm" variant={mode === 'fixed' ? 'default' : 'outline'} onClick={() => setMode('fixed')}>
                One price I set myself
              </Button>
            </div>
          </div>

          {mode === 'tier' ? (
            <div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {tiers.map((t) => {
                  const weekday = Math.round(basePrice * (tierMultipliers[t] ?? 1));
                  return (
                    <button key={t} type="button" onClick={() => setTier(t)}
                      className={[
                        'rounded-md border px-2 py-1.5 text-center transition',
                        t === tier ? 'border-slate-900 bg-slate-900 text-white' : 'hover:border-slate-400',
                      ].join(' ')}>
                      <div className="text-[11px] capitalize opacity-80">{t}</div>
                      <div className="text-sm font-semibold tabular-nums">{lei(weekday)}</div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                A tier is a multiple of your base rate of {lei(basePrice)}. Weekends are worked out from
                the weekday price automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor="fx">Price per night</Label>
                  <Input id="fx" type="number" className="w-36" value={fixed}
                         onChange={(e) => setFixed(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Switch id="flat" checked={flatRate} onCheckedChange={setFlatRate} />
                  <Label htmlFor="flat" className="text-sm font-normal">
                    Same price whatever the party size
                  </Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                A price you set yourself applies to every night in the period, weekends included, and
                replaces the tier entirely. This is how Christmas and New Year are priced.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="ms">Shortest stay you will take (nights)</Label>
            <Input id="ms" type="number" className="w-28" value={minStay} placeholder="none"
                   onChange={(e) => setMinStay(e.target.value)} />
          </div>
        </div>

        {/* ---- the consequence ---- */}
        <div className="mt-6 border-t pt-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            What this would do
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>

          {error && (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">{error}</p>
          )}

          {preview && !error && (
            <div className="space-y-4">
              {changed === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing changes. These are the prices this period already has.
                </p>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Delta label="Weekday night" from={preview.weekday.from} to={preview.weekday.to} />
                    <Delta label="Weekend night" from={preview.weekend.from} to={preview.weekend.to} />
                    <div className="rounded-md border p-2.5">
                      <div className="text-[11px] text-muted-foreground">Still to sell</div>
                      <div className="flex items-baseline gap-1.5 tabular-nums">
                        <span className="text-muted-foreground line-through">{lei(preview.valueAtRisk.from)}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-semibold">{lei(preview.valueAtRisk.to)}</span>
                      </div>
                      <div className={`text-[11px] ${moneyDelta < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {moneyDelta > 0 ? '+' : ''}{lei(moneyDelta)} {currency} if it all sells
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-slate-700">
                    <strong>{changed} night{changed === 1 ? '' : 's'}</strong> would change price
                    {preview.unchangedNights > 0 && `, ${preview.unchangedNights} stay the same`}.
                  </p>

                  {preview.sampleStays.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-slate-700">
                        What a real guest would pay, on the stays actually measured
                      </p>
                      <div className="overflow-hidden rounded-md border">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 text-left text-muted-foreground">
                            <tr>
                              <th className="px-2 py-1.5 font-medium">Stay</th>
                              <th className="px-2 py-1.5 font-medium text-right">You now</th>
                              <th className="px-2 py-1.5 font-medium text-right">You after</th>
                              <th className="px-2 py-1.5 font-medium text-right">Cheapest platform</th>
                              <th className="px-2 py-1.5 font-medium text-right">Gap</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.sampleStays.map((s) => (
                              <tr key={`${s.checkIn}-${s.guests}`} className="border-t">
                                <td className="px-2 py-1.5">
                                  {shortDate(s.checkIn)} to {shortDate(s.checkOut)}
                                  <span className="text-muted-foreground"> · {s.guests}p</span>
                                </td>
                                <td className="px-2 py-1.5 text-right tabular-nums">{lei(s.from)}</td>
                                <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                                  {s.verified ? lei(s.to) : <span className="text-muted-foreground">not checkable</span>}
                                </td>
                                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                  {lei(s.bestPrice)} {s.bestChannel && <span className="text-[10px]">{s.bestChannel}</span>}
                                </td>
                                <td className={[
                                  'px-2 py-1.5 text-right tabular-nums font-medium',
                                  s.projectedGapPct === null ? 'text-muted-foreground'
                                    : s.projectedGapPct > 0.03 ? 'text-red-700'
                                    : s.belowFloor ? 'text-amber-700' : 'text-emerald-700',
                                ].join(' ')}>
                                  {pct(s.currentGapPct)}
                                  {s.projectedGapPct !== null && <> {'->'} {pct(s.projectedGapPct)}</>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        A negative gap means you are cheaper than the platform, which is what you want.
                      </p>
                    </div>
                  )}

                  {mode === 'fixed' && preview.weekend.from !== null && preview.weekday.from !== null
                    && preview.weekend.from > preview.weekday.from + 0.5
                    && preview.weekend.to !== null && preview.weekday.to !== null
                    && Math.abs(preview.weekend.to - preview.weekday.to) < 0.5 && (
                    <p className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      This removes your weekend premium across the whole period. Weekends currently go
                      out at {lei(preview.weekend.from)} against {lei(preview.weekday.from)} on a
                      weekday; one price you set yourself applies to every night equally, so Fridays and
                      Saturdays would drop to {lei(preview.weekend.to)} as well. A tier keeps the
                      weekend uplift, if one of them lands close enough.
                    </p>
                  )}

                  {preview.belowFloorWindows.length > 0 && (
                    <p className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      On {preview.belowFloorWindows.length} of these stays this price would leave you
                      keeping less than if the platform had taken the booking and charged you its
                      commission. You would be discounting past the point where direct is worth it.
                    </p>
                  )}

                  {preview.unverifiableWindows.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {preview.unverifiableWindows.length} measured stay(s) could not be projected,
                      because rebuilding today&rsquo;s price for them did not match what the live site
                      actually quoted. They are left out rather than guessed at.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ---- the commitment ---- */}
        <div className="sticky bottom-0 mt-6 border-t bg-background py-4">
          {applied ? (
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <Check className="h-4 w-4" />{applied}
              </p>
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          ) : confirming ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-800">
                This changes what guests are quoted on your live site, straight away. {changed} night
                {changed === 1 ? '' : 's'} will be repriced.
              </p>
              <div className="flex gap-2">
                <Button onClick={onApply} disabled={loading}>
                  {loading ? 'Applying...' : 'Yes, change the prices'}
                </Button>
                <Button variant="outline" onClick={() => setConfirming(false)} disabled={loading}>
                  Not yet
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button onClick={() => setConfirming(true)} disabled={loading || !preview || changed === 0}>
                Apply to {changed} night{changed === 1 ? '' : 's'}
              </Button>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Delta({ label, from, to }: { label: string; from: number | null; to: number | null }) {
  const moved = from !== null && to !== null && Math.abs(from - to) >= 0.5;
  return (
    <div className="rounded-md border p-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1.5 tabular-nums">
        {moved ? (
          <>
            <span className="text-muted-foreground line-through">{lei(from)}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-semibold">{lei(to)}</span>
          </>
        ) : (
          <span className="font-semibold">{lei(to ?? from)}</span>
        )}
      </div>
    </div>
  );
}
