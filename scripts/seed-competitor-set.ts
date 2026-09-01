#!/usr/bin/env npx tsx
/**
 * seed-competitor-set — loads the owner's curated comparable set into `competitorListings`.
 *
 * Every field here was READ from the live listing pages on 2026-09-01 (docs/competitive-position-engine.md
 * §12-14), never inferred. Two things about that are worth knowing before editing this file:
 *
 *  - **Capacity comes from `Max persons` or a counted bed configuration.** Never from Booking's
 *    `Sleeps:` or `Recommended for` lines, which echo the search occupancy back at you: the same Vila
 *    Luna unit reads "4 adults, 2 children" or "8 adults" depending only on what you asked for. Its
 *    real capacity is 11.
 *  - **`substitutionBasis` is a DRAFT** until the owner edits it, and every row carries
 *    `curatedBy: 'claude (draft)'` and `verifiedAt: null` to say so. C1 requires the owner's reasoning,
 *    and recording a guess as his would defeat the field's whole purpose.
 *
 *   npx tsx scripts/seed-competitor-set.ts            # report what would change; writes nothing
 *   npx tsx scripts/seed-competitor-set.ts --write
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import {
  upsertCompetitorListing, retireCompetitorListing, getCompetitorSet,
} from '@/services/competitorSetService';
import { validateListing, hostsParty, largestUnit, type CompetitorListing } from '@/lib/competitive/set';
import { DEFAULT_PARTIES, partyLabel } from '@/lib/parity/party';

const PROPERTY = process.argv[2]?.startsWith('--') ? 'prahova-mountain-chalet'
  : (process.argv[2] ?? 'prahova-mountain-chalet');
const WRITE = process.argv.includes('--write');
/**
 * The owner read the drafted reasons and accepted them on 2026-09-02 ("the substitutionBasis is
 * good"), so they are his now — but the provenance stays honest about how they got there: drafted
 * from page reads, then approved. Utopia and Zaivan carry their own `curatedBy` because he wrote
 * those two himself.
 */
const CURATED_BY = 'owner (approved 2026-09-02; drafted by claude)';

type Seed = Omit<CompetitorListing, 'propertyId' | 'curatedBy' | 'verifiedAt' | 'active'> & {
  /** Set when the OWNER has stated why this competes. Absent means the basis is still my draft. */
  curatedBy?: string;
};

const AIRBNB = (id: string) => `https://www.airbnb.com/rooms/${id}`;
const BK = (slug: string) => `https://www.booking.com/hotel/ro/${slug}.en-gb.html`;
const one = (label: string, maxPersons: number, sqm?: number) =>
  [{ label, maxPersons, count: 1, sqm: sqm ?? null }];

/**
 * AIRBNB FIELD — capacity from each listing's own header, which is a property attribute: verified
 * stable across `?adults=2` and `?adults=5` on the same listing, unlike Booking's.
 */
