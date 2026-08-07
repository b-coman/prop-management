import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';

/**
 * Read-only view of the distribution channels — the rates that decide what a booking is actually worth.
 *
 * Read-only on purpose for now: these values came from the owner and were migrated verbatim, and an
 * edit form that silently rounds or defaults a commission would reintroduce exactly the drift this
 * collection was created to end. Editing arrives with the rate sheet, where a change has somewhere to
 * show its consequences.
 */
export interface ChannelRow {
  channelId: string;
  displayName: string;
  active: boolean;
  inactiveReason?: string;
  commissionPct: number | null;
  /** How far under this channel's guest price a direct booking can go and still net the same. */
  headroomPct: number | null;
  paymentCostPct?: number | null;
  targetDirectDiscountPct?: number | null;
  listingUrl?: string;
}

const pct = (n: number | null | undefined, dp = 1) =>
  n == null ? '—' : `${(n * 100).toFixed(dp).replace(/\.0$/, '')}%`;

export function ChannelsCard({ rows, propertyId }: { rows: ChannelRow[]; propertyId: string }) {
  if (!rows.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Channels</CardTitle>
          <CardDescription>
            No channels configured for this property yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Parity and rate-sheet numbers need the commission rates you actually pay. Nothing is
            assumed for you — a guessed commission produces confident, wrong answers.
          </p>
          <pre className="mt-3 rounded bg-muted p-3 text-xs overflow-x-auto">
            npx tsx scripts/migrate-channels.ts --property {propertyId} --write
          </pre>
        </CardContent>
      </Card>
    );
  }

  const direct = rows.find((r) => r.channelId === 'direct');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Channels</CardTitle>
        <CardDescription>
          Where this property is sold, and what each sale costs. These are your own listings — you set
          the prices on all of them. &ldquo;Headroom&rdquo; is how far under a channel&rsquo;s guest
          price a direct booking can go while still paying you the same.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Channel</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Commission</th>
                <th className="pb-2 font-medium text-right">Headroom</th>
                <th className="pb-2 font-medium">Listing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.channelId} className="border-b last:border-0">
                  <td className="py-2 font-medium">{r.displayName}</td>
                  <td className="py-2">
                    {r.active ? (
                      <Badge variant="outline">active</Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        <Badge variant="secondary">not selling</Badge>
                        {r.inactiveReason ? (
                          <span className="ml-2 text-xs">{r.inactiveReason}</span>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {r.channelId === 'direct' ? (
                      <span className="text-muted-foreground">
                        no commission · cards {pct(r.paymentCostPct)}
                      </span>
                    ) : r.commissionPct == null ? (
                      <span className="text-amber-600">not stated</span>
                    ) : (
                      pct(r.commissionPct, 2)
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {r.headroomPct == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      pct(r.headroomPct)
                    )}
                  </td>
                  <td className="py-2">
                    {r.listingUrl ? (
                      <a
                        href={r.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        open <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {direct?.targetDirectDiscountPct != null && (
          <p className="mt-4 text-sm text-muted-foreground">
            Target: direct should sit at least{' '}
            <span className="font-medium text-foreground">{pct(direct.targetDirectDiscountPct)}</span>{' '}
            under the cheapest channel.
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Rates are yours, recorded as you stated them — nothing here is inferred or fetched. To change
          one, edit the <code>channels</code> collection; an editor lands with the rate sheet.
        </p>
      </CardContent>
    </Card>
  );
}
