import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, AlertTriangle } from 'lucide-react';

/**
 * The rate sheet, laid out the way the owner's spreadsheet was: periods down, channels across.
 *
 * The honest constraint this UI is built around: **nothing here can push a price to an OTA.** There is
 * no write API. A human opens three dashboards and types. So the job is to make typing errorless — the
 * exact number, the exact window, a link straight to the listing — and to make verification automatic
 * once a parity capture comes back.
 */
export interface RateSheetCell {
  channelId: string;
  nightly: number;
  currency: string;
  status: 'pending' | 'applied' | 'verified' | 'drifted' | 'none';
  problem?: string;
}

export interface RateSheetGridRow {
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  nights: number;
  directNightly: number;
  cells: RateSheetCell[];
}

const STATUS: Record<string, { label: string; className: string }> = {
  pending:  { label: 'to type',  className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  applied:  { label: 'typed',    className: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200' },
  verified: { label: 'verified', className: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' },
  drifted:  { label: 'drifted',  className: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200' },
};

export function RateSheetGrid({
  rows, channelIds, channelLabels, listingUrls, version, computedAt, warnings,
}: {
  rows: RateSheetGridRow[];
  channelIds: string[];
  channelLabels: Record<string, string>;
  listingUrls: Record<string, string>;
  version: number | null;
  computedAt: string | null;
  warnings: string[];
}) {
  if (!rows.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rate sheet</CardTitle>
          <CardDescription>
            No priced periods ahead. Define pricing periods, then generate a sheet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded bg-muted p-3 text-xs overflow-x-auto">
            npx tsx scripts/periods.ts list{'\n'}
            npx tsx scripts/rate-sheet.ts --write
          </pre>
        </CardContent>
      </Card>
    );
  }

  const counts = rows.flatMap((r) => r.cells).reduce<Record<string, number>>(
    (a, c) => (c.status === 'none' ? a : { ...a, [c.status]: (a[c.status] ?? 0) + 1 }), {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate sheet {version ? <span className="text-muted-foreground font-normal">v{version}</span> : null}</CardTitle>
        <CardDescription>
          What each channel should be listed at, derived from your direct price and each
          channel&rsquo;s commission. This system cannot change prices on an OTA — you type them, mark
          them typed, and a parity capture confirms them.
          {computedAt ? <> Computed {computedAt.slice(0, 10)}.</> : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {Object.entries(counts).map(([s, n]) => (
            <span key={s} className={`rounded px-2 py-1 ${STATUS[s]?.className ?? ''}`}>
              {STATUS[s]?.label ?? s}: {n}
            </span>
          ))}
        </div>

        {warnings.length > 0 && (
          <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
            <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> Needs attention</p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Period</th>
                <th className="pb-2 pr-3 font-medium">Dates</th>
                <th className="pb-2 pr-3 font-medium text-right">Direct</th>
                {channelIds.map((c) => (
                  <th key={c} className="pb-2 pr-3 font-medium text-right">
                    {listingUrls[c] ? (
                      <a href={listingUrls[c]} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center gap-1 hover:underline">
                        {channelLabels[c] ?? c} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (channelLabels[c] ?? c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.periodId} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-3 font-medium">{r.periodName}</td>
                  <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                    {r.startDate} → {r.endDate}
                    <span className="ml-1 text-xs">({r.nights}n)</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.directNightly}</td>
                  {channelIds.map((cid) => {
                    const cell = r.cells.find((c) => c.channelId === cid);
                    if (!cell) return <td key={cid} className="py-2 pr-3 text-right text-muted-foreground">—</td>;
                    if (cell.problem) {
                      return (
                        <td key={cid} className="py-2 pr-3 text-right">
                          <span title={cell.problem} className="text-amber-600 text-xs">needs FX</span>
                        </td>
                      );
                    }
                    return (
                      <td key={cid} className="py-2 pr-3 text-right">
                        <div className="tabular-nums">
                          {cell.nightly}{cell.currency !== 'RON' ? ` ${cell.currency}` : ''}
                        </div>
                        {cell.status !== 'none' && (
                          <Badge variant="outline" className={`mt-1 text-[10px] ${STATUS[cell.status]?.className ?? ''}`}>
                            {STATUS[cell.status]?.label ?? cell.status}
                          </Badge>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Prices are per night, before the weekend uplift the engine applies. Regenerate with{' '}
          <code>npx tsx scripts/rate-sheet.ts --write</code>; confirm what you typed with{' '}
          <code>mark-applied</code>, and verification follows from the next parity capture.
        </p>
      </CardContent>
    </Card>
  );
}
