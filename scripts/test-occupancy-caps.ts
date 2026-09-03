#!/usr/bin/env npx tsx
/**
 * Live integration test for the occupancy caps on /api/check-pricing.
 *
 * The rule is a TOTAL WITH AN ADULT CAP, not two independent caps:
 *
 *     1 <= adults <= maxAdults
 *     adults + children <= maxGuests
 *
 * Two properties are asserted here, and the second is the one that matters most:
 *
 * 1. The caps are enforced. Before this existed the route priced ANY headcount - 8 guests came back
 *    with a real total for a house that sleeps 7 - and 7 adults were sellable in a place that sleeps
 *    at most 5 of them.
 *
 * 2. **No price moved.** A child costs the same as an adult above base occupancy, deliberately (the
 *    separate child rate was considered and deferred - see plans/occupancy-adults-children.md). So a
 *    stated split must quote EXACTLY what the same headcount quotes without one. This is the whole
 *    safety argument for the change, and it is a strict equality rather than a judgement.
 *
 * Also guards the backward-compatible path: a caller sending a bare `guests` count gets today's
 * behaviour, because a headcount says nothing about composition and applying the adult cap to it
 * would refuse a legitimate family of six. `scripts/parity-pack.ts` depends on exactly this.
 *
 * Prerequisites: a server (npm run dev), and price calendars for the window below.
 *
 * Usage:
 *   npx tsx scripts/test-occupancy-caps.ts
 *   npx tsx scripts/test-occupancy-caps.ts https://prahova-chalet.ro
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '../src/lib/firebaseAdminSafe';

const BASE_URL = process.argv[2] || 'http://localhost:9002';
const PROPERTY_ID = 'prahova-mountain-chalet';

/** A window that is open and priced. Any free two nights would do. */
const CHECK_IN = '2026-11-20';
const CHECK_OUT = '2026-11-22';

let passed = 0;
let failed = 0;

async function quote(body: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/api/check-pricing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId: PROPERTY_ID, checkIn: CHECK_IN, checkOut: CHECK_OUT, ...body }),
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, json, total: json?.pricing?.total ?? null, reason: json?.reason ?? null };
}

function check(label: string, ok: boolean, detail: string) {
  process.stdout.write(`  ${label} ... `);
  if (ok) { console.log(`PASS (${detail})`); passed++; }
  else { console.log(`FAIL: ${detail}`); failed++; }
}

async function run() {
  console.log('===========================================');
  console.log('  Occupancy caps on /api/check-pricing');
  console.log(`  Server: ${BASE_URL}`);
  console.log(`  Window: ${CHECK_IN} -> ${CHECK_OUT}`);
  console.log('===========================================\n');

  const db = await getAdminDb();
  const prop = (await db!.collection('properties').doc(PROPERTY_ID).get()).data()!;
  const maxGuests: number = prop.maxGuests;
  const maxAdults: number | undefined = prop.maxAdults;
  console.log(`  Live limits: maxGuests ${maxGuests}, maxAdults ${maxAdults ?? '(none)'}\n`);

  if (!maxAdults || maxAdults >= maxGuests) {
    console.log('  This property states no binding adult cap; the adult assertions are skipped.\n');
  }

  // ---- accepted parties ----
  console.log('  Accepted:');
  const legal = await quote({ guests: maxGuests });
  check(`headcount ${maxGuests} (the ceiling)`, legal.status === 200 && legal.total !== null,
    `HTTP ${legal.status}, total ${legal.total}`);

  const solo = await quote({ adults: 1, children: 0 });
  check('1 adult alone (the two-adult minimum was declined)', solo.status === 200,
    `HTTP ${solo.status}`);

  // ---- refusals ----
  console.log('\n  Refused:');
  const overCeiling = await quote({ guests: maxGuests + 1 });
  check(`headcount ${maxGuests + 1} is above the ceiling`,
    overCeiling.status === 400 && overCeiling.reason === 'too_many_guests',
    `HTTP ${overCeiling.status}, reason ${overCeiling.reason}`);

  const kidsAlone = await quote({ adults: 0, children: 3 });
  check('children with no adult',
    kidsAlone.status === 400 && kidsAlone.reason === 'no_adult',
    `HTTP ${kidsAlone.status}, reason ${kidsAlone.reason}`);

  if (maxAdults && maxAdults < maxGuests) {
    const tooManyAdults = await quote({ adults: maxAdults + 1, children: 0 });
    check(`${maxAdults + 1} adults, though ${maxAdults + 1} PEOPLE would fit`,
      tooManyAdults.status === 400 && tooManyAdults.reason === 'too_many_adults',
      `HTTP ${tooManyAdults.status}, reason ${tooManyAdults.reason}`);

    const allAdults = await quote({ adults: maxGuests, children: 0 });
    check(`${maxGuests} adults (the ceiling, all adults)`,
      allAdults.status === 400 && allAdults.reason === 'too_many_adults',
      `HTTP ${allAdults.status}, reason ${allAdults.reason}`);
  }

  const mismatch = await quote({ adults: 3, children: 1, guests: 5 });
  check('a caller that disagrees with its own headcount',
    mismatch.status === 400 && mismatch.reason === 'party_mismatch',
    `HTTP ${mismatch.status}, reason ${mismatch.reason}`);

  // ---- the equality that proves no price moved ----
  console.log('\n  Same money, split or not:');
  for (let headcount = 2; headcount <= maxGuests; headcount++) {
    const bare = await quote({ guests: headcount });
    if (bare.status !== 200) continue;

    // Every legal way to make this headcount, given the adult cap.
    const cap = Math.min(maxAdults ?? headcount, headcount);
    for (let adults = 1; adults <= cap; adults++) {
      const children = headcount - adults;
      const split = await quote({ adults, children });
      if (split.status !== 200) {
        check(`${adults}a+${children}c should be quotable`, false, `HTTP ${split.status} ${split.reason}`);
        continue;
      }
      check(`${adults}a+${children}c === headcount ${headcount}`,
        split.total === bare.total,
        `${split.total} vs ${bare.total}`);
    }
  }

  console.log('\n===========================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('===========================================');
  if (failed) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
