#!/usr/bin/env npx tsx
/**
 * seed-toamna-lunga-landing — the retargeting landing page for the 22 Sep - 8 Oct opening.
 *
 * WHY A THIRD PAGE rather than pointing the retargeting ad at /lp/birou-veverite: the audience for
 * this ad is people who have ALREADY been on the site, and most of them arrived through
 * birou-veverite (516 of 778 paid sessions in August). Showing them the same page again offers them
 * nothing they have not already declined once. A warm visitor needs the decision made concrete -
 * real open dates, real totals - not the atmosphere pitch that won the first click.
 *
 * THE OFFER IS ARITHMETIC, NOT ADJECTIVES
 * ---------------------------------------
 * Quoted live 2026-09-02 at 2 guests: a plain Fri-Sun weekend is 1,253 lei (627/night); seven nights
 * 22-29 Sep is 2,458.50 (351/night). Two separate weekends would be 2,506 lei for four nights. So a
 * full week costs LESS than two weekends and gives seven nights instead of four. That is the whole
 * pitch and it is checkable, which is why the headline states it plainly.
 *
 * It falls out of the length-of-stay ladder already in the rate card (-15% at 4 nights, -25% at 7),
 * so it rewards exactly the behaviour worth selling here: the midweek nights are both the cheapest
 * (405 vs 526.50) and the most available.
 *
 * OCCUPANCY IS 2, DELIBERATELY. The target is a couple working remotely, not the 7-person capacity.
 * `guests` is baked into bookUrl and drives priceHint, so advertising at 2 and quoting at 2 is what
 * keeps the page and the booking form telling the same story.
 *
 * PRICES ARE QUOTED LIVE AT APPLY TIME and the script refuses to write if any window is unbookable -
 * the same guard as seed-september-landings.ts, for the same reason: a page that advertises a sold
 * stay is worse than no page.
 *
 * NOTE the headline depends on the current rate card. After any repricing, re-run
 * `scripts/landing-price-check.ts` - a frozen priceHint drifts silently.
 *
 * Usage:
 *   npx tsx scripts/seed-toamna-lunga-landing.ts           # dry run, prints live quotes
 *   npx tsx scripts/seed-toamna-lunga-landing.ts --apply
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apply = process.argv.includes('--apply');
const sa = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!sa) { console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(path.resolve(sa)) });

const P = 'prahova-mountain-chalet';
const SLUG = 'toamna-lunga';
const BASE = process.env.LANDING_QUOTE_BASE_URL ?? 'https://prahova-chalet.ro';
const img = (n: string) => `properties/${P}/images/${n}`;

/** Quote the real booking total. Returns null when the window is not bookable. */
async function quote(start: string, end: string, guests: number): Promise<number | null> {
  const r = await fetch(`${BASE}/api/check-pricing`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId: P, checkIn: start, checkOut: end, guests }),
  });
  const d: any = await r.json();
  return d?.pricing?.totalPrice ?? d?.pricing?.total ?? null;
}

