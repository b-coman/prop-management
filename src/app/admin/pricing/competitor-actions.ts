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
import { hostsParty, largestUnit, unitCount, verificationAge } from '@/lib/competitive/set';
import { partiesFor, partyLabel } from '@/lib/parity/party';
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
