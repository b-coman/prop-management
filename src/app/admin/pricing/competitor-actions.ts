'use server';

/**
 * Reading the curated comparable set for the admin screen.
 *
 * READ-ONLY. Nothing here changes a price, and nothing here reads one: a competitor observation is
 * context for a human decision and never an input to a rate (C2). This action deliberately does not
 * touch `channelPriceObservations` at all — position arrives in Phase 4, and keeping the surfaces
 * apart is what stops "market context" quietly becoming a pricing input.
 *
 * NOTE: a 'use server' file may only export async functions. Types live in the card component and in
 * `@/lib/competitive/set` — exporting an interface from here is a silent 500 on every action in the
 * module graph.
 */
import { loggers } from '@/lib/logger';
import { requirePropertyAccess, AuthorizationError } from '@/lib/authorization';
import { getCompetitorSet } from '@/services/competitorSetService';
import { latestByCell, loadObservations } from '@/services/growth/parityObservations';
import { buildPosition, type CompetitorQuote } from '@/lib/competitive/position';
import { readAbsorption, summariseField, type SellReading, type SellState } from '@/lib/competitive/absorption';
import { hostsParty, largestUnit, unitCount, verificationAge } from '@/lib/competitive/set';
import { partiesFor, partyForGuests, partyLabel } from '@/lib/parity/party';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const logger = loggers.pricing;