const DOC = {
  propertyId: P,
  defaultLanguage: 'ro',
  status: 'published',
  period: {
    kind: 'window',
    start: '2026-09-22',
    end: '2026-10-08',
    label: { en: 'A long autumn · late September to early October', ro: 'Toamnă lungă · sfârșit de septembrie, început de octombrie' },
  },
  hero: {
    // The covered-terrace desk shot the birou campaign is built on. Same product, so the same
    // promise: this is a place you can actually work from.
    imagePath: img('8dd1f1ae-bb30-4fcb-bb2d-758260fbd430.jpg'),
    headline: {
      en: 'Seven nights cost less than two weekends',
      ro: 'Șapte nopți costă mai puțin decât două weekenduri',
    },
    subcopy: {
      en: 'An hour from Bucharest, with fibre internet and a covered terrace. From 22 September to 8 October the house is free, all of it.',
      ro: 'La o oră de București, cu internet prin fibră optică și terasă acoperită. De pe 22 septembrie până pe 8 octombrie casa e liberă, toată.',
    },
  },
  story: {
    title: {
      en: 'It is not leave if you are working. It is just a different view.',
      ro: 'Nu e concediu dacă lucrezi. E doar altă priveliște.',
    },
    body: {
      en: 'The rate drops 15% at four nights and 25% at a full week, and midweek nights are the cheapest of all - so the longer you stay, the less each night costs. Tuesday to Tuesday, work from the terrace, and finish the day at the fire instead of in traffic. The firewood is on the house, and the internet is unlimited.',
      ro: 'Prețul scade cu 15% de la patru nopți și cu 25% la o săptămână întreagă, iar nopțile din mijlocul săptămânii sunt oricum cele mai ieftine. Așa că, cu cât stai mai mult, cu atât te costă mai puțin fiecare noapte. De marți până marți, lucrezi de pe terasă și termini ziua la foc, nu în trafic. Lemnele sunt din partea casei, iar internetul e la discreție.',
    },
  },
  // All three verified open in the availability calendar (22 Sep - 8 Oct is one unbroken run;
  // the next booking is 9 Oct). Totals quoted live at apply time.
  exampleStays: [
    {
      start: '2026-09-22', end: '2026-09-29', nights: 7, guests: 2, priceHint: null as number | null,
      label: { en: 'A full week, Tuesday to Tuesday - 25% off', ro: 'O săptămână întreagă, de marți până marți - 25% reducere' },
      occasion: 'Lucru de la munte',
    },
    {
      start: '2026-09-28', end: '2026-10-02', nights: 4, guests: 2, priceHint: null as number | null,
      label: { en: 'Monday to Friday - 15% off', ro: 'De luni până vineri - 15% reducere' },
    },
    {
      start: '2026-10-04', end: '2026-10-09', nights: 5, guests: 2, priceHint: null as number | null,
      label: { en: 'The first week of October, Sunday to Friday', ro: 'Prima săptămână din octombrie, de duminică până vineri' },
    },
  ],
  gallery: [
    img('8dd1f1ae-bb30-4fcb-bb2d-758260fbd430.jpg'),
    img('b3061ab5-ded4-4310-9bd3-535fc045fbdf.jpg'),
    img('591c5aee-adac-48b2-af10-a849d3ea801e.jpg'), // covered balcony - proves "terasă acoperită"
    img('ad-firepit-night.png'),
    img('255585e5-6043-4e62-9f73-55824759d29c.jpg'),
    img('cf36070f-6a4c-422c-b72c-72f4983e7607.jpg'), // stone fireplace - the indoor evening
  ],
  offer: {
    text: {
      en: '7 nights, 25% off - direct booking, no commission',
      ro: '7 nopți, 25% reducere - rezervare directă, fără comision',
    },
  },
  cta: { showBooking: true },
  createdBy: 'seed-script',
};

(async () => {
  const db = admin.firestore();
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}   quoting from ${BASE}\n`);

  let blocked = 0;
  for (const s of DOC.exampleStays) {
    const total = await quote(s.start, s.end, s.guests);
    if (total === null) {
      console.log(`  ${s.start}..${s.end} ${s.guests}g  NOT BOOKABLE - refusing to advertise it`);
      blocked++; continue;
    }
    s.priceHint = total;
    console.log(`  ${s.start}..${s.end}  ${s.nights}n ${s.guests}g  ${total} RON  (${(total / s.nights).toFixed(0)}/night)`);
  }
  if (blocked) {
    console.error(`\n${blocked} stay(s) unavailable. Nothing written. Pick different dates.`);
    process.exit(1);
  }

  const ref = db.collection('landingPages').doc(SLUG);
  const existing = await ref.get();
  console.log(`\n  /lp/${SLUG}  ${existing.exists ? '(OVERWRITES existing)' : '(new)'}`);
  console.log(`     hero  : ${DOC.hero.headline.ro}`);
  console.log(`     offer : ${DOC.offer.text.ro}`);

  if (!apply) { console.log('\nDry run. Re-run with --apply to write.'); return; }
  await ref.set({ ...DOC, slug: SLUG }, { merge: false });
  console.log(`\nWritten. https://prahova-chalet.ro/lp/${SLUG}/ro`);
})().catch((e) => { console.error(e); process.exit(1); });
