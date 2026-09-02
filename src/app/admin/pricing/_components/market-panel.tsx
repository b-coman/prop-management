import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle, Info, ChevronRight, ExternalLink } from 'lucide-react';

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
  listTotal?: number | null; capturedAt?: string; url?: string;
  echo?: { checkIn?: string | null; checkOut?: string | null; nights?: number | null;
           adults?: number | null; children?: number | null; verified?: boolean };
  listingUrl?: string | null; photo?: string | null; basis?: string | null;
  sleeps?: number | null; sqm?: number | null;
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

export interface PeriodGroupView {
  period: { id: string; name: string; startDate: string; endDate: string } | null;
  windows: Array<{ key: string; checkIn: string; checkOut: string; nights: number;
                   nightsInside: number; rows: MarketRow[] }>;
  unsoldMoney: number;
  openNights: number;
  alsoSampledBy: Array<{ key: string; checkIn: string; checkOut: string; nightsInside: number }>;
}

export interface GridColumn { channel: string; channelLabel: string; partyLabel: string }

export interface MarketSummary {
  windows: number; channelReadings: number; act: number; watch: number; headline: string;
}

const money = (n: number) => Math.round(n).toLocaleString('en-US');
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const day = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
};

/**
 * The row template, used by the header AND every window row.
 *
 * Both must be laid out by the same grid or the columns drift: the first build put the date, the
 * optional "(4 of 5 nights here)" note and the tiles in a flex row, so a window carrying that note
 * pushed its tiles sideways and Christmas no longer lined up with Fall — or with the header, which
 * was offset by its own guessed spacer widths. A column that does not line up is not a column.
 */
const rowTemplate = (n: number) => ({ gridTemplateColumns: `11rem 8rem repeat(${n}, 5.5rem) 1fr` });

const TONE = {
  act:   { chip: 'bg-red-600 text-white', edge: 'border-l-4 border-l-red-600', loud: true },
  watch: { chip: 'bg-amber-500 text-white', edge: 'border-l-4 border-l-amber-500', loud: true },
  ok:    { chip: 'bg-slate-100 text-slate-700 border border-slate-300', edge: 'border-l-4 border-l-transparent', loud: false },
  thin:  { chip: 'bg-slate-100 text-slate-500 border border-dashed border-slate-300', edge: 'border-l-4 border-l-transparent', loud: false },
} as const;

/**
 * On-sale share — and what is still UNKNOWN.
 *
 * This drew `quoted / (quoted + nothingLeft)`, which for 22-28 Sep was 3 of 3: a completely full bar
 * on the exact row `classify()` returns `scarcity: 'unknown'` for, because four more comparables had
 * never been read. The model refused to guess and the display guessed for it — the loudest possible
 * contradiction, on the axis the whole board turns on.
 *
 * The unread share is now drawn as its own hatched segment and named in the text. A reader can see at
 * a glance that the bar is not finished being measured.
 */
function OnSale({ quoted, asked, unread }: { quoted: number; asked: number; unread: number }) {
  const field = asked + unread;
  if (!field) return <span className="text-muted-foreground text-xs">not read</span>;
  const px = (n: number) => Math.round((n / field) * 10);
  const on = Math.max(quoted > 0 ? 1 : 0, px(quoted));
  const unknown = unread > 0 ? Math.max(1, px(unread)) : 0;
  const gone = Math.max(0, 10 - on - unknown);
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="font-mono text-[11px] leading-none tracking-[-1px]" aria-hidden>
        <span className="text-slate-800">{'█'.repeat(on)}</span>
        <span className="text-slate-300">{'█'.repeat(gone)}</span>
        <span className="text-amber-400">{'▒'.repeat(unknown)}</span>
      </span>
      <span className="text-xs tabular-nums">
        {/* "0 of 0 on sale" is not a reading, it is the absence of one. Say so. */}
        {asked === 0
          ? <span className="text-amber-700">none read &middot; {unread} to probe</span>
          : <>
              {quoted} of {asked}<span className="text-muted-foreground"> on sale</span>
              {unread > 0 && <span className="text-amber-700"> +{unread}?</span>}
            </>}
      </span>
    </span>
  );
}

const daysSince = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
const longDay = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
  void y;
};

