import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle, Info } from 'lucide-react';

/**
 * Where we sit in the market, per window and per channel.
 *
 * The design problem is the same one the parity panel has and a different answer: a rank on its own
 * is a trivia fact. What decides something is the rank NEXT TO whether the window is selling at all —
 * being cheapest in a market that is not moving means one thing, and being cheapest in a market that
 * is selling out means the opposite. So absorption sits at the top of each window, not in a footnote.
 *
 * Three things are deliberately loud rather than tidy:
 *  - **Comparables that did not quote**, with their reason. An absence from a Booking search means the
 *    property will not take this party, or has nothing left — both are findings, never blanks.
 *  - **Thin samples.** Below three quotes there is no band and no rank, and the panel says so instead
 *    of drawing a chart of two numbers. And "thin" counts the comparables nobody has READ yet, not
 *    only the ones that answered — the first build printed "4 of 7 quoted" for a field of fifteen,
 *    which reads as near-complete coverage of a market and was coverage of a third of it.
 *  - **"Not sellable", never "sold"**, until a second reading proves a transition.
 *
 * Read-only. Nothing here feeds a rate, and no solver imports the module this data comes from (C2).
 */

interface LadderRow {
  listingId: string; name: string; total: number; isUs: boolean; promo: boolean;
  rating: number | null; reviewCount: number | null;
}

export interface ChannelPosition {
  channel: string;
  channelLabel: string;
  confidence: 'none' | 'indicative' | 'solid';
  sample: { quoted: number; asked: number; unread: number; field: number; oldestAgeDays: number | null };
  band: { min: number; median: number; max: number } | null;
  rank: { position: number; of: number } | null;
  ourChannelPrice: number | null;
  ourDirectPrice: number | null;
  ladder: LadderRow[];
  silent: Array<{ listingId: string; name: string; status: string; reason: string }>;
  outOfSet: Array<{ listingId: string; name: string; why: string }>;
  unread: Array<{ listingId: string; name: string }>;
  flags: string[];
  notes: string[];
}

export interface MarketWindow {
  key: string;
  checkIn: string; checkOut: string; nights: number;
  partyLabel: string;
  channels: ChannelPosition[];
  absorption: {
    started: boolean;
    summary: string;
    wentOffSale: Array<{ name: string; lastPrice: number | null; between: [string, string] }>;
    parksSoldOut: Array<{ name: string; between: [string, string] }>;
    stillOnSale: number;
    tooEarly: number;
  };
}

const money = (n: number) => Math.round(n).toLocaleString('en-US');
const day = (iso: string) => iso.slice(0, 10);

