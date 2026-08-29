'use server';

/**
 * Reading the parity picture for the admin screen.
 *
 * READ-ONLY. Nothing here changes a price, on the site or on any channel — the system has no write
 * access to the OTAs, and the direct price is changed through the periods/compiler path, deliberately
 * not from a dashboard that is showing you comparisons.
 *
 * NOTE: a 'use server' file may only export async functions. Types live in `@/lib/parity/parityView`.
 */
import { loggers } from '@/lib/logger';
import { requirePropertyAccess, AuthorizationError } from '@/lib/authorization';
import { getParityConfig } from '@/services/channelService';
import { latestByCell } from '@/services/growth/parityObservations';
import { buildParityWindow, summarise } from '@/lib/parity/parityView';
import type { ParityWindowInput, ParityObservationLite } from '@/lib/parity/parityView';

const logger = loggers.parity;

export async function fetchParityView(propertyId: string, opts?: { includeVrbo?: boolean }): Promise<{
  ok: boolean;
  error?: string;
  windows?: unknown[];
  summary?: unknown;
  meta?: unknown;
}> {
  try {
    await requirePropertyAccess(propertyId);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: 'Not authorised for this property.' };
    throw e;
  }

  try {
    // getParityConfig THROWS when a channel has no stated economics — it never guesses a commission,
    // because a parity verdict computed against a guessed rate looks authoritative and is wrong in a
    // direction the reader cannot see.
    const cfg = await getParityConfig(propertyId);
    const observed = [...(await latestByCell(propertyId)).values()];

    const today = new Date().toISOString().slice(0, 10);
    const byWindow = new Map<string, ParityWindowInput>();
    for (const o of observed) {
      // A stay already past cannot be re-captured and cannot be sold. It is history, not a decision.
      if (o.checkOut < today) continue;
      const key = `${o.checkIn}|${o.checkOut}|${o.guests}`;
      if (!byWindow.has(key)) {
        byWindow.set(key, { checkIn: o.checkIn, checkOut: o.checkOut, nights: o.nights, guests: o.guests, observations: [] });
      }
      const lite: ParityObservationLite = {
        channel: o.channel, status: o.status, guestTotal: o.guestTotal ?? null,
        listTotal: o.listTotal ?? null, promoActive: o.promoActive, ratePlan: (o as { ratePlan?: string }).ratePlan,
        reason: o.reason, capturedAt: o.capturedAt, sessionState: o.sessionState,
      };
      byWindow.get(key)!.observations.push(lite);
    }

    const inScope = ['direct', ...cfg.channels.map((c) => c.channel)]
      .filter((c) => (opts?.includeVrbo ? true : c !== 'vrbo'));
    const economics = Object.fromEntries(cfg.channels.map((c) => [c.channel, c]));

    const windows = [...byWindow.values()]
      .map((w) => buildParityWindow(w, {
        freshnessDays: 42,
        targetDiscountPct: cfg.targetDiscountPct,
        direct: cfg.direct,
        economics,
        channelsInScope: inScope,
      }))
      .sort((a, b) => {
        // Worst first, and within a verdict, soonest first — the thing you can still act on.
        const rank: Record<string, number> = { losing: 0, overshoot: 1, thin: 2, partial: 3, healthy: 4, unknown: 5 };
        return (rank[a.verdict] ?? 9) - (rank[b.verdict] ?? 9) || a.checkIn.localeCompare(b.checkIn);
      });

    return {
      ok: true,
      windows,
      summary: summarise(windows),
      meta: {
        propertyId,
        generatedAt: new Date().toISOString(),
        targetDiscountPct: cfg.targetDiscountPct,
        channelsInScope: inScope,
        excluded: opts?.includeVrbo ? [] : ['vrbo'],
        observationCount: observed.length,
      },
    };
  } catch (e) {
    logger.error('failed to build the parity view', e as Error, { propertyId });
    return { ok: false, error: (e as Error).message };
  }
}
