/**
 * Persistence for rate sheets and channel pushes.
 *
 * Rate sheets are IMMUTABLE and versioned: a sheet records what the prices were computed to be at a
 * moment, and "what did we tell ourselves to type in August?" must stay answerable after the tiers
 * change in October. Pushes are mutable, because they track a human's progress through three
 * dashboards.
 *
 * Admin SDK only. All maths is in `src/lib/pricing/rateSheet.ts` and `parityMath`.
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { getPeriods } from './periodService';
import { getChannels } from './channelService';
import {
  buildRateSheet, diffAgainstApplied, verifyPush,
  type RateSheet, type ChannelPush, type RateSheetChannelInput, type PushStatus,
} from '@/lib/pricing/rateSheet';
import { DEFAULT_TIER_MULTIPLIERS, type TierMultipliers } from '@/lib/pricing/periods';
import { CHANNEL_IDS, normalizeChannel, type ChannelId } from '@/lib/channels';

const logger = loggers.pricing;
const SHEETS = 'rateSheets';
const PUSHES = 'channelPushes';

/**
 * Highest version stored for a property.
 *
 * Computed in memory rather than with `.orderBy('version','desc').limit(1)`, which would need a
 * composite index. A property accumulates one sheet per regeneration — tens, not thousands — so
 * reading them is cheap. Revisit if that ever stops being true.
 */
export async function latestVersion(propertyId: string): Promise<number> {
  const db = await getAdminDb();
  const snap = await db.collection(SHEETS).where('propertyId', '==', propertyId).get();
  return snap.docs.reduce((max, d) => Math.max(max, (d.data() as { version?: number }).version ?? 0), 0);
}

export async function getPushes(propertyId: string): Promise<ChannelPush[]> {
  const db = await getAdminDb();
  const snap = await db.collection(PUSHES).where('propertyId', '==', propertyId).get();
  return snap.docs.map((d) => ({ ...(d.data() as ChannelPush), id: d.id }));
}

export interface GenerateResult {
  sheet: RateSheet;
  pushes: ChannelPush[];
  written: boolean;
  /** Channels skipped because the owner has stated no economics for them. */
  skippedChannels: string[];
}

/**
 * Compute the current rate sheet for a property from live periods and live channel config.
 *
 * Channels with no stated economics are SKIPPED and named, never defaulted — a fabricated commission
 * would produce a confident price to type into a real dashboard.
 */
