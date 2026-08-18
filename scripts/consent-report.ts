#!/usr/bin/env npx tsx
/**
 * consent-report — the split GA4 cannot show you: accepted, declined, or never touched.
 *
 * GA4 records nothing either way when consent is denied, so "people are rejecting" and "people are
 * ignoring the banner" look identical there — and they call for opposite fixes. One is a copy
 * problem, the other is a visibility problem. This reads the first-party consentEvents log instead.
 *
 * Ignored is derived: shown - (accept + reject + preferences).
 *
 * Usage: npx tsx scripts/consent-report.ts [--days 7]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const days = (() => { const i = process.argv.indexOf('--days'); return i > -1 ? Number(process.argv[i + 1]) : 7; })();

(async () => {
  const db = await getAdminDb();
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const snap = await db.collection('consentEvents').where('day', '>=', since).get();

  if (snap.empty) {
    console.log(`\nNo consent events since ${since}.`);
    console.log('Either nothing is deployed yet, or nobody has been shown the banner.\n');
    process.exit(0);
  }

  const byDay = new Map<string, Record<string, number>>();
  const byCampaign = new Map<string, Record<string, number>>();
  const bump = (m: Map<string, Record<string, number>>, k: string, o: string) => {
    const row = m.get(k) ?? { shown: 0, accept: 0, reject: 0, preferences: 0 };
    row[o] = (row[o] ?? 0) + 1; m.set(k, row);
  };
  for (const d of snap.docs) {
    const x = d.data() as any;
    bump(byDay, x.day ?? '?', x.outcome);
    if (x.campaign) bump(byCampaign, x.campaign, x.outcome);
  }

  const line = (k: string, r: Record<string, number>) => {
    const decided = r.accept + r.reject + r.preferences;
    const ignored = Math.max(0, r.shown - decided);
    const pct = (n: number) => (r.shown ? `${Math.round((n / r.shown) * 100)}%` : '—');
    return `  ${k.padEnd(24)} shown ${String(r.shown).padStart(4)} · accepted ${String(r.accept).padStart(4)} (${pct(r.accept).padStart(4)}) · declined ${String(r.reject).padStart(4)} (${pct(r.reject).padStart(4)}) · IGNORED ${String(ignored).padStart(4)} (${pct(ignored).padStart(4)})`;
  };

  console.log(`\n=== consent outcomes, last ${days} day(s) ===`);
  for (const k of [...byDay.keys()].sort()) console.log(line(k, byDay.get(k)!));

  const tot = { shown: 0, accept: 0, reject: 0, preferences: 0 };
  for (const r of byDay.values()) for (const k of Object.keys(tot) as (keyof typeof tot)[]) tot[k] += r[k] ?? 0;
  console.log('  ' + '-'.repeat(96));
  console.log(line('TOTAL', tot));

  if (byCampaign.size) {
    console.log('\n=== by ad campaign (utm_campaign) ===');
    for (const k of [...byCampaign.keys()].sort()) console.log(line(k, byCampaign.get(k)!));
  }

  const decided = tot.accept + tot.reject + tot.preferences;
  const ignored = Math.max(0, tot.shown - decided);
  console.log('\n  Read it this way:');
  console.log('    IGNORED high  -> a visibility problem. The banner is being scrolled past.');
  console.log('    declined high -> a copy problem. They read it and said no.');
  if (tot.shown) {
    console.log(`\n  Yours: ${Math.round((ignored / tot.shown) * 100)}% ignored, ${Math.round((tot.reject / tot.shown) * 100)}% declined, ${Math.round((tot.accept / tot.shown) * 100)}% accepted.\n`);
  }
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