/**
 * "Can I trust this number?" — answered in four sentences and two links.
 *
 * The owner asked to be able to check the numbers himself. So this leads with HIS OWN reason for
 * curating the listing, then when the price was read, then what the page said it was quoting, then
 * the link that reproduces the search.
 *
 * The line about live prices is load-bearing and must stay ABOVE the links. The first time Booking
 * shows a different number he will conclude the screen is broken; saying so first turns a mismatch
 * from an apparent bug into the movement this board exists to watch.
 */
function Verify({ row, party }: { row: LadderRow; party: string }) {
  const age = row.capturedAt ? daysSince(row.capturedAt) : null;
  const e = row.echo;
  const stayBack = e?.verified && (e.nights || e.checkIn)
    ? `The page quoted this exact stay back: ${e.checkIn ? `${longDay(e.checkIn)} – ${longDay(e.checkOut!)}, ` : ''}` +
      `${party}${e.nights ? `, ${e.nights} nights` : ''}.`
    : null;

  return (
    <div className="mt-1 rounded-md border bg-background p-3">
      <div className="flex gap-3">
        {row.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.photo} alt="" className="h-16 w-24 shrink-0 rounded object-cover" />
        )}
        <div className="min-w-0">
          <div className="font-semibold">{row.name}</div>
          <div className="text-muted-foreground">
            {[row.sqm && `${row.sqm} m²`, row.sleeps && `sleeps ${row.sleeps}`,
              row.rating != null && `${row.rating}${row.reviewCount != null ? ` (${row.reviewCount} reviews)` : ''}`]
              .filter(Boolean).join(' · ')}
          </div>
          {row.basis && <div className="mt-1 max-w-xl">In your set because: {row.basis}</div>}
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {row.capturedAt && (
          <div>
            Read {longDay(row.capturedAt)}{age !== null && age > 0 && ` — ${age} day${age === 1 ? '' : 's'} ago`}
            {age === 0 && ' — today'}.
          </div>
        )}
        {stayBack
          ? <div>{stayBack}</div>
          : <div className="text-muted-foreground">
              Read before we began saving the page&apos;s own confirmation of the stay. The link below
              reproduces the search exactly if you want to check it.
            </div>}
        {row.listTotal != null && row.listTotal > row.total && (
          <div>
            {money(row.total)} is the total with their promotion applied; the page lists{' '}
            {money(row.listTotal)} before it, so you will see both numbers there.
          </div>
        )}
      </div>

      <div className="mt-2">
        <div className="text-muted-foreground">
          Prices there are live. A different number means the market has moved since{' '}
          {row.capturedAt ? longDay(row.capturedAt) : 'the reading'} — that movement is what this
          screen watches — and if they no longer appear at all, they have sold out since.
        </div>
        <div className="mt-1 flex flex-wrap gap-4">
          {row.url && (
            <a href={row.url} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
              Open this exact search <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {row.listingUrl && (
            <a href={row.listingUrl} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 underline underline-offset-2">
              Open {row.name.split(/[·,|]/)[0].trim()}&apos;s page <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
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
          {/* The window is named by the row above; repeating it six times is noise. */}
          <span className="w-28 shrink-0 text-sm font-semibold">{r.channelLabel}</span>
          <span className="w-20 shrink-0 text-xs text-muted-foreground">{r.partyLabel}</span>

          <span className="w-20 shrink-0 text-right text-sm tabular-nums">
            {r.ourPrice !== null ? money(r.ourPrice) : '—'}
          </span>
          <span className={`w-16 shrink-0 text-right text-sm tabular-nums ${
            r.gapPct === null ? 'text-muted-foreground' : r.gapPct > 0 ? 'text-slate-900' : 'text-slate-500'}`}>
            {r.gapPct === null ? '—' : `${r.gapPct > 0 ? '+' : ''}${Math.round(r.gapPct)}%`}
          </span>

          {/* Widened twice by measurement, never by eye: w-44 clipped the "+4?" unread marker, and
              w-52 clipped "none read". Screenshots time out here, so this is read off the live DOM. */}
          <span className="w-56 shrink-0"><OnSale quoted={r.quoted} asked={asked} unread={r.unread} /></span>

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
              {d.ladder.map((row) => row.isUs ? (
                <div key={row.listingId} className="flex gap-2 font-semibold">
                  <span className="w-3 shrink-0">▸</span>
                  <span className="w-16 shrink-0 text-right tabular-nums">{money(row.total)}</span>
                  <span className="flex-1 truncate">{row.name}</span>
                </div>
              ) : (
                // Every competitor price opens into its own evidence — the owner checks rather than
                // trusts, and the number should carry what it takes to check it.
                <details key={row.listingId} className="group/v">
                  <summary className="flex cursor-pointer list-none gap-2 hover:bg-muted/40">
                    <span className="w-3 shrink-0 text-muted-foreground group-open/v:rotate-90">›</span>
                    <span className="w-16 shrink-0 text-right tabular-nums">{money(row.total)}</span>
                    <span className="flex-1 truncate">{row.name}</span>
                    {row.promo && <span className="shrink-0 text-muted-foreground">promo</span>}
                    {row.rating != null && (
                      <span className="w-16 shrink-0 text-right text-muted-foreground">
                        {row.rating}{row.reviewCount != null && `/${row.reviewCount}`}
                      </span>
                    )}
                  </summary>
                  <Verify row={row} party={r.partyLabel} />
                </details>
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

/**
 * One period: his lever, its dates, what has been read, and the money once.
 *
 * A period deliberately carries NO verdict. Rolling contests up across channels is one step from
 * pooling them (C8), so the colour stays down at the contest where it was measured, and the heading
 * reports counts and money only.
 */
function Period({ g, columns }: { g: PeriodGroupView; columns: GridColumn[] }) {
  const p = g.period;
  const contests = g.windows.reduce((n, w) => n + w.rows.length, 0);
  const loud = g.windows.flatMap((w) => w.rows).filter((r) => r.attention === 'act' || r.attention === 'watch').length;
  return (
    <section id={p ? `p-${p.id}` : undefined} className="border-t first:border-t-0">
      <header className="flex flex-wrap items-baseline gap-x-3 bg-muted/40 px-3 py-1.5">
        <h3 className="text-sm font-semibold uppercase tracking-wide">{p ? p.name : 'Outside your periods'}</h3>
        {p && <span className="text-xs text-muted-foreground">{day(p.startDate)} &ndash; {day(p.endDate)}</span>}
        <span className="text-xs text-muted-foreground">
          {g.windows.length
            ? `${g.windows.length} window${g.windows.length === 1 ? '' : 's'} read · ${contests} contest${contests === 1 ? '' : 's'}`
            : 'nothing read here'}
        </span>
        {g.unsoldMoney > 0 && (
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {money(g.unsoldMoney)} unsold over {g.openNights} night{g.openNights === 1 ? '' : 's'}
          </span>
        )}
      </header>

      {g.windows.map((w) => (
        <details key={w.key} id={`w-${w.key.replace(/\|/g, '_')}`} className="group border-t">
          <summary className="cursor-pointer list-none px-3 py-2 hover:bg-muted/30">
            <div className="grid items-center gap-x-2 gap-y-1" style={rowTemplate(columns.length)}>
              <span className="flex items-center gap-1 text-sm">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                {day(w.checkIn)} &ndash; {day(w.checkOut)}
                <span className="text-xs text-muted-foreground">{w.nights}n</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {w.nightsInside < w.nights && `${w.nightsInside} of ${w.nights} nights here`}
              </span>
              {columns.map((c) => {
                const r = w.rows.find((x) => x.channel === c.channel && x.partyLabel === c.partyLabel);
                return r
                  ? <Cell key={`${c.channel}|${c.partyLabel}`} r={r} />
                  : <span key={`${c.channel}|${c.partyLabel}`}
                      title={`${c.channelLabel} · ${c.partyLabel} — never captured for this window`}
                      className="h-6 rounded border border-dotted border-slate-200" />;
              })}
              <span className="text-right text-xs tabular-nums text-muted-foreground">
                {w.rows.some((r) => r.attention === 'act' || r.attention === 'watch')
                  ? `${money(w.rows[0].ourDirect ?? 0)} direct` : ''}
              </span>
            </div>
          </summary>
          <div className="divide-y border-t bg-muted/10">
            {w.rows.map((r) => <Row key={`${r.channel}|${r.partyLabel}`} r={r} />)}
          </div>
        </details>
      ))}

      {/* Evidence is never moved in silence: a neighbour that samples these nights says so. */}
      {g.alsoSampledBy.length > 0 && (
        <p className="px-3 py-1.5 text-xs text-muted-foreground">
          Also sampled by {g.alsoSampledBy.map((a) => `${day(a.checkIn)}–${day(a.checkOut)} (${a.nightsInside}n here)`).join(', ')},
          listed under the neighbouring period.
        </p>
      )}
    </section>
  );
}

/** One contest, as a compact tile: the gap, the on-sale fraction, tinted by the verdict. */
function Cell({ r }: { r: MarketRow }) {
  const tone = TONE[r.attention];
  const loud = tone.loud;
  const asked = r.quoted + r.nothingLeft;
  if (r.attention === 'thin') {
    return (
      <span title={`${r.channelLabel} · ${r.partyLabel} — ${r.why}`}
        className="flex h-6 items-center justify-center rounded border border-dashed border-slate-300 text-[10px] text-slate-400">
        too thin
      </span>
    );
  }
  // The gap over the on-sale fraction. Both axes in every tile — a rank without the second one is the
  // reading that pointed the wrong way in the first place.
  return (
    <span title={`${r.channelLabel} · ${r.partyLabel} — ${r.label}. ${r.why}`}
      className={`flex h-6 items-center justify-center gap-1 rounded px-1 text-[11px] tabular-nums ${
        loud ? `${tone.chip} font-semibold` : 'border border-slate-200 bg-slate-50 text-slate-600'}`}>
      <span>{r.gapPct === null ? '—' : `${r.gapPct > 0 ? '+' : ''}${Math.round(r.gapPct)}%`}</span>
      <span className={loud ? 'opacity-90' : 'text-slate-400'}>
        {r.quoted}/{asked}{r.unread > 0 && '+?'}
      </span>
    </span>
  );
}

export function MarketPanel({ rows, grouped, columns = [], summary }: {
  rows: MarketRow[]; grouped?: PeriodGroupView[]; columns?: GridColumn[]; summary: MarketSummary;
}) {
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
        {/* He has read this. It stays available and silent — he asked to understand fast. */}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">How to read this</summary>
          <p className="mt-1 max-w-3xl">
            Two things decide a window: <strong>where your price sits</strong>, and{' '}
            <strong>how much of the field is still on sale</strong>. Being dearest of a field that has
            sold out is not the same as being overpriced &mdash; it is nearly the opposite. One contest
            per channel, never pooled. Grouped by your own pricing periods, because a period is what
            you change; a window is only a probe into one. Competitor prices are context for your
            decision and never change a rate.
          </p>
        </details>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {grouped?.length ? (
          <div>
            {/* The column header, sticky: without it a tile is a number with no coordinate. */}
            {columns.length > 0 && (
              <div className="sticky top-0 z-10 grid items-end gap-x-2 border-b bg-background px-3 py-1.5"
                   style={rowTemplate(columns.length)}>
                <span /><span />
                {columns.map((c, i) => (
                  <span key={`${c.channel}|${c.partyLabel}`} className="text-center leading-tight">
                    {(i === 0 || columns[i - 1].channel !== c.channel) && (
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {c.channelLabel}
                      </span>
                    )}
                    <span className="block text-[11px] text-muted-foreground">{c.partyLabel}</span>
                  </span>
                ))}
                <span />
              </div>
            )}
            {grouped.map((g) => <Period key={g.period?.id ?? 'none'} g={g} columns={columns} />)}
          </div>
        ) : (
          <div className="divide-y">{rows.map((r) => <Row key={`${r.key}|${r.channel}`} r={r} />)}</div>
        )}
        {(() => {
          const thin = rows.filter((r) => r.attention === 'thin');
          const airbnb = thin.filter((r) => r.channel === 'airbnb').length;
          return thin.length ? (
            <p className="px-3 pt-3 text-xs text-muted-foreground">
              {thin.length} contest{thin.length === 1 ? '' : 's'} too thin to rank (shown as ·)
              {airbnb > 0 && `, ${airbnb} of them Airbnb`} — that part of the board is unread, not calm.
            </p>
          ) : null;
        })()}
      </CardContent>
    </Card>
  );
}
