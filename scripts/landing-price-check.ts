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
 * Read-only.
 *
 *   npx tsx scripts/landing-price-check.ts [slug]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const ONLY = process.argv[2];
const BASE = process.env.PARITY_BASE_URL ?? 'http://localhost:9002';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Stay { start: string; end: string; nights: number; guests?: number | null; priceHint?: number | null }

(async () => {
  const db = await getAdminDb();
  const docs = (await db.collection('landingPages').get()).docs
    .filter((d) => !ONLY || d.id === ONLY);

  const today = new Date().toISOString().slice(0, 10);
  let drifted = 0, checked = 0, expired = 0;
  for (const doc of docs) {
    const d = doc.data() as { status?: string; propertyId: string; exampleStays?: Stay[] };
    const stays = d.exampleStays ?? [];
    console.log(`\n${doc.id}  (${d.status ?? 'no status'})  ${stays.length} card(s)`);
    if (!stays.length) continue;

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
        console.log(`${label}  the site will not sell this stay any more`);
        drifted++; continue;
      }
      checked++;
      const real = body.pricing.totalPrice;
      const shown = s.priceHint ?? null;
      if (shown == null) { console.log(`${label}  no price shown · site says ${real}`); continue; }
      const diff = shown - real;
      const pct = (diff / real) * 100;
      if (Math.abs(diff) < 1) { console.log(`${label}  ${Math.round(shown)} — matches`); continue; }
      drifted++;
      console.log(`${label}  page says ${Math.round(shown)} · site charges ${Math.round(real)} · ` +
        `${diff > 0 ? 'OVERSTATED' : 'UNDERSTATED'} by ${Math.abs(Math.round(diff))} (${pct.toFixed(1)}%)`);
    }
  }
  console.log(`\n${drifted} of ${checked + drifted} live card(s) no longer match the site` +
              `${expired ? `; ${expired} more have already passed` : ''}.\n`);
  process.exit(0);
})();
