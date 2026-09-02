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
import { buildBoard, summariseBoard, type BoardRowInput } from '@/lib/competitive/board';
import { groupByPeriod, nightsOf as periodNights, type PricingPeriod } from '@/lib/competitive/periods';
import { getPeriods } from '@/services/periodService';
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
 * The market board: one row per window per channel, ranked by what needs looking at.
 *
 * READ-ONLY, and it reads nothing that could move a price (C2). What changed from the first version
 * is not the data but the SHAPE: this returns a verdict per contest rather than a ladder, because a
 * ladder produced a true reading that pointed the wrong way — see `lib/competitive/board.ts`.
 */
export async function fetchMarketPositions(propertyId: string): Promise<{
  ok: boolean;
  error?: string;
  rows?: unknown[];
  grouped?: unknown[];
  summary?: unknown;
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

    // One entry per (window x party) that competitor data exists for, forward-looking only: a stay
    // already past cannot be sold and is history, not a decision.
    const keys = new Map<string, { checkIn: string; checkOut: string; nights: number; guests: number }>();
    for (const o of compLatest.values()) {
      if (o.checkOut < today) continue;
      keys.set(`${o.checkIn}|${o.checkOut}|${o.guests}`,
        { checkIn: o.checkIn, checkOut: o.checkOut, nights: o.nights, guests: o.guests });
    }
    const windows = [...keys.values()];

    // How much of each window is already booked for us. A sold window needs no pricing decision, and
    // leaving it on the board at full weight is how a screen fills with rows nobody can act on.
    // `availability/{id}_{YYYY-MM}` holds an `available` map by day; a missing doc means fully open.
    const months = new Set<string>();
    for (const w of windows) {
      for (const d of nightsOf(w.checkIn, w.checkOut)) months.add(d.slice(0, 7));
    }
    const availByMonth = new Map<string, Record<string, boolean>>();
    await Promise.all([...months].map(async (ym) => {
      const doc = await db.collection('availability').doc(`${propertyId}_${ym}`).get();
      availByMonth.set(ym, ((doc.data() ?? {}) as { available?: Record<string, boolean> }).available ?? {});
    }));
    const soldNightsOf = (checkIn: string, checkOut: string) =>
      nightsOf(checkIn, checkOut).filter((d) => {
        const map = availByMonth.get(d.slice(0, 7)) ?? {};
        return map[String(Number(d.slice(8, 10)))] === false || map[d.slice(8, 10)] === false;
      }).length;

    const asSellState = (s: string): SellState =>
      s === 'captured' ? 'priced' : s === 'unavailable' ? 'not-sellable' : s === 'refused' ? 'refused' : 'error';

    const inputs: BoardRowInput[] = [];
    const details = new Map<string, unknown>();

    for (const w of windows.sort((a, b) => a.checkIn.localeCompare(b.checkIn))) {
      const party = partyForGuests(mix.parties, w.guests);
      const inWindow = (o: { checkIn: string; checkOut: string; guests: number }) =>
        o.checkIn === w.checkIn && o.checkOut === w.checkOut && o.guests === w.guests;

      const ours = [...selfLatest.values()].filter(inWindow);
      const direct = ours.find((o) => o.channel === 'direct');
      const soldNights = soldNightsOf(w.checkIn, w.checkOut);

      // Absorption spans the channels: "is this window selling" is about the market, not one contest.
      const absorptionRows = set.active.map((l) => {
        const readings: SellReading[] = compHistory
          .filter((o) => inWindow(o) && o.subject?.kind === 'competitor' && o.subject.listingId === l.listingId)
          .map((o) => ({ at: o.capturedAt, state: asSellState(o.status), price: o.guestTotal ?? null }));
        return { listingId: l.listingId, displayName: l.displayName,
                 absorption: readAbsorption({ readings, multiUnit: unitCount(l) > 1, now }) };
      }).filter((r) => r.absorption.readings > 0);
      const comparable = absorptionRows.filter((r) => r.absorption.readings >= 2);
      const field = summariseField(absorptionRows);
      const nameOf = (id: string) => absorptionRows.find((r) => r.listingId === id)?.displayName ?? id;
      const moved = field.wentOffSale.length + field.parksSoldOut.length;

      for (const channel of ['airbnb', 'booking.com']) {
        const listings = set.active.filter((l) => l.channel === channel);
        if (!listings.length) continue;

        const quotes: CompetitorQuote[] = [];
        const outOfSet: Array<{ listingId: string; displayName: string; fit: ReturnType<typeof hostsParty> }> = [];
        const unread: Array<{ listingId: string; displayName: string }> = [];
        for (const l of listings) {
          const fit = hostsParty(l, party);
          if (fit.kind === 'out-of-set') { outOfSet.push({ listingId: l.listingId, displayName: l.displayName, fit }); continue; }
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
        if (!quotes.length && !outOfSet.length) continue;

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

        // A refusal is a PARTY BAR, so it belongs with the comparables we do not face rather than
        // with the ones that sold out. Folding it into scarcity would read an adults-only policy as
        // evidence of demand.
        const refused = pos.silent.filter((s) => s.status === 'refused').length;
        const errored = pos.silent.filter((s) => s.status === 'error').length;
        const nothingLeft = pos.silent.filter((s) => s.status === 'unavailable').length;

        const rowKey = `${w.checkIn}|${w.checkOut}|${w.guests}|${channel}`;
        inputs.push({
          key: `${w.checkIn}|${w.checkOut}|${w.guests}`,
          checkIn: w.checkIn, checkOut: w.checkOut, nights: w.nights,
          partyLabel: partyLabel(party),
          channel, channelLabel: channel === 'airbnb' ? 'Airbnb' : 'Booking.com',
          ourPrice: pos.ourChannelPrice, ourDirect: pos.ourDirectPrice,
          fieldMedian: pos.band?.median ?? null,
          fieldMin: pos.band?.min ?? null,
          fieldMax: pos.band?.max ?? null,
          quoted: pos.sample.quoted,
          eligible: listings.length - outOfSet.length,
          nothingLeft,
          cantHost: outOfSet.length + refused,
          unread: unread.length + errored,
          oldestAgeDays: pos.sample.oldestAgeDays,
          soldNights,
          movedSinceLastReading: moved,
        });

        details.set(rowKey, {
          rank: pos.rank, confidence: pos.confidence,
          ladder: pos.ladder, silent: pos.silent, outOfSet: pos.outOfSet, unreadNames: pos.unread,
          flags: pos.flags, notes: pos.notes,
          absorption: comparable.length
            ? { started: true, summary: field.summary,
                wentOffSale: field.wentOffSale.map((x) => ({ name: nameOf(x.listingId), lastPrice: x.lastPrice, between: x.between })),
                parksSoldOut: field.parksSoldOut.map((x) => ({ name: nameOf(x.listingId), between: x.between })) }
            : { started: false,
                summary: `Every listing here has one reading. Whether the field is selling — as opposed ` +
                         `to how much of it is on sale right now — needs a SECOND reading of this window.`,
                wentOffSale: [], parksSoldOut: [] },
        });
      }
    }

    const board = buildBoard(inputs);
    const rows = board.map((r) => ({ ...r, detail: details.get(`${r.key}|${r.channel}`) ?? null }));

    // Group under HIS pricing periods — the thing he actually changes. A window is a probe; four
    // December probes are the same nights, and money summed per window counted them four times.
    const horizonEnd = windows.reduce((m, w) => (w.checkOut > m ? w.checkOut : m), today);
    const periods: PricingPeriod[] = (await getPeriods(propertyId))
      .filter((p) => p.status === 'active' && p.endDate >= today && p.startDate <= horizonEnd)
      .map((p) => ({ id: p.id, name: p.name, startDate: p.startDate, endDate: p.endDate,
                     weekdayRate: null, weekendRate: null }));

    // Per-night rate and sold flag, read from the same docs the year board uses.
    const rateByNight = new Map<string, number>();
    const soldNights = new Set<string>();
    const allMonths = new Set<string>(months);
    for (const p of periods) for (const d of periodNights(p.startDate, p.endDate)) allMonths.add(d.slice(0, 7));
    await Promise.all([...allMonths].map(async (ym) => {
      const [cal, avail] = await Promise.all([
        db.collection('priceCalendars').doc(`${propertyId}_${ym}`).get(),
        db.collection('availability').doc(`${propertyId}_${ym}`).get(),
      ]);
      const days = ((cal.data() ?? {}) as { days?: Record<string, { adjustedPrice?: number }> }).days ?? {};
      const availMap = ((avail.data() ?? {}) as { available?: Record<string, boolean> }).available ?? {};
      for (const [dn, d] of Object.entries(days)) {
        const date = `${ym}-${dn.padStart(2, '0')}`;
        if (typeof d.adjustedPrice === 'number') rateByNight.set(date, d.adjustedPrice);
        if (availMap[String(Number(dn))] === false || availMap[dn] === false) soldNights.add(date);
      }
      for (const [dn, v] of Object.entries(availMap)) {
        if (v === false) soldNights.add(`${ym}-${String(dn).padStart(2, '0')}`);
      }
    }));

    const grouped = groupByPeriod({ rows: board, periods, soldNights, rateByNight }).map((g) => ({
      ...g,
      windows: g.windows.map((w) => ({
        ...w,
        rows: w.rows.map((r) => ({ ...r, detail: details.get(`${r.key}|${r.channel}`) ?? null })),
      })),
    }));

    return { ok: true, rows, grouped, summary: summariseBoard(board) };
  } catch (e) {
    logger.error('Could not build the market board', { propertyId, error: (e as Error).message });
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * The nights of a stay, check-out excluded, as YYYY-MM-DD.
 *
 * String arithmetic on purpose: this codebase has a scar from `new Date(...)` shifting dates by one
 * in UTC+2, and a night counted into the wrong month reads an availability map that does not hold it.
 */
function nightsOf(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  const [y, m, d] = checkIn.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  while (cur.getTime() < end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}