const AIRBNB_SET: Seed[] = [
  {
    listingId: 'peaceful-forest-haven', displayName: 'Peaceful Forest Haven, Cozy 3-Bedroom Villa',
    channel: 'airbnb', url: AIRBNB('1684046575755230509'), city: 'Comarnic', heroPhotoUrl: null,
    units: one('Entire cabin', 6), propertyType: 'cabin', distanceKm: null,
    rating: 5.0, reviewCount: 5, qualityAsOf: '2026-09-01', amenities: ['hot tub', 'pool'],
    substitutionBasis:
      'Closest Airbnb match on layout: same town, whole cabin, three bedrooms like ours, same ' +
      'headcount. Adds a hot tub and pool we do not have. The default comparison for a family of 5-6.',
  },
  {
    listingId: 'ava-chalet-ab', displayName: 'AVA Chalet with Jacuzzi',
    channel: 'airbnb', url: AIRBNB('1404937633401111364'), city: 'Comarnic', heroPhotoUrl: null,
    units: one('Entire villa', 6), propertyType: 'villa', distanceKm: null,
    rating: 4.93, reviewCount: 28, qualityAsOf: '2026-09-01',
    amenities: ['hot tub', 'jacuzzi', 'fireplace'],
    sameAs: { listingId: 'ava-chalet-bk', assertedBy: CURATED_BY, basis: 'identical name, same town, same 6-guest cap' },
    substitutionBasis:
      'Same guest cap as our Airbnb listing, same town, whole villa. Leads on a jacuzzi, so it takes ' +
      'the guest who is choosing on amenity rather than space.',
  },
  {
    listingId: 'adorable-tiny-home', displayName: 'Adorable 2 Bedroom Tiny Home',
    channel: 'airbnb', url: AIRBNB('735210607886819686'), city: 'Comarnic', heroPhotoUrl: null,
    units: one('Entire villa', 6), propertyType: 'villa', distanceKm: null,
    rating: 4.75, reviewCount: 8, qualityAsOf: '2026-09-01', amenities: ['pool'],
    substitutionBasis:
      'Same headcount, fewer bedrooms and a single bathroom. Competes on price for a family of six ' +
      'willing to share, not on comfort.',
  },
  {
    listingId: 'panoramic-view-cabin', displayName: 'Panoramic View Cabin Escape With Bathtub',
    channel: 'airbnb', url: AIRBNB('1598455057261429235'), city: 'Comarnic', heroPhotoUrl: null,
    units: one('Entire cabin', 4), propertyType: 'cabin', distanceKm: null,
    rating: 5.0, reviewCount: 1, qualityAsOf: '2026-09-01', amenities: [],
    substitutionBasis:
      'Whole cabin in Comarnic for a smaller party. Competes for 2+1 and 4-adult stays where the draw ' +
      'is the view and privacy rather than the biggest house. LEAST CONFIDENT of the seven — its page ' +
      'renders thin and was never read in full; re-verify before trusting its record.',
  },
  {
    listingId: 'villa-the-frame-ab', displayName: 'Villa The Frame, 4BR Sauna BBQ & Playground',
    channel: 'airbnb', url: AIRBNB('1046394696894549540'), city: 'Ghioșești', heroPhotoUrl: null,
    units: one('Entire home', 8), propertyType: 'whole-house', distanceKm: null,
    rating: 5.0, reviewCount: 13, qualityAsOf: '2026-09-01',
    amenities: ['sauna', 'fireplace', 'bbq', 'playground'],
    sameAs: { listingId: 'villa-the-frame-bk', assertedBy: CURATED_BY, basis: 'identical name, 4 bedrooms both, 195 m² vs 8 guests' },
    substitutionBasis:
      'A size up, family-oriented (playground, BBQ, sauna), about ten minutes away. Takes our larger ' +
      'family bookings and groups we cannot host at all.',
  },
  {
    listingId: 'ceas-cu-cuc', displayName: 'Panoramic View & Nature Escape - Ceas cu Cuc Cabin',
    channel: 'airbnb', url: AIRBNB('27595549'), city: 'Gura Beliei', heroPhotoUrl: null,
    units: one('Entire cabin', 10), propertyType: 'cabin', distanceKm: null,
    rating: 4.98, reviewCount: 98, qualityAsOf: '2026-09-01', amenities: ['fireplace', 'playground'],
    substitutionBasis:
      'The established incumbent: bigger, and the only listing in the set with real review history ' +
      '(98 against a median of ten). Competes for larger groups and for guests who filter on review ' +
      'count, where we lose to it on volume.',
  },
  {
    listingId: 'msc-forest-retreat', displayName: 'MSC Forest Retreat, Premium A-Frame in Nature',
    channel: 'airbnb', url: AIRBNB('1693310279656307073'), city: 'Poiana', heroPhotoUrl: null,
    units: one('Entire cabin', 3), propertyType: 'cabin', distanceKm: null,
    rating: 5.0, reviewCount: 12, qualityAsOf: '2026-09-01', amenities: [],
    substitutionBasis:
      'Design-led small cabin. Competes only for couples and 2+1 who want the A-frame experience over ' +
      'space — it cannot take our core party.',
  },
];

