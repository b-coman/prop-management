#!/usr/bin/env npx tsx
/**
 * seed-september-landings — the two September campaign landing pages.
 *
 * September is the month August wasn't: 24 of 30 nights open (blocked only
 * 11-12 and 18-21) against two sellable nights left in August, which is why the
 * aug-heat flight was pointed at a sold-out window.
 *
 * Two pages rather than one, because they are two different products and the
 * split has to survive into measurement: utm_campaign is the adCampaigns doc
 * id, so two campaigns give two attributable utm values. Two ad sets under one
 * campaign would share a budget, let Meta starve whichever angle lost the first
 * 48 hours, and collapse into a single utm we could never take apart.
 *
 *   zacusca-liniste  weekends, friends, autumn food, Peleș without the crowds
 *   birou-veverite   mid-week, work from the terrace, 7-night discount
 *
 * PRICES ARE FETCHED LIVE, NOT WRITTEN DOWN (changed 2026-08-17)
 * -------------------------------------------------------------
 * The first version hardcoded priceHint from a one-off engine quote. That drifted
 * the moment the rate card changed: the 2026-08-17 repricing (short-stay
 * length-of-stay tiers 3n -10% / 4n -15%, plus filling the 1-8 Sep period hole)
 * left all four hints 20-30% too high, advertising prices the booking form would
 * no longer charge. So this script now quotes POST /api/check-pricing at apply
 * time and refuses to write if any window is unavailable — the aug-heat failure
 * mode was advertising two stays that were fully blocked.
 *
 * OCCUPANCY IS THE ADVERTISED OCCUPANCY
 * ------------------------------------
 * `guests` is not cosmetic: landing-renderer shows priceHint as the "from" price
 * and getLanding bakes `guests` into bookUrl, so the two must agree or the guest
 * clicks through to a different number. Advertised at the counts the ads state —
 * 4 for the friends angle, 3 for the work angle — not at maxGuests.
 *
 * Usage:
 *   npx tsx scripts/seed-september-landings.ts           # dry run, prints live quotes
 *   npx tsx scripts/seed-september-landings.ts --apply
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apply = process.argv.includes('--apply');
const sa = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!sa) {
  console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(path.resolve(sa)) });

const P = 'prahova-mountain-chalet';
const BASE = process.env.LANDING_QUOTE_BASE_URL ?? 'https://prahova-chalet.ro';
const img = (n: string) => `properties/${P}/images/${n}`;

/**
 * PHOTOS COME FROM THE CAMPAIGN, NOT FROM THIS FILE (changed 2026-08-17)
 * ---------------------------------------------------------------------
 * These pages were hand-seeded before their campaigns existed, so the photos were picked from
 * filenames and memory — and it showed: nine of ten slots were summer shots on a campaign whose
 * whole pitch is summer turning to autumn, while six autumn images sat unused in the gallery.
 *
 * The ad copywriter picks assets with every image's `aiDescription` in front of it, and it chose
 * the fire-pit-at-night, the autumn foliage exterior and Peleș in autumn unprompted. Reading the
 * set back from the campaign is what makes the page show the same thing the ad promised — the
 * "scent-match" generateLanding.ts is built around. First photo is the hero, the rest the gallery.
 *
 * Copy is NOT taken from the campaign: the Romanian here is the owner's own and outranks anything
 * the copywriter would write.
 */
const CAMPAIGN_OF: Record<string, string> = {
  'zacusca-liniste': 'fzv0oAQa2W3rraGTjLP2',
  'birou-veverite': 'F1ZTyVxnQn4iXxke5o00',
};

async function photosFromCampaign(db: admin.firestore.Firestore, slug: string): Promise<string[] | null> {
  const id = CAMPAIGN_OF[slug];
  if (!id) return null;
  const snap = await db.collection('adCampaigns').doc(id).get();
  if (!snap.exists) return null;
  const paths = ((snap.data() as any)?.proposal?.photos ?? [])
    .map((p: any) => p?.storagePath)
    .filter((s: unknown): s is string => typeof s === 'string' && s.length > 0);
  return paths.length ? [...new Set<string>(paths)] : null;
}

