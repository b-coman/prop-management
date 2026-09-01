import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, ImageOff, Link2 } from 'lucide-react';

/**
 * The curated comparable set, as one screen per contest.
 *
 * The owner asked for exactly four things on each row (2026-09-01): **name, city, a picture, and the
 * link**. The picture is not decoration — a curated set is only as good as his ability to look at it
 * and say "that one is not really a competitor any more", and nobody does that from a URL.
 *
 * Two things the design makes visible rather than tucking away:
 *
 *  - **Airbnb and Booking are separate contests** (C8), so they render as separate panels and are
 *    never merged into one table. The same house appears in both, linked by `sameAs`, and that is two
 *    entries on purpose.
 *  - **The set AGES** (C1). An entry nobody has re-verified is a hypothesis about a listing that may
 *    have been remodelled, repriced or delisted, and it says so on its own row rather than in a
 *    footnote nobody reads.
 *
 * Read-only, deliberately: curation is a judgement the owner makes deliberately, not something to
 * fat-finger from a pricing screen. Editing arrives with the verification pass, which has somewhere
 * to show a change's consequences.
 */
export interface CompetitorRow {
  listingId: string;
  displayName: string;
  channel: string;
  url: string;
  city: string;
  heroPhotoUrl: string | null;
  propertyType: string;
  /** Largest single unit — what decides whether a party fits without splitting. */
  largestUnit: number;
  unitCount: number;
  rating: number | null;
  reviewCount: number | null;
  amenities: string[];
  substitutionBasis: string;
  /** Whether it is a draft of the owner's reasoning or actually his. */
  basisIsDraft: boolean;
  sameAsName?: string;
  active: boolean;
  retiredReason?: string;
  verificationAgeDays: number | null;
  unverified: boolean;
  stale: boolean;
  /** One entry per configured party: does this listing compete for it? */
  fits: Array<{ label: string; verdict: 'single' | 'combination' | 'out-of-set' | 'unknown'; detail: string }>;
}

const CHANNEL_LABEL: Record<string, string> = { airbnb: 'Airbnb', 'booking.com': 'Booking.com' };

const FIT_STYLE: Record<string, { text: string; cls: string }> = {
  single:        { text: 'competes',  cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  combination:   { text: 'combines',  cls: 'bg-sky-100 text-sky-900 border-sky-300' },
  'out-of-set':  { text: 'too small', cls: 'bg-slate-100 text-slate-600 border-slate-300' },
  unknown:       { text: 'unread',    cls: 'bg-amber-100 text-amber-900 border-amber-300' },
};

function Photo({ row }: { row: CompetitorRow }) {
  if (!row.heroPhotoUrl) {
    return (
      <div className="w-28 h-20 shrink-0 rounded-md bg-muted flex flex-col items-center justify-center text-muted-foreground">
        <ImageOff className="h-4 w-4" />
        <span className="text-[10px] mt-1">not read</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- an OTA CDN URL, not a bundled asset
    <img
      src={row.heroPhotoUrl}
      alt={row.displayName}
      className="w-28 h-20 shrink-0 rounded-md object-cover bg-muted"
      loading="lazy"
    />
  );
}

function Row({ row }: { row: CompetitorRow }) {
  return (
    <div className={`flex gap-3 py-3 border-b last:border-0 ${row.active ? '' : 'opacity-60'}`}>
      <Photo row={row} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <a
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline inline-flex items-center gap-1"
          >
            {row.displayName}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
          <span className="text-sm text-muted-foreground">{row.city}</span>
          {!row.active && <Badge variant="outline" className="text-xs">retired</Badge>}
        </div>

        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
          <span>{row.propertyType}</span>
          <span>·</span>
          <span>
            sleeps <strong className="text-foreground">{row.largestUnit || '?'}</strong>
            {row.unitCount > 1 && ` in the largest of ${row.unitCount} units`}
          </span>
          {row.rating != null && (
            <>
              <span>·</span>
              <span>
                {row.rating} {row.reviewCount != null && `(${row.reviewCount} reviews)`}
              </span>
            </>
          )}
          {row.sameAsName && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Link2 className="h-3 w-3" /> also listed as {row.sameAsName}
              </span>
            </>
          )}
        </div>

        {row.amenities.length > 0 && (
          <div className="text-xs text-muted-foreground mt-1">{row.amenities.join(' · ')}</div>
        )}

        {/* Which of the owner's parties this listing actually competes for. The whole point of C4:
            the field changes size with the party, and that is measured without a single page load. */}
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {row.fits.map((f) => {
            const s = FIT_STYLE[f.verdict];
            return (
              <span
                key={f.label}
                title={f.detail}
                className={`text-[11px] px-1.5 py-0.5 rounded border ${s.cls}`}
              >
                {f.label}: {s.text}
              </span>
            );
          })}
        </div>

        {/* A div, not a p: Badge renders a div and React rejects that nesting. */}
        <div className="text-xs mt-2 text-muted-foreground italic flex items-start gap-1.5">
          {row.basisIsDraft && (
            <Badge variant="outline" className="text-[10px] not-italic border-amber-400 text-amber-700 shrink-0">
              draft
            </Badge>
          )}
          <span>{row.substitutionBasis}</span>
        </div>

        {row.retiredReason && (
          <p className="text-xs mt-1 text-muted-foreground">Retired: {row.retiredReason}</p>
        )}
      </div>

      <div className="text-right shrink-0 text-xs">
        {row.unverified ? (
          <Badge variant="outline" className="border-amber-400 text-amber-700">never verified</Badge>
        ) : row.stale ? (
          <Badge variant="outline" className="border-amber-400 text-amber-700">
            {row.verificationAgeDays}d old
          </Badge>
        ) : (
          <span className="text-muted-foreground">verified {row.verificationAgeDays}d ago</span>
        )}
      </div>
    </div>
  );
}

export function CompetitorSetCard({ rows }: { rows: CompetitorRow[] }) {
  if (!rows.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>The comparable set</CardTitle>
          <CardDescription>
            No comparables curated for this property yet. The set is entered by hand and re-verified
            periodically — auto-discovery produces comparables nobody would actually book instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <code>npx tsx scripts/seed-competitor-set.ts --write</code>
        </CardContent>
      </Card>
    );
  }

  const channels = [...new Set(rows.map((r) => r.channel))].sort();
  const drafts = rows.filter((r) => r.basisIsDraft).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>The comparable set</CardTitle>
        <CardDescription>
          Curated by hand, one entry per <strong>listing</strong> — the same house on two channels is
          two entries, because they compete in two different contests at two different prices.
          {drafts > 0 && (
            <>
              {' '}
              <span className="text-amber-700">
                {drafts} of {rows.length} still carry a drafted reason rather than yours.
              </span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {channels.map((c) => {
          const inChannel = rows.filter((r) => r.channel === c);
          const active = inChannel.filter((r) => r.active);
          return (
            <div key={c}>
              <h3 className="text-sm font-semibold mb-1">
                {CHANNEL_LABEL[c] ?? c}
                <span className="ml-2 font-normal text-muted-foreground">
                  {active.length} competing
                  {inChannel.length > active.length && `, ${inChannel.length - active.length} retired`}
                </span>
              </h3>
              <div>
                {inChannel.map((r) => <Row key={`${r.channel}-${r.listingId}`} row={r} />)}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