/**
 * BOOKING FIELD — a separate contest (C8), not an extension of the above.
 *
 * Unit counts are LOWER BOUNDS read from one 24-28 Oct probe: a probe shows what is bookable on those
 * dates, so a property with four cabins and one sold shows three. Verification may raise them.
 */
const BOOKING_SET: Seed[] = [
  {
    listingId: 'vila-luna', displayName: 'Vila Luna',
    channel: 'booking.com', url: BK('vila-luna-comarnic'), city: 'Comarnic', heroPhotoUrl: null,
    units: one('Four-Bedroom House', 11, 200), propertyType: 'whole-house', distanceKm: null,
    rating: 10, reviewCount: 57, qualityAsOf: '2026-09-01', amenities: ['bbq', 'terrace'],
    substitutionBasis:
      'Our most direct Booking competitor: a whole house of our size in our town, perfect score on ' +
      'real volume, and flat-rate whatever the party size (4,180 lei at both 6 and 8 people) — so it ' +
      'beats us by more the larger the group, because we charge per head above three.',
  },
  {
    listingId: 'the-cliff-village', displayName: 'The Cliff Village',
    channel: 'booking.com', url: BK('the-cliff-village'), city: 'Comarnic', heroPhotoUrl: null,
    units: [
      { label: 'One-Bedroom Villa', maxPersons: 4, count: 1, sqm: 80 },
      { label: 'Two-Bedroom Villa', maxPersons: 6, count: 1, sqm: 200 },
      { label: 'Deluxe Villa', maxPersons: 10, count: 1, sqm: 300 },
    ],
    propertyType: 'villa', distanceKm: null,
    rating: 10, reviewCount: 68, qualityAsOf: '2026-09-01', amenities: ['sauna', 'bbq', 'terrace'],
    substitutionBasis:
      'Three villa sizes on one site, so it competes at every party size we sell. Its 200 m² ' +
      'two-bedroom villa is a direct match for our family bookings.',
  },
  {
    listingId: 'villa-the-frame-bk', displayName: 'Villa The Frame',
    channel: 'booking.com', url: BK('villa-the-frame'), city: 'Comarnic', heroPhotoUrl: null,
    units: one('Superior Villa', 8, 195), propertyType: 'whole-house', distanceKm: null,
    rating: 9.7, reviewCount: 21, qualityAsOf: '2026-09-01', amenities: ['sauna'],
    sameAs: { listingId: 'villa-the-frame-ab', assertedBy: CURATED_BY, basis: 'identical name, 4 bedrooms both, 195 m² vs 8 guests' },
    substitutionBasis:
      'The same property as the Airbnb entry, competing separately here, and it discounts on Booking ' +
      '(19% off when read). Watch the two channels apart.',
  },
  {
    listingId: 'ava-chalet-bk', displayName: 'AVA Chalet',
    channel: 'booking.com', url: BK('ava-chalet-comarnic'), city: 'Comarnic', heroPhotoUrl: null,
    units: one('Two-Bedroom Chalet', 6, 120), propertyType: 'cabin', distanceKm: null,
    rating: 9.5, reviewCount: 11, qualityAsOf: '2026-09-01', amenities: [],
    sameAs: { listingId: 'ava-chalet-ab', assertedBy: CURATED_BY, basis: 'identical name, same town, same 6-guest cap' },
    substitutionBasis:
      'The same property as the Airbnb entry. Same guest cap as us, same town — a like-for-like ' +
      'whole-chalet alternative on our core party.',
  },
  {
    listingId: 'cozy-a-frame-ayda', displayName: 'Cozy A-Frame Ayda',
    channel: 'booking.com', url: BK('cozy-a-frame-ayda'), city: 'Comarnic', heroPhotoUrl: null,
    units: one('Two-Bedroom Chalet', 5, 80), propertyType: 'cabin', distanceKm: null,
    rating: null, reviewCount: 0, qualityAsOf: '2026-09-01', amenities: [],
    substitutionBasis:
      'Currently the cheapest whole place in the Booking field (2,803 lei / 4 nights when read). Brand ' +
      'new with no reviews, so it is buying its first bookings on price — a short-term threat on 3-5 ' +
      'guest stays and an unknown after that.',
  },
  {
    listingId: 'casutele-din-poienita', displayName: 'Casutele din Poienita',
    channel: 'booking.com', url: BK('casutele-din-poienita'), city: 'Comarnic', heroPhotoUrl: null,
    units: [
      { label: 'Two-Bedroom Chalet', maxPersons: 4, count: 1, sqm: 65 },
      { label: 'One-Bedroom Chalet', maxPersons: 3, count: 2, sqm: 40 },
    ],
    propertyType: 'cabin', distanceKm: null,
    rating: 9.6, reviewCount: 157, qualityAsOf: '2026-09-01', amenities: [],
    substitutionBasis:
      'A chalet park with the most reviews in the set (157). Takes a family of 3-4 wanting a whole ' +
      'cabin cheaply. Cannot take six in one unit, so it drops out of our largest party.',
  },
  {
    listingId: 'moodysun-studio', displayName: 'MoodySun Studio, remote tiny home',
    channel: 'booking.com', url: BK('tiny-studio-in-comarnic-close-to-bucegi-mountains'),
    city: 'Comarnic', heroPhotoUrl: null,
    units: one('Studio', 3, 21), propertyType: 'studio', distanceKm: null,
    rating: 9.3, reviewCount: 49, qualityAsOf: '2026-09-01', amenities: [],
    substitutionBasis:
      'A well-reviewed 21 m² studio that sleeps three in one unit (one large double plus a sofa bed). ' +
      'Competes for the couple or 2+1 who choose setting and price over space — a real slice, since ' +
      '11% of our bookings are 1-2 people. Owner kept it in the set deliberately.',
  },
  // Surfaced by the guest-facing search and added at the owner's request, 2026-09-02. Capacity is
  // deliberately UNREAD on all five — they read '?' against every party until a probe fills them,
  // which marks them probeworthy rather than pretending to know.
  {
    listingId: 'utopia-lake-view', displayName: 'Utopia Lake View',
    channel: 'booking.com', url: BK('utopia-lake-view'), city: 'Comarnic', heroPhotoUrl: null,
    units: [], propertyType: 'whole-house', distanceKm: null,
    rating: 9.8, reviewCount: 78, qualityAsOf: '2026-09-02', amenities: [],
    curatedBy: 'owner (2026-09-02)',
    substitutionBasis:
      'Kept deliberately even though its headline product is a group venue, not a family house: four ' +
      'units from a 2-person Double Room up to a 15-person Superior Villa, so "they still compete for ' +
      'smaller parties" (owner, 2026-09-02). For a 2+1 the engine reads its 3-person Apartment with ' +
      'Lake View, which is a real alternative to us; the 15-person villa is not what that family sees.',
  },
  {
    listingId: 'maramures-nook', displayName: 'Maramureș Nook',
    channel: 'booking.com', url: BK('maramures-nook'), city: 'Comarnic', heroPhotoUrl: null,
    units: [], propertyType: 'whole-house', distanceKm: 1,
    rating: null, reviewCount: null, qualityAsOf: '2026-09-02', amenities: [],
    substitutionBasis:
      '200 m², 5 beds, 1 km from the centre — the same shape of stay as ours and very close by. No ' +
      'review score shown yet, so it is either new or low-volume; watch whether that changes.',
  },
  {
    listingId: 'tetra-plus-569', displayName: 'TETRA Plus 569',
    channel: 'booking.com', url: BK('tetra-plus-569'), city: 'Comarnic', heroPhotoUrl: null,
    units: [], propertyType: 'other', distanceKm: null,
    rating: 10, reviewCount: 56, qualityAsOf: '2026-09-02', amenities: [],
    substitutionBasis:
      'A perfect 10 on 56 reviews, 4 beds. Appears in the searches a guest actually runs for our ' +
      'dates and party.',
  },
  {
    listingId: 'zaivan-retreat', displayName: 'Zaivan Retreat',
    channel: 'booking.com', url: BK('zaivan'), city: 'Comarnic', heroPhotoUrl: null,
    units: [], propertyType: 'cabin', distanceKm: null,
    rating: 9.9, reviewCount: 51, qualityAsOf: '2026-09-02', amenities: [],
    curatedBy: 'owner (2026-09-02)',
    substitutionBasis:
      'A six-unit retreat whose largest is a 21-person Holiday Home — bigger than anything we sell — ' +
      'but kept because "they still compete for smaller parties" (owner, 2026-09-02). Its ladder runs ' +
      'from a 3-person One-Bedroom Family Apartment upward, and that is the unit a 2+1 family is ' +
      'actually choosing between us and them on.',
  },
  {
    listingId: 'chalet-husky', displayName: 'Chalet Husky - Pet Friendly & Private',
    channel: 'booking.com', url: BK('chalet-husky'), city: 'Comarnic', heroPhotoUrl: null,
    units: [], propertyType: 'cabin', distanceKm: null,
    rating: 9.8, reviewCount: 53, qualityAsOf: '2026-09-02', amenities: [],
    substitutionBasis:
      '9.8 on 53 reviews, 58 m². Leads on pet-friendly and privacy, which is a different hook from ' +
      'ours — worth watching for the guest who is choosing on that rather than on space.',
  },
  {
    listingId: 'moon-village', displayName: 'Moon Village Comarnic',
    channel: 'booking.com', url: BK('moon-village-comarnic'), city: 'Comarnic', heroPhotoUrl: null,
    units: [], propertyType: 'cabin', distanceKm: null,
    rating: 9.3, reviewCount: 874, qualityAsOf: '2026-09-02', amenities: [],
    substitutionBasis:
      'A unit park of small tiny houses — NOT the same product as ours (owner, 2026-09-02: "they are ' +
      'not the same like me, they are units park, with small tiny houses. But still they matter"). It ' +
      'is in the set because of volume: 874 reviews, more than five times anything else we track, so a ' +
      'great many guests searching Comarnic choose it over a house. Capacity unread — it appears in ' +
      'the guest-facing search and was invisible to the first curation.',
  },
  {
    listingId: 'moon-valley', displayName: 'Moon Valley Comarnic',
    channel: 'booking.com', url: BK('moon-valley-comarnic'), city: 'Comarnic', heroPhotoUrl: null,
    units: [], propertyType: 'cabin', distanceKm: null,
    rating: 9.3, reviewCount: 336, qualityAsOf: '2026-09-02', amenities: [],
    substitutionBasis:
      'Sister property to Moon Village and the same kind of thing: a park of small units, not a house. ' +
      'In the set for the same reason — 336 reviews, and it undercut us on the 13-15 Oct search ' +
      '(1,083 against our 1,491). Capacity unread.',
  },
  {
    listingId: 'casutele-de-la-poienita', displayName: 'Casutele de la Poienita',
    channel: 'booking.com', url: BK('casutele-de-la-poienita'), city: 'Comarnic', heroPhotoUrl: null,
    units: [{ label: 'Double Room', maxPersons: 2, count: 3, sqm: 17 }],
    propertyType: 'guesthouse', distanceKm: null,
    rating: 9.9, reviewCount: 15, qualityAsOf: '2026-09-01', amenities: [],
    substitutionBasis:
      'Three small cabins with private kitchens. Competes for couples, and for a group of four willing ' +
      'to take two cabins — a real choice for adults and not for families with young children. A ' +
      'DIFFERENT property from Casutele din Poienita (owner-confirmed). Owner kept it in deliberately.',
  },
];

