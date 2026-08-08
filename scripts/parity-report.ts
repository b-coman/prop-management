/**
 * parity-report — render the comparison table FROM THE STORE, never by hand.
 *
 * The rule this enforces: every worklist cell appears. A cell with no observation prints `?`, counts
 * against coverage, and is listed at the bottom as outstanding. A report can only call itself COMPLETE
 * when nothing is missing, nothing errored, and nothing is stale — so a partial run announces itself
 * instead of looking like a finished one.
 *
 *   npx tsx scripts/parity-report.ts [propertySlug] [--target 0.075] [--fresh-days 42] [--json]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { buildWorklist, computeCoverage, outstandingCells, cellId, type ProbeInput } from '@/lib/growth/parityWorklist';
import { latestByCell, type ObservationRecord } from '@/services/growth/parityObservations';
import { evaluateParity, bestOffer, channelSpreadPct } from '@/lib/growth/parityMath';
import { getParityConfig } from '@/services/channelService';

const SLUG = process.argv[2]?.startsWith('--') ? 'prahova-mountain-chalet' : (process.argv[2] ?? 'prahova-mountain-chalet');
const AS_JSON = process.argv.includes('--json');
const num = (n: string, d: number) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? Number(process.argv[i + 1]) : d; };
/** `--target` overrides; otherwise the owner's configured direct discount, read below. */
const TARGET_ARG = process.argv.includes('--target') ? num('target', 0.075) : null;
const FRESH_DAYS = num('fresh-days', 42);

const pct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
const LABEL: Record<string, string> = { losing: 'LOSING', thin: 'thin', healthy: 'OK', overshoot: 'TOO LOW' };