const CONFIDENCE: Record<string, { label: string; cls: string }> = {
  solid:      { label: 'solid',       cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  indicative: { label: 'indicative',  cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  none:       { label: 'too thin',    cls: 'bg-slate-100 text-slate-700 border-slate-300' },
};

function Channel({ p }: { p: ChannelPosition }) {
  return (
    <div className="border rounded-md p-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h4 className="font-semibold text-sm">{p.channelLabel}</h4>
        <span className="text-xs text-muted-foreground">
          {p.sample.quoted} of {p.sample.asked} quoted
          {p.sample.unread > 0 && `, ${p.sample.unread} of ${p.sample.field} never read`}
          {p.sample.oldestAgeDays !== null && ` · oldest ${p.sample.oldestAgeDays}d`}
          {' · '}
          <span className={`px-1 rounded border ${CONFIDENCE[p.confidence].cls}`}>
            {CONFIDENCE[p.confidence].label}
          </span>
        </span>
      </div>

      {p.band ? (
        <div className="text-xs text-muted-foreground mt-1">
          the set {money(p.band.min)} – {money(p.band.max)} · median {money(p.band.median)}
        </div>
      ) : (
        <div className="text-xs text-amber-700 mt-1">
          Too few comparables quoted for a band or a rank — the readings are listed, nothing is inferred.
        </div>
      )}

      {p.rank && (
        <div className="text-sm mt-1">
          you <strong>{money(p.ourChannelPrice!)}</strong> — {p.rank.position} of {p.rank.of} on {p.channelLabel}
        </div>
      )}
      {p.ourDirectPrice !== null && (
        <div className="text-xs text-muted-foreground">
          direct {money(p.ourDirectPrice)} — reference only; no guest browsing {p.channelLabel} sees it
        </div>
      )}

      <div className="mt-2 space-y-0.5">
        {p.ladder.map((r) => (
          <div key={r.listingId} className={`text-xs flex gap-2 ${r.isUs ? 'font-semibold' : ''}`}>
            <span className="w-4 shrink-0">{r.isUs ? '▸' : ''}</span>
            <span className="w-16 text-right shrink-0 tabular-nums">{money(r.total)}</span>
            <span className="flex-1 truncate">{r.name}</span>
            {r.promo && <span className="text-muted-foreground shrink-0">promo</span>}
            {r.rating != null && (
              <span className="text-muted-foreground shrink-0 w-16 text-right">
                {r.rating}{r.reviewCount != null && `/${r.reviewCount}`}
              </span>
            )}
          </div>
        ))}
        {/* A comparable that did not quote is never dropped — the reason is the finding. */}
        {p.silent.map((s) => (
          <div key={s.listingId} className="text-xs flex gap-2 text-muted-foreground">
            <span className="w-4 shrink-0" />
            <span className="w-16 text-right shrink-0">—</span>
            <span className="flex-1 truncate" title={s.reason}>{s.name}</span>
            <span className="shrink-0">{s.status}</span>
          </div>
        ))}
      </div>

      {/* Unread is not absent. A comparable nobody asked cannot be counted as one that lost. */}
      {p.unread.length > 0 && (
        <div className="text-xs text-amber-700 mt-2">
          {p.unread.length} never read for this window — unknown, not absent
          {': '}{p.unread.map((u) => u.name).join(', ')}
        </div>
      )}

      {p.outOfSet.length > 0 && (
        <div className="text-xs text-muted-foreground mt-2">
          {p.outOfSet.length} cannot host {`this party`} — competition you do not face on this window
          {': '}{p.outOfSet.map((o) => o.name).join(', ')}
        </div>
      )}

      {p.flags.map((f) => (
        <div key={f} className="text-xs mt-2 flex gap-1.5 text-red-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /><span>{f}</span>
        </div>
      ))}
      {p.notes.map((n) => (
        <div key={n} className="text-xs mt-2 flex gap-1.5 text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" /><span>{n}</span>
        </div>
      ))}
    </div>
  );
}

export function MarketPanel({ windows }: { windows: MarketWindow[] }) {
  if (!windows.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Where you sit</CardTitle>
          <CardDescription>
            No competitor prices captured yet for any forward window. A run takes a few minutes and
            needs your signed-in browser — there is no API for this, so it cannot happen on its own.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <div><code>npx tsx scripts/comp-search.ts --in 2026-10-24 --out 2026-10-28 --party 2a1c</code></div>
          <div>or ask for the <strong>competitive-position</strong> skill by name.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where you sit</CardTitle>
        <CardDescription>
          One contest per channel, never pooled — a guest browsing Airbnb sees your Airbnb price beside
          other Airbnb listings. Competitor prices are context for your decision; nothing here changes
          a rate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {windows.map((w) => (
          <div key={w.key}>
            <div className="flex items-baseline gap-2 flex-wrap mb-2">
              <h3 className="font-semibold">
                {day(w.checkIn)} → {day(w.checkOut)}
              </h3>
              <span className="text-sm text-muted-foreground">{w.nights}n · {w.partyLabel}</span>
            </div>

            {/* Absorption first: a rank means the opposite thing in a market that is selling. */}
            <div className={`text-xs rounded-md border p-2 mb-2 ${
              w.absorption.started ? 'bg-muted/50' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
              <strong>{w.absorption.started ? 'Is this window selling? ' : 'Not measurable yet. '}</strong>
              {w.absorption.summary}
              {w.absorption.wentOffSale.map((x) => (
                <div key={x.name} className="mt-1">
                  · {x.name} — last priced {x.lastPrice != null ? money(x.lastPrice) : '?'} on{' '}
                  {day(x.between[0])}, gone by {day(x.between[1])}
                </div>
              ))}
              {w.absorption.parksSoldOut.map((x) => (
                <div key={x.name} className="mt-1">
                  · {x.name} — <strong>every unit</strong> gone between {day(x.between[0])} and{' '}
                  {day(x.between[1])} (a park, so reported apart)
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {w.channels.map((c) => <Channel key={c.channel} p={c} />)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
