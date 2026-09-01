#!/usr/bin/env npx tsx
/**
 * landing-price-check — do the prices on the landing pages still match what the site would charge?
 *
 * `priceHint` is written into `landingPages/{slug}.exampleStays` when the page is generated, and the
 * renderer prints it verbatim as "de la N RON". It is a SNAPSHOT, and nothing invalidates it when a
 * rate changes. So every repricing silently ages every published page, in the one place the business
 * is paying for traffic.
 *
 * That is not hypothetical: birou-veverite was generated 2026-08-17 with Fall at 472.50/night, the
 * band repricing moved Fall to 405 on 2026-09-01, and the live page went on advertising 1,777 RON for
 * a stay the engine quotes at 1,547.
 *
 * Quotes come from the engine's own /api/check-pricing, so this cannot disagree with the booking flow
 * about what a stay costs. Paced for the 60/min public rate limit.
 *
 * With --write it also CORRECTS the stored hints to what the engine quotes today. The check and the
 * fix share one quote on purpose: a separate repair script would be free to disagree with the report
 * that triggered it.
 *
 * The owner declined an automatic refresh on 2026-09-01 - "the landing pages are short lived pages,
 * so I don't see too many changes on them" - so this stays a deliberate act, run when he asks.
 *
 * Dry-run unless --write.
 *
 *   npx tsx scripts/landing-price-check.ts [slug] [--write]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const ONLY = process.argv[2]?.startsWith('--') ? undefined : process.argv[2];
const WRITE = process.argv.includes('--write');
const BASE = process.env.PARITY_BASE_URL ?? 'http://localhost:9002';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Stay { start: string; end: string; nights: number; guests?: number | null; priceHint?: number | null }

(async () => {
  const db = await getAdminDb();
  const docs = (await db.collection('landingPages').get()).docs
    .filter((d) => !ONLY || d.id === ONLY);

  const today = new Date().toISOString().slice(0, 10);
  // Counted apart, because they are different facts. A wrong price on a PUBLISHED page is being
  // shown to people right now; the same on a draft is a note for whoever finishes it. Rolling them
  // together made the summary read "1 of 6 live cards no longer match" on a day when every published
  // card was correct and the only wrong one sat on a page that 404s.
  let drifted = 0, checked = 0, expired = 0, fixed = 0, unsellable = 0, draftDrift = 0;
  for (const doc of docs) {
    const d = doc.data() as { status?: string; propertyId: string; exampleStays?: Stay[] };
    const stays = d.exampleStays ?? [];
    // Only a published page is served; /lp returns 404 for a draft.
    const live = d.status === 'published';
    console.log(`\n${doc.id}  (${d.status ?? 'no status'}${live ? '' : ' — not served'})  ${stays.length} card(s)`);
    if (!stays.length) continue;
    // A copy the corrections land in, so one unsellable card never stops the others being fixed.
    const next: Stay[] = stays.map((x) => ({ ...x }));
    let touched = false;

    for (const s of stays) {
      const guests = s.guests ?? 2;
      // A card whose check-in has passed cannot be quoted and is not drift - it is an expired page.
      // Reporting it as "quote failed" buries the cards that are genuinely wrong.
      if (s.start < today) { expired++; console.log(`  ${s.start}→${s.end} ${s.nights}n ${guests}g  expired`); continue; }
      const res = await fetch(`${BASE}/api/check-pricing`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ propertyId: d.propertyId, checkIn: s.start, checkOut: s.end, guests }),
      });
      // Pace on EVERY branch, error included — a tight retry loop is what burns the limiter.
      await sleep(1100);
      const label = `  ${s.start}→${s.end} ${s.nights}n ${guests}g`;
      if (!res.ok) { console.log(`${label}  quote failed: HTTP ${res.status}`); continue; }
      const body = await res.json() as { available?: boolean; pricing?: { totalPrice?: number } };
      if (!body.available || body.pricing?.totalPrice == null) {
        // No price exists to copy in. Inventing one, or blanking the card silently, would both be
        // worse than saying so: the card itself is the thing that needs a decision.
        console.log(`${label}  the site will not sell this stay any more — needs a new date, left alone`);
        if (live) { drifted++; unsellable++; } else draftDrift++;
        continue;
      }
      checked++;
      const real = body.pricing.totalPrice;
      const shown = s.priceHint ?? null;
      if (shown == null) { console.log(`${label}  no price shown · site says ${real}`); continue; }
      const diff = shown - real;
      const pct = (diff / real) * 100;
      if (Math.abs(diff) < 1) { console.log(`${label}  ${Math.round(shown)} — matches`); continue; }
      if (live) drifted++; else draftDrift++;
      console.log(`${label}  page says ${Math.round(shown)} · site charges ${Math.round(real)} · ` +
        `${diff > 0 ? 'OVERSTATED' : 'UNDERSTATED'} by ${Math.abs(Math.round(diff))} (${pct.toFixed(1)}%)` +
        `${WRITE ? `  ->  ${Math.round(real)}` : ''}`);
      const at = next.findIndex((x) => x.start === s.start && x.end === s.end && x.guests === s.guests);
      if (at > -1) { next[at].priceHint = real; touched = true; }
    }

    if (touched && WRITE) {
      await doc.ref.update({ exampleStays: next, updatedAt: new Date().toISOString(),
        updatedBy: 'scripts/landing-price-check.ts' });
      fixed += next.filter((x, i) => x.priceHint !== stays[i].priceHint).length;
      console.log(`  written.`);
    }
  }

  console.log(`\n${drifted} of ${checked + drifted} card(s) on PUBLISHED pages no longer match the site` +
              `${draftDrift ? `; ${draftDrift} more on drafts nobody can reach` : ''}` +
              `${expired ? `; ${expired} already in the past` : ''}.`);
  if (WRITE) console.log(`${fixed} card price(s) corrected.`);
  else if (drifted) console.log('Dry run. Re-run with --write to correct them.');
  if (unsellable) console.log(`${unsellable} card(s) cannot be priced at all and need new dates.`);
  console.log('');
  process.exit(0);
})();