/** Quote the real booking total. Returns null when the window is not bookable. */
async function quote(start: string, end: string, guests: number): Promise<number | null> {
  const r = await fetch(`${BASE}/api/check-pricing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId: P, checkIn: start, checkOut: end, guests }),
  });
  const d: any = await r.json();
  return d?.pricing?.total ?? null;
}

const ZACUSCA = {
  propertyId: P,
  defaultLanguage: 'ro',
  status: 'published',
  period: {
    kind: 'window',
    start: '2026-09-01',
    end: '2026-09-30',
    label: { en: 'Autumn on the grill · September', ro: 'Toamna pe grătar · septembrie' },
  },
  hero: {
    imagePath: img('94ea2267-1e73-4a53-9c77-6040cc2c5305.webp'),
    // Romanian is the original, written by the owner (2026-08-17). English follows it rather than the
    // other way round: "zacuscă la ceaun" is the hook and does not survive being translated into a
    // generic grill line, which is what the first version did.
    headline: {
      en: 'Aubergines on the coals, zacuscă in the cauldron',
      ro: 'Vinete pe jar și zacuscă la ceaun',
    },
    subcopy: {
      en: 'An hour from Bucharest. The city is still hot, the children are back at school, and quiet has settled over the Bucegi and the Prahova Valley.',
      ro: 'La o oră de București. În oraș e tot cald, copiii s-au întors la școală, iar liniștea s-a așternut peste Bucegi și Valea Prahovei.',
    },
  },
  story: {
    title: {
      en: 'September is exactly the right time',
      ro: 'Septembrie e perioada perfectă',
    },
    body: {
      en: 'Warm enough to spend the whole day in the garden, quiet enough that you hear the forest. The peppers and aubergines go on the grate, a stew goes in the cauldron. Peleș and Sinaia are twenty minutes away and, for the first time since June, almost empty.',
      ro: 'Destul de cald cât să stai toată ziua în grădină, destul de liniștit cât să auzi pădurea. Ardeii și vinetele merg pe grătar, o tocană merge la ceaun. Peleșul și Sinaia sunt la douăzeci de minute și, pentru prima oară din iunie, aproape goale.',
    },
  },
  // Verified open in the availability calendar; totals quoted live at apply time.
  exampleStays: [
    {
      start: '2026-09-04', end: '2026-09-07', nights: 3, guests: 4, priceHint: null as number | null,
      label: { en: 'A long weekend, start of September', ro: 'Un weekend prelungit, început de septembrie' },
      occasion: 'Weekend cu prietenii',
    },
    {
      start: '2026-09-25', end: '2026-09-28', nights: 3, guests: 4, priceHint: null as number | null,
      label: { en: 'The last warm weekend', ro: 'Ultimul weekend cald' },
    },
  ],
  gallery: [
    img('e243a8e6-f616-4df9-ac36-3a1676f845e7.webp'),
    img('ad-gulas-firepit.jpg'),
    img('255585e5-6043-4e62-9f73-55824759d29c.webp'),
    img('75908024-392c-4615-9c16-e9439baf1716.webp'),
  ],
  offer: {
    text: {
      en: '3 nights, 10% off - direct booking, no commission',
      ro: '3 nopți, 10% reducere - rezervare directă, fără comision',
    },
  },
  cta: { showBooking: true },
  createdBy: 'seed-script',
};

const BIROU = {
  propertyId: P,
  defaultLanguage: 'ro',
  status: 'published',
  period: {
    kind: 'window',
    start: '2026-09-01',
    end: '2026-09-30',
    label: { en: 'Work from the mountain · September', ro: 'Lucrezi de la munte · septembrie' },
  },
  hero: {
    imagePath: img('8dd1f1ae-bb30-4fcb-bb2d-758260fbd430.webp'),
    headline: {
      en: 'Your office, with a view of squirrels',
      ro: 'Biroul tău, cu vedere la veverițe',
    },
    subcopy: {
      en: 'An hour from Bucharest, on a covered terrace under the trees. Work the week from here, and finish the day at the fire instead of in traffic.',
      ro: 'La o oră de București, pe o terasă acoperită, sub copaci. Lucrează săptămâna de aici și termină ziua la foc, nu în trafic.',
    },
  },
  story: {
    title: {
      en: 'Half a week here costs less than you think',
      ro: 'O jumătate de săptămână aici costă mai puțin decât crezi',
    },
    // The seven-night claim is checked against the engine, same window: 22-26 Sep (4n) quotes
    // 1,897 and 22-29 Sep (7n) quotes 2,843, so the last three nights cost about half the first four.
    body: {
      en: 'The terrace is covered, the table is long enough to spread out on, and the only thing that will interrupt you is something moving in the branches. September mid-weeks are the quietest of the year here. Stay seven nights and the price drops by a quarter - which makes the last three nights cost about half of what the first four did.',
      ro: 'Terasa e acoperită, masa e destul de lungă cât să te întinzi pe ea, iar singurul lucru care te întrerupe e ceva care mișcă printre crengi. Mijlocul de săptămână, în septembrie, e cel mai liniștit din an aici. Stai șapte nopți și prețul scade cu un sfert - așa că ultimele trei nopți costă cam jumătate din cât au costat primele patru.',
    },
  },
  exampleStays: [
    {
      start: '2026-09-14', end: '2026-09-18', nights: 4, guests: 3, priceHint: null as number | null,
      label: { en: 'Monday to Friday', ro: 'De luni până vineri' },
      occasion: 'Lucru de la munte',
    },
    {
      start: '2026-09-22', end: '2026-09-29', nights: 7, guests: 3, priceHint: null as number | null,
      label: { en: 'A full week - 25% off', ro: 'O săptămână întreagă - 25% reducere' },
    },
  ],
  gallery: [
    img('75908024-392c-4615-9c16-e9439baf1716.webp'),
    img('ad-firepit-night.png'),
    img('255585e5-6043-4e62-9f73-55824759d29c.webp'),
    img('e243a8e6-f616-4df9-ac36-3a1676f845e7.webp'),
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
  const pages: Array<[string, Record<string, unknown>]> = [
    ['zacusca-liniste', ZACUSCA],
    ['birou-veverite', BIROU],
  ];

  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}   quoting from ${BASE}\n`);

  // Pull the campaign's asset set so the page shows what the ad promised. Falls back to whatever is
  // in this file if the campaign is missing, so the seed still works before a campaign exists.
  for (const [slug, doc] of pages) {
    const paths = await photosFromCampaign(db, slug);
    if (!paths) { console.log(`  /lp/${slug}  no campaign photos — keeping the ones in this file`); continue; }
    (doc as any).campaignRef = CAMPAIGN_OF[slug];
    (doc as any).hero.imagePath = paths[0];
    (doc as any).gallery = paths.slice(1, 7);
  }

  // Quote every stay first. A page with an unbookable or unpriced stay is not written at all.
  let blocked = 0;
  for (const [slug, doc] of pages) {
    for (const s of (doc as any).exampleStays) {
      const total = await quote(s.start, s.end, s.guests);
      if (total === null) {
        console.log(`  /lp/${slug}  ${s.start}..${s.end} ${s.guests}g  NOT BOOKABLE — refusing to advertise it`);
        blocked++;
        continue;
      }
      s.priceHint = total;
    }
  }
  if (blocked) {
    console.error(`\n${blocked} stay(s) unavailable or unpriced. Nothing written. Pick different dates.`);
    process.exit(1);
  }

  for (const [slug, doc] of pages) {
    const ref = db.collection('landingPages').doc(slug);
    const existing = await ref.get();
    console.log(`  /lp/${slug}  ${existing.exists ? '(OVERWRITES existing)' : '(new)'}`);
    console.log(`     hero    : ${(doc as any).hero.headline.ro}`);
    console.log(`     offer   : ${(doc as any).offer.text.ro}`);
    console.log(`     stays   : ${(doc as any).exampleStays.map((s: any) => `${s.start}..${s.end} ${s.nights}n ${s.guests}g ${s.priceHint} RON`).join('  |  ')}`);
    console.log(`     gallery : ${(doc as any).gallery.length} photos`);
    if (!apply) continue;
    await ref.set(
      { ...doc, updatedAt: admin.firestore.FieldValue.serverTimestamp(), createdAt: existing.exists ? existing.data()!.createdAt : admin.firestore.FieldValue.serverTimestamp() },
      { merge: false }
    );
    console.log('     written');
  }
  if (!apply) console.log('\n  dry run; re-run with --apply');
  process.exit(0);
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
