#!/usr/bin/env npx tsx
/**
 * ga4-engagement-report — the mobile-engagement numbers this project's
 * performance work was aimed at, split before and after a cutover date.
 *
 * The whole exercise started from one gap: mobile is ~83% of traffic and
 * engages at 22-28% against desktop's 67%, with Android/Chrome worst. This
 * reports exactly those cuts so the question "did it move" has an answer rather
 * than an opinion.
 *
 * Reads GA4 via the Data API using the Firebase admin service account, which is
 * already a viewer on the property. Read-only.
 *
 * A WORD ON SAMPLE SIZE: engagement rate on a few dozen sessions is noise. Give
 * it a week before drawing anything, and prefer comparing equal-length windows.
 * The script prints session counts next to every rate so a small n is visible.
 *
 * Usage:
 *   npx tsx scripts/ga4-engagement-report.ts --since 2026-08-15
 *   npx tsx scripts/ga4-engagement-report.ts --since 2026-08-15 --before-days 28
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { BetaAnalyticsDataClient } from '@google-analytics/data';

const PROPERTY = 'properties/488335480';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const since = arg('since')!;
const beforeDays = Number(arg('before-days', '28'));
if (!since || !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
  console.error('--since YYYY-MM-DD is required (the first full day AFTER the change)');
  process.exit(1);
}

const dayBefore = (d: string, n: number) => {
  const x = new Date(d + 'T00:00:00Z');
  x.setUTCDate(x.getUTCDate() - n);
  return x.toISOString().slice(0, 10);
};

const client = new BetaAnalyticsDataClient({
  keyFilename: path.resolve(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH!),
});

interface Row {
  key: string;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  avgEngagementSec: number;
}

async function report(startDate: string, endDate: string, dimension: string): Promise<Row[]> {
  const [res] = await client.runReport({
    property: PROPERTY,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: dimension }],
    metrics: [
      { name: 'sessions' },
      { name: 'engagedSessions' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });
  return (res.rows ?? []).map((r) => ({
    key: r.dimensionValues?.[0]?.value ?? '?',
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
    engagedSessions: Number(r.metricValues?.[1]?.value ?? 0),
    engagementRate: Number(r.metricValues?.[2]?.value ?? 0) * 100,
    avgEngagementSec: Number(r.metricValues?.[3]?.value ?? 0),
  }));
}

function table(title: string, before: Row[], after: Row[], beforeLabel: string, afterLabel: string) {
  console.log(`\n${title}`);
  console.log(`  ${''.padEnd(22)} ${beforeLabel.padStart(26)}   ${afterLabel.padStart(26)}`);
  console.log(`  ${''.padEnd(22)} ${'sess'.padStart(6)}${'eng%'.padStart(8)}${'avg s'.padStart(8)}   ${'sess'.padStart(6)}${'eng%'.padStart(8)}${'avg s'.padStart(8)}`);
  const keys = [...new Set([...before.map((r) => r.key), ...after.map((r) => r.key)])];
  for (const k of keys) {
    const b = before.find((r) => r.key === k);
    const a = after.find((r) => r.key === k);
    const f = (r?: Row) =>
      r
        ? `${String(r.sessions).padStart(6)}${r.engagementRate.toFixed(0).padStart(7)}%${r.avgEngagementSec.toFixed(0).padStart(8)}`
        : `${'-'.padStart(6)}${'-'.padStart(8)}${'-'.padStart(8)}`;
    const small = (a?.sessions ?? 0) < 30 ? '  (small n)' : '';
    console.log(`  ${k.slice(0, 22).padEnd(22)} ${f(b)}   ${f(a)}${small}`);
  }
}

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const beforeEnd = dayBefore(since, 1);
  const beforeStart = dayBefore(beforeEnd, beforeDays - 1);

  console.log(`GA4 property 488335480`);
  console.log(`  before : ${beforeStart} .. ${beforeEnd}  (${beforeDays} days)`);
  console.log(`  after  : ${since} .. ${today}`);

  const afterDays =
    Math.round((Date.parse(today) - Date.parse(since)) / 86400000) + 1;
  if (afterDays < 7) {
    console.log(
      `\n  ⚠ only ${afterDays} day(s) of post-change data. Engagement rate on this` +
        `\n    little traffic is noise. Treat everything below as directional at best.`
    );
  }

  for (const [title, dim] of [
    ['BY DEVICE', 'deviceCategory'],
    ['BY BROWSER', 'browser'],
    ['BY LANDING PAGE', 'landingPagePlusQueryString'],
  ] as const) {
    const [b, a] = await Promise.all([
      report(beforeStart, beforeEnd, dim),
      report(since, today, dim),
    ]);
    table(title, b, a, `before (${beforeDays}d)`, `after (${afterDays}d)`);
  }

  console.log('\n  Note: "after" is a shorter window, so raw session counts are not');
  console.log('  comparable. Compare the rates, and only once n is respectable.');
  process.exit(0);
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