export async function generateRateSheet(
  propertyId: string,
  opts: { computedAt: string; from?: string; to?: string; write?: boolean; updatedBy?: string } = { computedAt: new Date().toISOString() },
): Promise<GenerateResult> {
  const db = await getAdminDb();
  const [periods, channelSet, propDoc] = await Promise.all([
    getPeriods(propertyId),
    getChannels(propertyId),
    db.collection('properties').doc(propertyId).get(),
  ]);
  const property = propDoc.data() as Record<string, any> | undefined;
  if (!property) throw new Error(`property ${propertyId} not found`);

  const directCfg = channelSet.byId.get('direct');
  if (!directCfg?.directEconomics) {
    throw new Error(
      `No direct economics for "${propertyId}". Every channel price is derived from the direct price ` +
      'and what it costs to take directly, so the sheet cannot be built without it.',
    );
  }

  const skippedChannels: string[] = [];
  const channels: RateSheetChannelInput[] = [];
  for (const id of CHANNEL_IDS) {
    if (id === 'direct') continue;
    const c = channelSet.byId.get(id);
    if (!c || !c.active) continue;
    if (!c.economics) { skippedChannels.push(id); continue; }
    channels.push({
      channelId: id,
      economics: c.economics,
      extraAdjustmentPct: c.extraAdjustmentPct,
      rounding: c.rounding ?? { nearest: 5, mode: 'nearest' },
      cleaningFee: c.cleaningFee,
      currency: c.currency ?? 'RON',
      fxRateToChannelCurrency: c.fx?.rate,
      fxAsOf: c.fx?.asOf,
    });
  }

  const version = (await latestVersion(propertyId)) + 1;
  const sheet = buildRateSheet({
    propertyId, version, computedAt: opts.computedAt,
    periods,
    tierMultipliers: (property.pricingConfig?.tierMultipliers ?? DEFAULT_TIER_MULTIPLIERS) as TierMultipliers,
    basePrice: property.pricePerNight ?? 0,
    direct: directCfg.directEconomics,
    channels,
    defaultMinimumStay: property.defaultMinimumStay ?? 1,
    from: opts.from, to: opts.to,
  });

  const pushes = diffAgainstApplied(sheet, await getPushes(propertyId));

  if (opts.write) {
    const batch = db.batch();
    batch.set(db.collection(SHEETS).doc(`${propertyId}_${version}`), {
      ...sheet, createdAt: FieldValue.serverTimestamp(), createdBy: opts.updatedBy ?? 'rateSheetService',
    });
    for (const p of pushes) {
      batch.set(db.collection(PUSHES).doc(p.id), { ...p, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    await batch.commit();
    logger.info('Rate sheet generated', {
      propertyId, version, rows: sheet.rows.length,
      pending: pushes.filter((p) => p.status === 'pending').length,
      skippedChannels,
    });
  }

  return { sheet, pushes, written: !!opts.write, skippedChannels };
}

/**
 * Close the loop: judge applied pushes against what the parity system actually saw on the channel.
 *
 * This is why the parity work exists as infrastructure rather than a one-off audit. `applied` is only
 * a claim — someone says they typed it. An observation is evidence. `drifted` is the state that earns
 * the whole mechanism: it catches a channel promotion, a typo, or a push that never happened.
 *
 * THE APPROXIMATION, stated plainly: observations record a guest TOTAL for a window, while a push
 * targets a NIGHTLY rate. Converting needs the channel's cleaning fee subtracted first, so a channel
 * with no recorded cleaning fee is skipped rather than verified against a number that silently
 * includes one. Length-of-stay discounts on the channel side would also distort this, which is part
 * of why the tolerance is 3% and not tighter.
 */
export interface VerificationOutcome {
  pushId: string;
  channelId: string;
  periodId: string;
  from: PushStatus;
  to: PushStatus;
  note: string;
  observationId: string;
}

export async function verifyPushesFromObservations(
  propertyId: string,
  opts: { write?: boolean; tolerancePct?: number } = {},
): Promise<{ outcomes: VerificationOutcome[]; skipped: string[] }> {
  const db = await getAdminDb();
  const [pushes, channelSet, obsSnap] = await Promise.all([
    getPushes(propertyId),
    getChannels(propertyId),
    db.collection('channelPriceObservations').where('propertyId', '==', propertyId).get(),
  ]);

  type ObsRow = {
    id: string; status?: string; guestTotal?: number; nights?: number;
    channel?: string; checkIn?: string; capturedAt?: string;
  };
  const observations = obsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ObsRow)
    .filter((o): o is ObsRow & { guestTotal: number; nights: number; checkIn: string } =>
      o.status === 'captured' && typeof o.guestTotal === 'number' && (o.nights ?? 0) > 0 && !!o.checkIn)
    .sort((a, b) => String(b.capturedAt ?? '').localeCompare(String(a.capturedAt ?? '')));

  const periodRanges = new Map((await getPeriods(propertyId)).map((p) => [p.id, p]));
  const outcomes: VerificationOutcome[] = [];
  const skipped: string[] = [];

  for (const push of pushes) {
    if (push.status === 'pending') continue;   // nothing claimed yet, nothing to check
    const period = periodRanges.get(push.periodId);
    if (!period) { skipped.push(`${push.id}: period no longer exists`); continue; }

    const channel = channelSet.byId.get(push.channelId as ChannelId);
    const cleaningFee = channel?.cleaningFee;
    if (cleaningFee == null) {
      skipped.push(`${push.id}: no cleaning fee recorded for ${push.channelId}, so a guest total cannot be reduced to a nightly rate`);
      continue;
    }

    // The most recent capture for this channel whose stay falls inside the period.
    const obs = observations.find((o) =>
      normalizeChannel(o.channel) === push.channelId &&
      o.checkIn >= period.startDate && o.checkIn <= period.endDate);
    if (!obs) { skipped.push(`${push.id}: no capture inside ${period.startDate}→${period.endDate}`); continue; }

    const nightlyEquivalent = (obs.guestTotal - cleaningFee) / obs.nights;
    const { status, note } = verifyPush(push, {
      nightlyEquivalent, observationId: obs.id, capturedAt: String(obs.capturedAt ?? ''),
    }, { tolerancePct: opts.tolerancePct });

    if (status === push.status && status !== 'drifted') continue;
    outcomes.push({
      pushId: push.id, channelId: push.channelId, periodId: push.periodId,
      from: push.status, to: status, note, observationId: obs.id,
    });
  }

  if (opts.write && outcomes.length) {
    const batch = db.batch();
    for (const o of outcomes) {
      batch.set(db.collection(PUSHES).doc(o.pushId), {
        status: o.to, note: o.note,
        verificationObservationId: o.observationId,
        verifiedAt: new Date().toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    await batch.commit();
    logger.info('Channel pushes verified against observations', {
      propertyId, updated: outcomes.length,
      drifted: outcomes.filter((o) => o.to === 'drifted').length,
    });
  }

  return { outcomes, skipped };
}

/**
 * Record that a human typed a price into a channel's dashboard.
 *
 * This is the ONLY way a push reaches `applied`. The system has no write access to the OTAs, so it
 * cannot observe the edit — it can only be told, and then check.
 */
export async function markApplied(pushId: string, appliedBy: string, note?: string): Promise<void> {
  const db = await getAdminDb();
  await db.collection(PUSHES).doc(pushId).set({
    status: 'applied', appliedBy, appliedAt: new Date().toISOString(),
    ...(note ? { note } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  logger.info('Channel push marked applied', { pushId, appliedBy });
}
