import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle, Info, ChevronRight } from 'lucide-react';

/**
 * Where you sit, as a board rather than a set of ladders.
 *
 * The first version of this screen showed, per window, every competitor price with our row marked.
 * The owner's verdict was that he could not read his position quickly, and the December capture
 * showed the problem was not layout: *"30 Dec – 2 Jan, you 7,243, dearest of 4"* is true and points
 * the wrong way, because ten of the thirteen comparables had nothing left. The ladder was ranking us
 * against the leftovers.
 *
 * So the screen is built on the two axes in `lib/competitive/board.ts` — where the price sits AND how
 * much of the field is still on sale — and every row leads with the verdict those two produce.
 *
 * THE RULES OF THIS LAYOUT, each one load-bearing:
 *
 *  - **Only two colours mean anything.** Red for money being left, amber for real exposure. Everything
 *    else is quiet. A screen where five things are urgent has nothing urgent on it, which is what the
 *    owner was describing.
 *  - **"On sale" is never off-screen.** It is the number that decides what a rank MEANS, so it sits
 *    beside the rank rather than in a footnote.
 *  - **The gap is a percentage.** Totals are not comparable across 3-, 4- and 5-night windows; a
 *    percentage is the only figure that scans down a column.
 *  - **The evidence is one click away, not gone.** `<details>` keeps the ladder available without a
 *    client component and without a wall of numbers.
 *
 * Read-only. Nothing here feeds a rate, and it never proposes a price (C2).
 */

interface LadderRow {
  listingId: string; name: string; total: number; isUs: boolean; promo: boolean;
  rating: number | null; reviewCount: number | null;
}

export interface MarketRow {
  key: string;
  checkIn: string; checkOut: string; nights: number;
  partyLabel: string;
  channel: string; channelLabel: string;
  ourPrice: number | null; ourDirect: number | null;
  fieldMedian: number | null; fieldMin: number | null; fieldMax: number | null;
  gapPct: number | null; aboveAll: boolean;
  quoted: number; eligible: number; nothingLeft: number; cantHost: number; unread: number;
  onSaleShare: number | null;
  position: 'dear' | 'level' | 'cheap' | 'unknown';
  scarcity: 'tight' | 'mixed' | 'open' | 'unknown';
  attention: 'act' | 'watch' | 'ok' | 'thin';
  label: string; why: string;
  atStake: number; fullySold: boolean;
  oldestAgeDays: number | null;
  detail: {
    rank: { position: number; of: number } | null;
    confidence: string;
    ladder: LadderRow[];
    silent: Array<{ listingId: string; name: string; status: string; reason: string }>;
    outOfSet: Array<{ listingId: string; name: string; why: string }>;
    unreadNames: Array<{ listingId: string; name: string }>;
    flags: string[]; notes: string[];
    absorption: {
      started: boolean; summary: string;
      wentOffSale: Array<{ name: string; lastPrice: number | null; between: [string, string] }>;
      parksSoldOut: Array<{ name: string; between: [string, string] }>;
    };
  } | null;
}

export interface MarketSummary {
  windows: number; channelReadings: number; act: number; watch: number; headline: string;
}

const money = (n: number) => Math.round(n).toLocaleString('en-US');
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const day = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
};

const TONE = {
  act:   { chip: 'bg-red-600 text-white', edge: 'border-l-4 border-l-red-600', loud: true },
  watch: { chip: 'bg-amber-500 text-white', edge: 'border-l-4 border-l-amber-500', loud: true },
  ok:    { chip: 'bg-slate-100 text-slate-700 border border-slate-300', edge: 'border-l-4 border-l-transparent', loud: false },
  thin:  { chip: 'bg-slate-100 text-slate-500 border border-dashed border-slate-300', edge: 'border-l-4 border-l-transparent', loud: false },
} as const;

/** On-sale share, as ten blocks. The single most misread number on the old screen. */
function OnSale({ quoted, asked }: { quoted: number; asked: number }) {
  if (!asked) return <span className="text-muted-foreground text-xs">not read</span>;
  const filled = Math.max(1, Math.round((quoted / asked) * 10));
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="font-mono text-[11px] leading-none tracking-[-1px]" aria-hidden>
        <span className="text-slate-800">{'█'.repeat(filled)}</span>
        <span className="text-slate-300">{'█'.repeat(10 - filled)}</span>
      </span>
      <span className="text-xs tabular-nums">
        {quoted} of {asked}<span className="text-muted-foreground"> on sale</span>
      </span>
    </span>
  );
}