(async () => {
  // Rates from the `channels` collection. No defaults: a parity verdict computed against a guessed
  // commission looks authoritative and is wrong in a direction the reader cannot see.
  const parityConfig = await getParityConfig(SLUG);
  const { channels, direct } = parityConfig;
  const TARGET = TARGET_ARG ?? parityConfig.targetDiscountPct;

  const observations = [...(await latestByCell(SLUG)).values()];

  // How the numbers were read decides what they mean. A run that mixes logged-in and logged-out
  // captures is not comparable to itself, and silently averaging the two is how a 20% Genius discount
  // disappears from a report that still looks authoritative.
  const sessions = new Map<string, number>();
  observations.filter((o) => o.status === 'captured').forEach((o) => {
    const k = (o.sessionState ?? '(not recorded)').trim();
    sessions.set(k, (sessions.get(k) ?? 0) + 1);
  });
  if (!observations.length) {
    console.log('No observations yet. Run: npx tsx scripts/parity-pack.ts ' + SLUG);
    return;
  }

  // The worklist is reconstructed from the observations' own windows, so the report covers exactly
  // what was asked for — including cells nobody ever captured.
  const seen = new Map<string, ProbeInput>();
  for (const o of observations) {
    const key = `${o.checkIn}|${o.checkOut}|${o.guests}`;
    if (!seen.has(key)) {
      seen.set(key, { label: `${o.checkIn} → ${o.checkOut}`, checkIn: o.checkIn, checkOut: o.checkOut, nights: o.nights, guests: o.guests, priority: 'normal' });
    }
  }
  const probes = [...seen.values()].sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.guests - b.guests);
  const channelNames = channels.map((c) => c.channel);
  const worklist = buildWorklist(SLUG, probes, channelNames);
  const coverage = computeCoverage(worklist, observations, { freshnessDays: FRESH_DAYS });
  const todo = outstandingCells(worklist, observations, { freshnessDays: FRESH_DAYS });
  const byCell = new Map(observations.map((o) => [o.cellId, o]));

  const get = (p: ProbeInput, channel: string): ObservationRecord | undefined =>
    byCell.get(cellId(SLUG, p.checkIn, p.checkOut, p.guests, channel));
  const show = (o?: ObservationRecord) => {
    if (!o) return '     ?';
    if (o.status === 'captured') return String(Math.round(o.guestTotal!)).padStart(6);
    if (o.status === 'refused') return '   n/a';
    if (o.status === 'unavailable') return '  full';
    return '   ERR';
  };

  const lines: any[] = [];
  for (const p of probes) {
    const d = get(p, 'direct');
    const offers = channels
      .map((c) => ({ econ: c, o: get(p, c.channel) }))
      .filter((x) => x.o?.status === 'captured')
      .map((x) => ({ channel: x.econ.channel, otaTotal: x.o!.guestTotal!, list: x.o!.listTotal ?? undefined, econ: x.econ }));

    let verdict = '', gap = '', floor = '', spread = '';
    // A verdict needs EVERY channel resolved. "Best offer" means cheapest across all of them, so a
    // verdict computed on a subset can be wrong in the dangerous direction — judging against only the
    // dearest captured channel reads TOO LOW when the truth may be LOSING. Resolved includes refusals
    // (a channel that will not quote cannot be the cheapest).
    const resolvedChannels = channels.filter((c) => {
      const o = get(p, c.channel);
      return o && (o.status === 'captured' || o.status === 'refused' || o.status === 'unavailable');
    }).length;
    const allChannelsIn = resolvedChannels === channels.length;
    if (d?.status === 'captured' && offers.length && allChannelsIn) {
      const best = bestOffer(offers)!;
      const v = evaluateParity({ directTotal: d.guestTotal!, otaTotal: best.otaTotal, otaListTotal: best.list, channel: best.econ, direct, targetDiscountPct: TARGET });
      verdict = LABEL[v.status]; gap = pct(v.guestGapPct); floor = String(Math.round(v.indifferencePrice));
      const sp = channelSpreadPct(offers);
      spread = sp !== null ? `${(sp * 100).toFixed(0)}%` : '—';
    } else if (d?.status === 'captured' && offers.length && !allChannelsIn) {
      verdict = `partial ${resolvedChannels}/${channels.length}`; gap = '—'; floor = '—'; spread = '—';
    } else {
      verdict = 'no verdict'; gap = '—'; floor = '—'; spread = '—';
    }
    lines.push({ p, d, cells: channels.map((c) => get(p, c.channel)), verdict, gap, floor, spread });
  }

  if (AS_JSON) {
    console.log(JSON.stringify({ propertyId: SLUG, coverage, outstanding: todo, rows: lines }, null, 2));
    return;
  }

  const W = 118;
  console.log('\n' + '='.repeat(W));
  console.log(`DIRECT vs ${channelNames.map((c) => c.toUpperCase()).join(' vs ')} — ${SLUG}`);
  console.log(`target: direct ≥${(TARGET * 100).toFixed(1)}% under the cheapest channel · ` +
              channels.map((c) => `${c.channel} ${(c.commissionPct * 100).toFixed(1)}%`).join(' · ') +
              ` · cards ${(direct.paymentCostPct * 100).toFixed(1)}%`);
  if (parityConfig.unstated.length || parityConfig.inactive.length) {
    console.log(
      [parityConfig.unstated.length ? `no commission stated (excluded): ${parityConfig.unstated.join(', ')}` : '',
       parityConfig.inactive.length ? `not selling on: ${parityConfig.inactive.map((c) => c.channelId).join(', ')}` : '',
      ].filter(Boolean).join(' · '));
  }
  const distinct = [...sessions.keys()];
  if (distinct.length > 1 || distinct.some((k) => k === '(not recorded)')) {
    console.log('!! MIXED OR UNLABELLED CAPTURES — these numbers are not comparable to each other:');
    [...sessions.entries()].sort((a, b) => b[1] - a[1])
      .forEach(([k, n]) => console.log(`     ${String(n).padStart(3)} × ${k}`));
    console.log('   Re-capture the odd ones out before trusting any verdict below.');
  } else if (distinct.length === 1) {
    console.log(`all captures: ${distinct[0]}`);
  }
  console.log('='.repeat(W));
  console.log('dates                        n  g  direct ' + channelNames.map((c) => c.slice(0, 7).padStart(7)).join(' ') + ' | gap      verdict   floor spread');
  console.log('-'.repeat(W));
  for (const l of lines) {
    console.log(
      `${(l.p.checkIn + '→' + l.p.checkOut).padEnd(26)} ${String(l.p.nights).padStart(2)} ${l.p.guests} ` +
      `${show(l.d)} ${l.cells.map(show).join(' ')} | ${l.gap.padStart(7)}  ${l.verdict.padEnd(10)} ${l.floor.padStart(5)} ${l.spread.padStart(5)}`
    );
  }
  console.log('-'.repeat(W));
  console.log(`? = never captured · n/a = channel refuses to quote · full = dates taken · ERR = capture failed`);
  console.log(`a verdict needs ALL ${channels.length} channels resolved — "partial n/m" means the cheapest channel may not be captured yet`);
  console.log(`\nCOVERAGE  ${coverage.captured} captured · ${coverage.refused} refused · ${coverage.unavailable} full · ` +
              `${coverage.errored} error · ${coverage.missing} MISSING  of ${coverage.total} cells  (${(coverage.resolvedPct * 100).toFixed(0)}% resolved)` +
              (coverage.oldestAgeDays !== null ? ` · oldest ${coverage.oldestAgeDays}d` : ''));
  console.log(coverage.complete
    ? 'STATUS: COMPLETE — every cell resolved and fresh.'
    : `STATUS: INCOMPLETE — do NOT treat this table as the whole picture. ${todo.length} cell(s) still owed.`);
  if (todo.length) {
    console.log('\nOutstanding:');
    todo.slice(0, 30).forEach((c) => console.log(`  ${c.channel.padEnd(12)} ${c.checkIn}→${c.checkOut} ${c.guests}g`));
    if (todo.length > 30) console.log(`  … and ${todo.length - 30} more`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
