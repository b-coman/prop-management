'use client';

/**
 * The rate sheet, editable — built the way the owner builds it, from the Airbnb price outward.
 *
 * Change a number at the top and every row updates instantly, in the browser, with no round-trip.
 * That is the point: the owner's spreadsheet recalculated as they typed, and a tool that needs a
 * command line to answer "what if the base were 500?" is worse than the spreadsheet it replaces.
 *
 * Saving stores the settings only. It does not change any guest-facing price and sends nothing to any
 * OTA — the system has no write access to them. It changes what the sheet tells you to type.
 */
import { useMemo, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, AlertTriangle, Check } from 'lucide-react';
import { buildAnchoredRows, periodsWhereDirectIsNotCheapest, type AnchorConfig, type AnchoredPeriodInput } from '@/lib/pricing/anchorPricing';
import type { TierMultipliers } from '@/lib/pricing/periods';
import { saveAnchorSettings } from '../anchor-actions';

export interface RateSheetEditorProps {
  propertyId: string;
  initialConfig: AnchorConfig;
  configSaved: boolean;
  periods: AnchoredPeriodInput[];
  tierMultipliers: TierMultipliers;
  channelLabels: Record<string, string>;
  listingUrls: Record<string, string>;
  /** Per channel: how much of the guest's money you keep, as a fraction. For the "you keep" column. */
  netRetention: Record<string, number>;
  directRetention: number;
}

const money = (n: number, currency: string) => (currency === 'RON' ? `${n}` : `${n} ${currency}`);