function Row({ r }: { r: MarketRow }) {
  const tone = TONE[r.attention];
  const asked = r.quoted + r.nothingLeft;
  const d = r.detail;

  return (
    <details className={`group ${tone.edge} ${r.fullySold ? 'opacity-55' : ''}`}>
      <summary className="cursor-pointer list-none px-3 py-2.5 hover:bg-muted/40">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          <span className="w-[9.5rem] shrink-0 text-sm font-semibold">
            {day(r.checkIn)} &ndash; {day(r.checkOut)}
          </span>
          <span className="w-24 shrink-0 text-xs text-muted-foreground">{r.nights}n &middot; {r.partyLabel}</span>
          <span className="w-24 shrink-0 text-xs">{r.channelLabel}</span>

          <span className="w-20 shrink-0 text-right text-sm tabular-nums">
            {r.ourPrice !== null ? money(r.ourPrice) : '—'}
          </span>
          <span className={`w-16 shrink-0 text-right text-sm tabular-nums ${
            r.gapPct === null ? 'text-muted-foreground' : r.gapPct > 0 ? 'text-slate-900' : 'text-slate-500'}`}>
            {r.gapPct === null ? '—' : `${r.gapPct > 0 ? '+' : ''}${Math.round(r.gapPct)}%`}
          </span>

          <span className="w-44 shrink-0"><OnSale quoted={r.quoted} asked={asked} /></span>

          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${tone.chip}`}>{r.label}</span>

          {r.atStake > 0 && (
            <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
              {money(r.atStake)} riding on it
            </span>
          )}
        </div>

        {/* The reasoning is only pushed at you when the row is asking for something. */}
        {tone.loud && <p className="ml-7 mt-1.5 max-w-4xl text-xs text-slate-700">{r.why}</p>}
      </summary>

      <div className="space-y-3 px-3 pb-4 pl-10 text-xs">
        {!tone.loud && <p className="max-w-4xl text-slate-700">{r.why}</p>}

        {d && (
          <>
            <div className="text-muted-foreground">
              {d.rank && <>You are {d.rank.position} of {d.rank.of} on {r.channelLabel} &middot; </>}
              {r.fieldMedian !== null && (
                <>the field {money(r.fieldMin!)} &ndash; {money(r.fieldMax!)}, median {money(r.fieldMedian)} &middot; </>
              )}
              confidence {d.confidence}
              {r.oldestAgeDays !== null && <> &middot; oldest reading {r.oldestAgeDays}d</>}
              {r.ourDirect !== null && (
                <> &middot; direct {money(r.ourDirect)}, which no guest on {r.channelLabel} sees</>
              )}
            </div>

            <div className="space-y-0.5">
              {d.ladder.map((row) => (
                <div key={row.listingId} className={`flex gap-2 ${row.isUs ? 'font-semibold' : ''}`}>
                  <span className="w-3 shrink-0">{row.isUs ? '▸' : ''}</span>
                  <span className="w-16 shrink-0 text-right tabular-nums">{money(row.total)}</span>
                  <span className="flex-1 truncate">{row.name}</span>
                  {row.promo && <span className="shrink-0 text-muted-foreground">promo</span>}
                  {row.rating != null && (
                    <span className="w-16 shrink-0 text-right text-muted-foreground">
                      {row.rating}{row.reviewCount != null && `/${row.reviewCount}`}
                    </span>
                  )}
                </div>
              ))}
              {/* Never dropped: the reason a comparable is silent IS the finding. */}
              {d.silent.map((s) => (
                <div key={s.listingId} className="flex gap-2 text-muted-foreground">
                  <span className="w-3 shrink-0" />
                  <span className="w-16 shrink-0 text-right">&mdash;</span>
                  <span className="flex-1 truncate" title={s.reason}>{s.name}</span>
                  <span className="shrink-0">{s.status}</span>
                </div>
              ))}
            </div>

            {d.outOfSet.length > 0 && (
              <div className="text-muted-foreground">
                <strong>{d.outOfSet.length} cannot host {r.partyLabel}</strong> &mdash; competition you do
                not face on this window: {d.outOfSet.map((o) => o.name).join(', ')}
              </div>
            )}
            {d.unreadNames.length > 0 && (
              <div className="text-amber-700">
                <strong>{d.unreadNames.length} never read for this window</strong> &mdash; unknown, not
                absent: {d.unreadNames.map((u) => u.name).join(', ')}
              </div>
            )}

            <div className="rounded-md border bg-muted/40 p-2">
              <strong>{d.absorption.started ? 'Is it selling? ' : 'Selling, over time: '}</strong>
              {d.absorption.summary}
              {d.absorption.wentOffSale.map((x) => (
                <div key={x.name} className="mt-1">
                  &middot; {x.name} &mdash; last priced {x.lastPrice != null ? money(x.lastPrice) : '?'} on{' '}
                  {x.between[0].slice(0, 10)}, gone by {x.between[1].slice(0, 10)}
                </div>
              ))}
              {d.absorption.parksSoldOut.map((x) => (
                <div key={x.name} className="mt-1">
                  &middot; {x.name} &mdash; <strong>every unit</strong> gone between{' '}
                  {x.between[0].slice(0, 10)} and {x.between[1].slice(0, 10)} (a park, so reported apart)
                </div>
              ))}
            </div>

            {d.flags.map((f) => (
              <div key={f} className="flex gap-1.5 text-red-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{f}</span>
              </div>
            ))}
            {d.notes.map((n) => (
              <div key={n} className="flex gap-1.5 text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{n}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </details>
  );
}

export function MarketPanel({ rows, summary }: { rows: MarketRow[]; summary: MarketSummary }) {
  if (!rows.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Where you sit</CardTitle>
          <CardDescription>
            No competitor prices captured yet. A run takes a few minutes and needs your signed-in
            browser &mdash; there is no API for this, so it cannot happen on its own.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <div><code>npx tsx scripts/comp-search.ts --in 2026-12-30 --out 2027-01-02 --party 2a1c</code></div>
          <div>or ask for the <strong>competitive-position</strong> skill by name.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Where you sit</CardTitle>
        <CardDescription className="text-base text-foreground">{summary.headline}</CardDescription>
        {/*
          The mental model, in one line. Without it the board reads as a table of prices, which is the
          thing that read as noise — and the whole point is that neither axis means much alone.
        */}
        <CardDescription>
          Two things decide a window: <strong>where your price sits</strong>, and{' '}
          <strong>how much of the field is still on sale</strong>. Being dearest of a field that has
          sold out is not the same as being overpriced &mdash; it is nearly the opposite. One contest
          per channel, never pooled; competitor prices are context for your decision and never change
          a rate.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <div className="divide-y">
          {rows.map((r) => <Row key={`${r.key}|${r.channel}`} r={r} />)}
        </div>
      </CardContent>
    </Card>
  );
}