/** Retired, with the reason kept — the exclusion is part of the curated set. */
const RETIRED: Array<{ listingId: string; seed: Seed; reason: string }> = [
  {
    listingId: 'pensiunea-piri-land',
    reason:
      'Largest unit is a King Room for 2 adults; it lets rooms rather than houses, so it cannot host ' +
      'any of our three parties without splitting. Retired by the owner 2026-09-01. Note: the page ' +
      'was only ever read in a slice, so re-read it in full before reconsidering.',
    seed: {
      listingId: 'pensiunea-piri-land', displayName: 'Pensiunea PIRI LAND',
      channel: 'booking.com', url: BK('pensiunea-piri-land'), city: 'Comarnic', heroPhotoUrl: null,
      units: one('King Room with Balcony', 2, 19), propertyType: 'guesthouse', distanceKm: null,
      rating: 9.7, reviewCount: 35, qualityAsOf: '2026-09-01', amenities: [],
      substitutionBasis: 'Retired — a guesthouse letting rooms, not a house substitute. See retiredReason.',
    },
  },
];

(async () => {
  const all = [...AIRBNB_SET, ...BOOKING_SET];
  const before = await getCompetitorSet(PROPERTY);

  // Validate everything BEFORE writing anything: a half-seeded set is worse than none.
  const bad = [...all, ...RETIRED.map((r) => r.seed)]
    .map((s) => ({ id: s.listingId, problems: validateListing({ ...s, propertyId: PROPERTY }) }))
    .filter((x) => x.problems.length);
  if (bad.length) {
    console.error('REFUSING TO SEED — invalid entries:');
    bad.forEach((b) => console.error(`  ${b.id}\n${b.problems.map((p) => `    - ${p}`).join('\n')}`));
    process.exit(1);
  }

  // sameAs must point at something that exists, or the admin card links into nothing.
  const ids = new Set([...all, ...RETIRED.map((r) => r.seed)].map((s) => s.listingId));
  const dangling = all.filter((s) => s.sameAs && !ids.has(s.sameAs.listingId));
  if (dangling.length) {
    console.error(`REFUSING TO SEED — dangling sameAs: ${dangling.map((d) => `${d.listingId} -> ${d.sameAs!.listingId}`).join(', ')}`);
    process.exit(1);
  }

  console.log(`\nCOMPETITOR SET — ${PROPERTY}   (${WRITE ? 'WRITING' : 'dry run, nothing written'})`);
  console.log(`currently stored: ${before.all.length} (${before.active.length} active)\n`);

  const byChannel = (c: string) => all.filter((s) => s.channel === c);
  for (const channel of ['airbnb', 'booking.com']) {
    const rows = byChannel(channel);
    console.log(`${channel.toUpperCase()} — ${rows.length} comparables`);
    console.log('  ' + 'listing'.padEnd(28) + 'largest'.padEnd(9) + DEFAULT_PARTIES.map((p) => partyLabel(p).padEnd(8)).join(''));
    for (const s of rows) {
      const fits = DEFAULT_PARTIES.map((p) => {
        const f = hostsParty(s, p);
        return (f.kind === 'single' ? 'yes' : f.kind === 'combination' ? `${f.unitCount}u` : f.kind === 'unknown' ? '?' : '--').padEnd(8);
      }).join('');
      console.log(`  ${s.displayName.slice(0, 26).padEnd(28)}${String(largestUnit(s)).padEnd(9)}${fits}`);
    }
    console.log();
  }

  if (!WRITE) {
    console.log(`Would write ${all.length} active + ${RETIRED.length} retired.`);
    console.log('Re-run with --write to apply.\n');
    console.log(`NOTE: substitutionBasis provenance is "${CURATED_BY}".`);
    return;
  }

  for (const s of all) {
    await upsertCompetitorListing({ ...s, propertyId: PROPERTY, active: true, curatedBy: s.curatedBy ?? CURATED_BY });
    console.log(`  wrote ${s.listingId}`);
  }
  for (const r of RETIRED) {
    await upsertCompetitorListing({ ...r.seed, propertyId: PROPERTY, active: true, curatedBy: CURATED_BY });
    await retireCompetitorListing(PROPERTY, r.listingId, r.reason, 'owner (2026-09-01)');
    console.log(`  wrote ${r.listingId} (retired)`);
  }

  const after = await getCompetitorSet(PROPERTY);
  console.log(`\nstored: ${after.all.length} (${after.active.length} active, ${after.retired.length} retired)`);
  console.log('Next: the owner corrects each substitutionBasis, then verification sets verifiedAt.');
})().catch((e) => { console.error(e); process.exit(1); });
