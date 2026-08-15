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
 * Every price here came from the LIVE engine (POST /api/check-pricing) rather
 * than being recomputed, so the page cannot drift from what the booking form
 * will quote. Every window was checked against the availability calendar — the
 * aug-heat page advertised two stays that were fully blocked.
 *
 * Usage:
 *   npx tsx scripts/seed-september-landings.ts           # dry run
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
const img = (n: string) => `properties/${P}/images/${n}`;

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
    headline: {
      en: 'Peppers on the fire, and the mountain to yourselves',
      ro: 'Ardei pe jar, și muntele numai al vostru',
    },
    subcopy: {
      en: 'An hour from Bucharest. The city is still hot, the crowds have gone back to school, and the grill is finally the right temperature for peppers and aubergines.',
      ro: 'La o oră de București. În oraș e tot cald, lumea s-a întors la școală, iar grătarul e în sfârșit numai bun de ardei și vinete.',
    },
  },
  story: {
    title: {
      en: 'September is the good half of both seasons',
      ro: 'Septembrie e jumătatea bună din amândouă anotimpurile',
    },
    body: {
      en: 'Warm enough to spend the whole day in the garden, quiet enough that you hear the forest. The peppers and aubergines go on the grate, a stew goes in the cauldron, and nobody is in a hurry. Peleș and Sinaia are twenty minutes away and, for the first time since June, almost empty.',
      ro: 'Destul de cald cât să stai toată ziua în grădină, destul de liniștit cât să auzi pădurea. Ardeii și vinetele merg pe grătar, o tocană merge la ceaun, și nu se grăbește nimeni. Peleșul și Sinaia sunt la douăzeci de minute și, pentru prima oară din iunie, aproape goale.',
    },
  },
  // Verified open in the availability calendar; totals from POST /api/check-pricing.
  exampleStays: [
    {
      start: '2026-09-04', end: '2026-09-07', nights: 3, guests: 6, priceHint: 2765,
      label: { en: 'A long weekend, start of September', ro: 'Un weekend prelungit, început de septembrie' },
      occasion: 'Weekend cu prietenii',
    },
    {
      start: '2026-09-25', end: '2026-09-28', nights: 3, guests: 6, priceHint: 2576,
      label: { en: 'The last warm weekend', ro: 'Ultimul weekend cald' },
    },
  ],
  gallery: [
    img('e243a8e6-f616-4df9-ac36-3a1676f845e7.webp'),
    img('ad-gulas-firepit.jpg'),
    img('255585e5-6043-4e62-9f73-55824759d29c.webp'),
    img('75908024-392c-4615-9c16-e9439baf1716.webp'),
  ],
  offer: { text: { en: 'Direct booking — no commission', ro: 'Rezervare directă, fără comision' } },
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
    body: {
      en: 'The terrace is covered, the table is long enough to spread out on, and the only thing that will interrupt you is something moving in the branches. September mid-weeks are the quietest of the year here. Stay seven nights and the price drops by a quarter — which makes the extra three nights cost less than the first four.',
      ro: 'Terasa e acoperită, masa e destul de lungă cât să te întinzi pe ea, iar singurul lucru care te întrerupe e ceva care mișcă printre crengi. Mijlocul de săptămână, în septembrie, e cel mai liniștit din an aici. Stai șapte nopți și prețul scade cu un sfert — așa că ultimele trei nopți costă mai puțin decât primele patru.',
    },
  },
  exampleStays: [
    {
      start: '2026-09-14', end: '2026-09-18', nights: 4, guests: 6, priceHint: 2990,
      label: { en: 'Monday to Friday', ro: 'De luni până vineri' },
      occasion: 'Lucru de la munte',
    },
    {
      start: '2026-09-22', end: '2026-09-29', nights: 7, guests: 6, priceHint: 4024.5,
      label: { en: 'A full week — 25% off', ro: 'O săptămână întreagă — 25% reducere' },
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
      en: '7 nights, 25% off — direct booking, no commission',
      ro: '7 nopți, 25% reducere — rezervare directă, fără comision',
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

  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}\n`);
  for (const [slug, doc] of pages) {
    const ref = db.collection('landingPages').doc(slug);
    const existing = await ref.get();
    console.log(`  /lp/${slug}  ${existing.exists ? '(OVERWRITES existing)' : '(new)'}`);
    console.log(`     hero    : ${(doc as any).hero.headline.ro}`);
    console.log(`     stays   : ${(doc as any).exampleStays.map((s: any) => `${s.start}..${s.end} ${s.nights}n ${s.priceHint} RON`).join('  |  ')}`);
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