export function RateSheetEditor({
  propertyId, initialConfig, configSaved, periods, tierMultipliers,
  channelLabels, listingUrls, netRetention, directRetention,
}: RateSheetEditorProps) {
  const [config, setConfig] = useState<AnchorConfig>(initialConfig);
  const [saving, startSaving] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(config) !== JSON.stringify(initialConfig);

  const rows = useMemo(
    () => buildAnchoredRows(periods, config, tierMultipliers),
    [periods, config, tierMultipliers],
  );
  const notCheapest = useMemo(() => periodsWhereDirectIsNotCheapest(rows), [rows]);

  const setChannel = (channelId: string, patch: Partial<AnchorConfig['channels'][number]>) =>
    setConfig((c) => ({ ...c, channels: c.channels.map((ch) => (ch.channelId === channelId ? { ...ch, ...patch } : ch)) }));

  const onSave = () => startSaving(async () => {
    const res = await saveAnchorSettings({ propertyId, ...config });
    setMessage(res.success
      ? { ok: true, text: 'Saved. No guest price changed and nothing was sent to any platform.' }
      : { ok: false, text: res.error ?? 'Could not save.' });
  });

  const channelIds = config.channels.map((c) => c.channelId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your starting numbers</CardTitle>
          <CardDescription>
            Everything below is built from these, the same way your spreadsheet does it: the Airbnb
            price comes first, the other platforms are a multiple of it, and your own website is set
            last — a little under the cheapest one.
            {!configSaved && (
              <span className="mt-2 block text-amber-600">
                These are read from your 2026 spreadsheet as a starting point. Nothing is saved yet.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="wd">Airbnb base, weekday</Label>
              <Input id="wd" type="number" value={config.weekdayPrice}
                     onChange={(e) => setConfig((c) => ({ ...c, weekdayPrice: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="we">Airbnb base, weekend</Label>
              <Input id="we" type="number" value={config.weekendPrice}
                     onChange={(e) => setConfig((c) => ({ ...c, weekendPrice: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dd">Website sits under by</Label>
              <div className="flex items-center gap-2">
                <Input id="dd" type="number" step="0.5" value={(config.directDiscountPct * 100).toFixed(1)}
                       onChange={(e) => setConfig((c) => ({ ...c, directDiscountPct: Number(e.target.value) / 100 }))} />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Each platform, as a multiple of the Airbnb base</p>
            <div className="space-y-2">
              {config.channels.map((ch) => (
                <div key={ch.channelId} className="flex flex-wrap items-center gap-3">
                  <span className="w-32 text-sm">{channelLabels[ch.channelId] ?? ch.channelId}</span>
                  <Input type="number" step="0.01" className="w-24" value={ch.factor}
                         onChange={(e) => setChannel(ch.channelId, { factor: Number(e.target.value) })} />
                  <span className="text-xs text-muted-foreground">× base</span>
                  {ch.currency !== 'RON' && (
                    <>
                      <span className="text-xs text-muted-foreground">÷</span>
                      <Input type="number" step="0.01" className="w-20" value={ch.fxDivisor ?? ''}
                             placeholder="rate"
                             onChange={(e) => setChannel(ch.channelId, { fxDivisor: Number(e.target.value) })} />
                      <span className="text-xs text-muted-foreground">to get {ch.currency}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={onSave} disabled={saving || !dirty}>
              {saving ? 'Saving…' : dirty ? 'Save these settings' : 'Saved'}
            </Button>
            {message && (
              <span className={`text-sm ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                {message.ok ? <Check className="mr-1 inline h-4 w-4" /> : null}{message.text}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {notCheapest.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Your website is not the cheapest place to book, in {notCheapest.length} period{notCheapest.length > 1 ? 's' : ''}
            </CardTitle>
            <CardDescription>
              Your rule is that your own site should be the cheapest. Here it costs a guest more than a
              platform does. Whether to move your price or the platform&rsquo;s is your call.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {notCheapest.slice(0, 8).map((n) => (
                <li key={n.periodId}>
                  <span className="font-medium">{n.periodName}</span>{' '}
                  <span className="text-muted-foreground">({n.startDate} → {n.endDate})</span>: your
                  site {n.directWeekday}, {channelLabels[n.cheapestChannelId] ?? n.cheapestChannelId}{' '}
                  {n.cheapestWeekday} — you are{' '}
                  <span className="font-medium">{(n.differencePct * 100).toFixed(0)}% dearer</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Prices to set, by period</CardTitle>
          <CardDescription>
            Weekday price for each platform. &ldquo;You keep&rdquo; is what reaches you after that
            platform&rsquo;s commission — the same guest money is worth different amounts depending on
            where they book.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Period</th>
                  <th className="pb-2 pr-3 font-medium">Dates</th>
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
                  <th className="pb-2 pr-3 font-medium text-right">Your site now</th>
                  <th className="pb-2 font-medium text-right">Suggested</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.periodId} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{r.periodName}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.fixedNightPrice != null ? `set by hand: ${r.fixedNightPrice}` : `tier ${r.tier} (×${r.tierMultiplier})`}
                      </div>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                      {r.startDate} → {r.endDate}<br />{r.nights} nights
                    </td>
                    {channelIds.map((cid) => {
                      const c = r.channels.find((x) => x.channelId === cid);
                      if (!c) return <td key={cid} className="py-2 pr-3 text-right">—</td>;
                      if (c.problem) return <td key={cid} className="py-2 pr-3 text-right text-xs text-amber-600">{c.problem}</td>;
                      const keep = netRetention[cid];
                      return (
                        <td key={cid} className="py-2 pr-3 text-right tabular-nums">
                          <div>{money(c.weekday, c.currency)}</div>
                          {keep != null && c.currency === 'RON' && (
                            <div className="text-xs text-muted-foreground">you keep {Math.round(c.weekday * keep)}</div>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {r.currentDirect ? (
                        <>
                          <div>{r.currentDirect.weekday}</div>
                          <div className="text-xs text-muted-foreground">you keep {Math.round(r.currentDirect.weekday * directRetention)}</div>
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      <div>{r.suggestedDirect.weekday}</div>
                      {r.currentDirect && r.suggestedDirect.weekday !== r.currentDirect.weekday && (
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          {r.suggestedDirect.weekday > r.currentDirect.weekday ? '+' : ''}
                          {r.suggestedDirect.weekday - r.currentDirect.weekday}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            &ldquo;Suggested&rdquo; is only what your own rule works out to — nothing applies it. Your
            website price still comes from the periods and tiers on the other tabs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