export async function fetchCompetitorSet(propertyId: string): Promise<{
  ok: boolean;
  error?: string;
  rows?: unknown[];
}> {
  try {
    await requirePropertyAccess(propertyId);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: 'Not authorised for this property.' };
    throw e;
  }

  try {
    const set = await getCompetitorSet(propertyId);
    if (!set.all.length) return { ok: true, rows: [] };

    // The SAME party mix the parity system uses. Two systems disagreeing about what a party is would
    // be the adults=6 incident again, in a new place.
    const propDoc = await (await getAdminDb()).collection('properties').doc(propertyId).get();
    const mix = partiesFor((propDoc.data() as { channelPricing?: unknown } | undefined)?.channelPricing);

    const nameById = new Map(set.all.map((l) => [l.listingId, l.displayName]));
    const now = new Date();

    const rows = set.all.map((l) => {
      const age = verificationAge(l, now);
      return {
        listingId: l.listingId,
        displayName: l.displayName,
        channel: l.channel,
        url: l.url,
        city: l.city,
        heroPhotoUrl: l.heroPhotoUrl,
        propertyType: l.propertyType,
        largestUnit: largestUnit(l),
        unitCount: unitCount(l),
        rating: l.rating,
        reviewCount: l.reviewCount,
        amenities: l.amenities,
        substitutionBasis: l.substitutionBasis,
        // Until the owner edits it, the reason is a draft written from page reads — and the screen
        // says so, because recording a guess as his reasoning defeats the point of the field.
        basisIsDraft: /\(draft\)/i.test(l.curatedBy ?? ''),
        sameAsName: l.sameAs ? nameById.get(l.sameAs.listingId) : undefined,
        active: l.active,
        retiredReason: l.retiredReason,
        verificationAgeDays: age.ageDays,
        unverified: age.unverified,
        stale: age.stale,
        fits: mix.parties.map((p) => {
          const fit = hostsParty(l, p);
          return {
            label: partyLabel(p),
            verdict: fit.kind,
            detail: fit.kind === 'single' ? `one unit takes all ${p.adults + p.children}`
              : fit.kind === 'combination' ? `${fit.unitCount} units together`
              : fit.kind === 'out-of-set' ? fit.reason
              : fit.reason,
          };
        }),
      };
    });

    // Active first, then by channel, then name — the retired ones stay visible but out of the way.
    rows.sort((a, b) =>
      Number(b.active) - Number(a.active) ||
      a.channel.localeCompare(b.channel) ||
      a.displayName.localeCompare(b.displayName));

    return { ok: true, rows };
  } catch (e) {
    logger.error('Could not read the competitor set', { propertyId, error: (e as Error).message });
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Where we sit, per window and per channel, for every window that has competitor observations.
 *
 * READ-ONLY, and it reads nothing that could move a price. C2 is enforced by an import-boundary test
 * as well as by intent: no solver imports `lib/competitive`, and this action is the only thing that
 * puts its output on a screen.
 */
export async function fetchMarketPositions(propertyId: string): Promise<{
  ok: boolean;
  error?: string;
  windows?: unknown[];
}> {
  try {
    await requirePropertyAccess(propertyId);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: 'Not authorised for this property.' };
    throw e;
  }

  try {
    const db = await getAdminDb();
    const selfLatest = await latestByCell(propertyId, { kind: 'self' });
    const compLatest = await latestByCell(propertyId, { kind: 'competitor' });
    // The FULL history, because absorption is a comparison BETWEEN readings.
    const compHistory = await loadObservations(propertyId, { kind: 'competitor' });
    const set = await getCompetitorSet(propertyId);
    const propDoc = await db.collection('properties').doc(propertyId).get();
    const prop = propDoc.data() as { channelPricing?: unknown; rating?: number; reviewCount?: number } | undefined;
    const mix = partiesFor(prop?.channelPricing);

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();

    // One entry per (window × party) that competitor data exists for, forward-looking only: a stay
    // already past cannot be sold and is history, not a decision.
    const keys = new Map<string, { checkIn: string; checkOut: string; nights: number; guests: number }>();
    for (const o of compLatest.values()) {
      if (o.checkOut < today) continue;
      keys.set(`${o.checkIn}|${o.checkOut}|${o.guests}`,
        { checkIn: o.checkIn, checkOut: o.checkOut, nights: o.nights, guests: o.guests });
    }

    const asSellState = (s: string): SellState =>
      s === 'captured' ? 'priced' : s === 'unavailable' ? 'not-sellable' : s === 'refused' ? 'refused' : 'error';

    const windows = [...keys.values()]
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
      .map((w) => {
        const party = partyForGuests(mix.parties, w.guests);
        const inWindow = (o: { checkIn: string; checkOut: string; guests: number }) =>
          o.checkIn === w.checkIn && o.checkOut === w.checkOut && o.guests === w.guests;

        const ours = [...selfLatest.values()].filter(inWindow);
        const direct = ours.find((o) => o.channel === 'direct');

        const channels = ['airbnb', 'booking.com'].map((channel) => {
          const field = set.active.filter((l) => l.channel === channel);
          if (!field.length) return null;

          const quotes: CompetitorQuote[] = [];
          const outOfSet: Array<{ listingId: string; displayName: string; fit: ReturnType<typeof hostsParty> }> = [];
          // Named, never dropped: seven of the fifteen Booking comparables had no reading for the
          // first window on this screen, and dropping them printed "4 of 7" for a field of fifteen.
          const unread: Array<{ listingId: string; displayName: string }> = [];
          for (const l of field) {
            const fit = hostsParty(l, party);
            if (fit.kind === 'out-of-set') {
              outOfSet.push({ listingId: l.listingId, displayName: l.displayName, fit });
              continue;
            }
            const o = [...compLatest.values()].find((x) => inWindow(x) && x.channel === channel
              && x.subject?.kind === 'competitor' && x.subject.listingId === l.listingId);
            if (!o) { unread.push({ listingId: l.listingId, displayName: l.displayName }); continue; }
            quotes.push({
              listingId: l.listingId, displayName: l.displayName, status: o.status,
              guestTotal: o.guestTotal, listTotal: o.listTotal, promoActive: o.promoActive,
              reason: o.reason, capturedAt: o.capturedAt, programApplied: o.session?.programApplied,
              rating: l.rating, reviewCount: l.reviewCount, largestUnit: largestUnit(l) || null,
            });
          }
          if (!quotes.length && !outOfSet.length) return null;

          const mine = ours.find((o) => o.channel === channel);
          const pos = buildPosition({
            checkIn: w.checkIn, checkOut: w.checkOut, nights: w.nights, guests: w.guests,
            partyLabel: partyLabel(party), channel,
            ourChannelPrice: mine?.status === 'captured' ? mine.guestTotal : null,
            ourDirectPrice: direct?.status === 'captured' ? direct.guestTotal : null,
            ourRating: prop?.rating ?? null, ourReviewCount: prop?.reviewCount ?? null,
            ourProgramApplied: mine?.session?.programApplied
              ?? /genius[^.]{0,30}applied|Genius \d+% applied/i.test(mine?.sessionState ?? ''),
            quotes, outOfSet, unread, now,
          });
          return { ...pos, channelLabel: channel === 'airbnb' ? 'Airbnb' : 'Booking.com' };
        }).filter(Boolean);

        // Absorption spans the channels: the question "is this window selling" is about the market,
        // not about one contest.
        const rows = set.active.map((l) => {
          const readings: SellReading[] = compHistory
            .filter((o) => inWindow(o) && o.subject?.kind === 'competitor' && o.subject.listingId === l.listingId)
            .map((o) => ({ at: o.capturedAt, state: asSellState(o.status), price: o.guestTotal ?? null }));
          return { listingId: l.listingId, displayName: l.displayName,
                   absorption: readAbsorption({ readings, multiUnit: unitCount(l) > 1, now }) };
        }).filter((r) => r.absorption.readings > 0);

        const comparable = rows.filter((r) => r.absorption.readings >= 2);
        const field = summariseField(rows);
        const nameOf = (id: string) => rows.find((r) => r.listingId === id)?.displayName ?? id;

        return {
          key: `${w.checkIn}|${w.checkOut}|${w.guests}`,
          checkIn: w.checkIn, checkOut: w.checkOut, nights: w.nights,
          partyLabel: partyLabel(party),
          channels,
          absorption: comparable.length
            ? {
                started: true,
                summary: field.summary,
                wentOffSale: field.wentOffSale.map((x) => ({ name: nameOf(x.listingId), lastPrice: x.lastPrice, between: x.between })),
                parksSoldOut: field.parksSoldOut.map((x) => ({ name: nameOf(x.listingId), between: x.between })),
                stillOnSale: field.stillOnSale,
                tooEarly: field.tooEarly,
              }
            : {
                started: false,
                summary: `${rows.length} listing(s) have one reading each. Absorption needs a SECOND ` +
                         `reading of this window, separated in time — it is the only output no amount ` +
                         `of building substitutes for.`,
                wentOffSale: [], parksSoldOut: [], stillOnSale: 0, tooEarly: rows.length,
              },
        };
      })
      .filter((w) => w.channels.length);

    return { ok: true, windows };
  } catch (e) {
    logger.error('Could not build the market position', { propertyId, error: (e as Error).message });
    return { ok: false, error: (e as Error).message };
  }
}
