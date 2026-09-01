/**
 * Reads and writes `channels/{propertyId}_{channelId}` — the per-property distribution configuration.
 *
 * WHY THIS EXISTS: the commission rates lived in three hardcoded tables (`parity-pack.ts`,
 * `parity-report.ts`, `set-channel-pricing.ts`), each with its own copy of Airbnb's rate. They had
 * already drifted apart — all three still said 18.5% after the owner confirmed the real figure is
 * 18.755% (15.5% host-only × 1.21 RO VAT). A rate that lives in three places is a rate nobody owns.
 *
 * The rates here are the OWNER'S, stated by the owner. Nothing infers, scrapes or defaults them: a
 * wrong commission silently corrupts every net-parity number downstream, and a plausible guess is far
 * more dangerous than a missing value. So a channel with no persisted economics reads as absent, and
 * callers must say so out loud rather than substituting a default.
 *
 * Admin-SDK only. No maths lives here — that is `parityMath`.
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import {
  CHANNEL_IDS, CHANNEL_LABELS, channelDocId, normalizeChannel, isChannelId,
  type ChannelConfig, type ChannelId, type ChannelEconomics, type DirectEconomics,
} from '@/lib/channels';

const logger = loggers.pricing;
const COLLECTION = 'channels';

/** What the caller gets back: the configured channels, plus what could not be resolved. */
export interface ChannelSet {
  propertyId: string;
  byId: Map<ChannelId, ChannelConfig>;
  /** Configured and active, in vocabulary order. */
  active: ChannelConfig[];
  /** Ids with no document at all — the caller must not invent economics for these. */
  missing: ChannelId[];
}

function toConfig(id: string, data: Record<string, unknown>): ChannelConfig | null {
  const channelId = normalizeChannel(data.channelId);
  if (!channelId) {
    logger.warn('Skipping channel doc with unrecognised channelId', { docId: id, raw: data.channelId });
    return null;
  }
  return { ...(data as unknown as ChannelConfig), channelId };
}

export async function getChannels(propertyId: string): Promise<ChannelSet> {
  const db = await getAdminDb();
  const snap = await db.collection(COLLECTION).where('propertyId', '==', propertyId).get();

  const byId = new Map<ChannelId, ChannelConfig>();
  snap.docs.forEach((d) => {
    const cfg = toConfig(d.id, d.data() as Record<string, unknown>);
    if (cfg) byId.set(cfg.channelId, cfg);
  });

  return {
    propertyId,
    byId,
    active: CHANNEL_IDS.map((id) => byId.get(id)).filter((c): c is ChannelConfig => !!c && c.active),
    missing: CHANNEL_IDS.filter((id) => !byId.has(id)),
  };
}

export async function getChannel(propertyId: string, channelId: ChannelId): Promise<ChannelConfig | null> {
  const db = await getAdminDb();
  const doc = await db.collection(COLLECTION).doc(channelDocId(propertyId, channelId)).get();
  return doc.exists ? toConfig(doc.id, doc.data() as Record<string, unknown>) : null;
}

export async function upsertChannel(
  propertyId: string,
  channelId: ChannelId,
  patch: Partial<ChannelConfig>,
  updatedBy: string,
): Promise<void> {
  if (!isChannelId(channelId)) throw new Error(`Not a channel id: ${String(channelId)}`);
  const db = await getAdminDb();
  // Firestore rejects `undefined` outright. A partial patch legitimately omits fields — Travelminit has
  // no listing URL — so drop them here rather than making every caller remember. Note this means a
  // field cannot be CLEARED by passing undefined; use FieldValue.delete() for that, deliberately.
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  await db.collection(COLLECTION).doc(channelDocId(propertyId, channelId)).set(
    {
      ...clean,
      propertyId,
      channelId,
      displayName: patch.displayName ?? CHANNEL_LABELS[channelId],
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy,
    },
    { merge: true },
  );
  logger.info('Channel config updated', { propertyId, channelId, fields: Object.keys(patch), updatedBy });
}

/**
 * The economics the parity tools need, assembled from live config — the single replacement for the
 * three hardcoded rate tables that used to live in the CLIs and had already drifted apart.
 *
 * Throws rather than defaulting. Producing a parity report against a guessed commission is worse than
 * producing none: the numbers look authoritative, get acted on, and are wrong in a direction nobody
 * can see. The error says exactly how to fix it.
 */
export interface ParityConfig {
  /** OTA channels that are active AND have stated economics. */
  channels: ChannelEconomics[];
  direct: DirectEconomics;
  targetDiscountPct: number;
  listingUrls: Record<string, string>;
  /** Active channels the owner has not priced — reported, never silently defaulted. */
  unstated: ChannelId[];
  /** Configured but not being sold on right now, with the reason. */
  inactive: Array<{ channelId: ChannelId; reason?: string }>;
}

export async function getParityConfig(propertyId: string): Promise<ParityConfig> {
  const set = await getChannels(propertyId);

  if (set.byId.size === 0) {
    throw new Error(
      `No channels configured for "${propertyId}". Parity needs the commission rates you actually pay.\n` +
      `  Fix: npx tsx scripts/migrate-channels.ts --property ${propertyId} --write  (lifts property.channelPricing)\n` +
      `  or configure the channels in /admin/pricing.`,
    );
  }

  const direct = set.byId.get('direct');
  if (!direct?.directEconomics) {
    throw new Error(
      `No direct economics for "${propertyId}" — the card-processing cost is what makes a direct booking\n` +
      `comparable to an OTA one. Set it on channels/${channelDocId(propertyId, 'direct')}.`,
    );
  }

  const channels: ChannelEconomics[] = [];
  const unstated: ChannelId[] = [];
  const inactive: Array<{ channelId: ChannelId; reason?: string }> = [];
  const listingUrls: Record<string, string> = {};

  for (const cfg of set.byId.values()) {
    if (cfg.listingUrl) listingUrls[cfg.channelId] = cfg.listingUrl;
    if (cfg.channelId === 'direct') continue;
    if (!cfg.active) { inactive.push({ channelId: cfg.channelId, reason: cfg.inactiveReason }); continue; }
    if (!cfg.economics) { unstated.push(cfg.channelId); continue; }
    channels.push(cfg.economics);
  }

  return {
    channels,
    direct: direct.directEconomics,
    targetDiscountPct: direct.targetDirectDiscountPct ?? 0,
    listingUrls,
    unstated,
    inactive,
  };
}

/**
 * Lift `property.channelPricing` into `channels/*` without deciding anything the owner did not decide.
 *
 * Two rules make this safe to re-run and safe to trust:
 *
 * 1. **Nothing is invented.** A channel absent from `channelPricing` is reported, not created with a
 *    default rate. Coltei has no channel pricing at all; it must come out of this with no channels,
 *    not with Prahova's commissions.
 * 2. **Nothing is overwritten.** Existing docs are left alone unless `overwrite` is set, so a rate the
 *    owner has since corrected in the admin is not reverted by re-running the migration.
 *
 * `extraAdjustmentPct` is deliberately NOT set here. It is the gap between the structural net-parity
 * factor and what the owner actually lists — currently −4% on Airbnb — and that gap is a *finding to
 * put in front of the owner*, not five years of accumulated drift to encode as intent.
 */
export interface MigrationResult {
  propertyId: string;
  created: ChannelId[];
  skippedExisting: ChannelId[];
  /** In `channelPricing` but not a recognised channel id. */
  unrecognised: string[];
  /** Recognised, but the owner has stated no economics for it. */
  noEconomics: ChannelId[];
  notes: string[];
}

export async function migrateChannelPricing(
  propertyId: string,
  channelPricing: Record<string, any> | null | undefined,
  opts: { overwrite?: boolean; dryRun?: boolean; updatedBy?: string } = {},
): Promise<MigrationResult> {
  const { overwrite = false, dryRun = false, updatedBy = 'migrate-channels' } = opts;
  const result: MigrationResult = {
    propertyId, created: [], skippedExisting: [], unrecognised: [], noEconomics: [], notes: [],
  };

  if (!channelPricing) {
    result.notes.push('No channelPricing on this property — no channels created. Configure them in the admin.');
    return result;
  }

  const existing = await getChannels(propertyId);
  const listingUrls: Record<string, string> = channelPricing.listingUrls ?? {};
  const excluded: Array<{ channel: string; reason?: string; since?: string }> = channelPricing.excludedChannels ?? [];

  /** Build one doc per channel the owner has actually said something about. */
  const drafts = new Map<ChannelId, Partial<ChannelConfig>>();

  // Direct is implicit in the old shape: it has no entry in `channels[]`, only `direct` + target discount.
  if (channelPricing.direct) {
    drafts.set('direct', {
      active: true,
      directEconomics: { paymentCostPct: Number(channelPricing.direct.paymentCostPct) },
      targetDirectDiscountPct: channelPricing.targetDiscountPct != null
        ? Number(channelPricing.targetDiscountPct) : undefined,
      currency: 'RON',
    });
  }

  for (const entry of (channelPricing.channels ?? [])) {
    const id = normalizeChannel(entry?.channel);
    if (!id) { result.unrecognised.push(String(entry?.channel)); continue; }
    if (entry.commissionPct == null) { result.noEconomics.push(id); continue; }
    drafts.set(id, {
      active: true,
      economics: {
        channel: id,
        commissionPct: Number(entry.commissionPct),
        ...(entry.guestFeePct != null ? { guestFeePct: Number(entry.guestFeePct) } : {}),
      },
      currency: 'RON',
      listingUrl: listingUrls[id] ?? listingUrls[entry.channel],
    });
  }

  for (const ex of excluded) {
    const id = normalizeChannel(ex?.channel);
    if (!id) { result.unrecognised.push(String(ex?.channel)); continue; }
    // Excluded channels are recorded as inactive rather than omitted: history exists on them (one live
    // booking came through Travelminit) and "we are not on this right now, because X" is itself a fact.
    drafts.set(id, {
      active: false,
      inactiveReason: [ex.reason, ex.since ? `(since ${ex.since})` : ''].filter(Boolean).join(' '),
      currency: 'RON',
      listingUrl: listingUrls[id],
    });
    if (!result.noEconomics.includes(id)) result.noEconomics.push(id);
  }

  for (const [id, draft] of drafts) {
    if (existing.byId.has(id) && !overwrite) { result.skippedExisting.push(id); continue; }
    if (!dryRun) await upsertChannel(propertyId, id, draft, updatedBy);
    result.created.push(id);
  }

  const untouched = CHANNEL_IDS.filter((id) => !drafts.has(id));
  if (untouched.length) {
    result.notes.push(
      `Not configured, left absent rather than defaulted: ${untouched.join(', ')}. ` +
      'A missing channel reads as "the owner has not stated this", which is true.',
    );
  }
  return result;
}


/**
 * Per channel, the standing discount a qualifying guest gets that no capture can see.
 *
 * Exists as ONE function because four different callers build parity windows - the admin board, the
 * position roll-up, the apply script and the analysis scripts - and each had to be told about the
 * correction separately. When the owner removed Airbnb's on 2026-09-01, two of the four were updated
 * and two were not, and the apply script went on proposing prices computed with a 14% deduction that
 * no longer existed. It would have written them to the live site.
 *
 * A value of 0 is meaningfully different from absent: absent means nobody has recorded one, and the
 * caller falls back to the built-in estimate; 0 means the owner turned it off.
 */
export async function getStandingDiscounts(propertyId: string): Promise<Record<string, number>> {
  const set = await getChannels(propertyId);
  return Object.fromEntries(
    [...set.byId.values()]
      .filter((c) => c.standingGuestDiscountPct !== undefined)
      .map((c) => [c.channelId, c.standingGuestDiscountPct as number]),
  );
}


/**
 * Per channel, the last recorded change to that channel's own settings.
 *
 * The companion to `getStandingDiscounts`, and here for the same reason: five call sites build parity
 * windows, and a fact that has to be passed to each of them separately will eventually reach some and
 * not others. This one decides whether a stored price still describes anything real, so the call site
 * it fails to reach is the one that quietly prices off fiction.
 */
export async function getSettingsChanges(
  propertyId: string,
): Promise<Record<string, { date: string; fromNights: number; note?: string }>> {
  const set = await getChannels(propertyId);
  return Object.fromEntries(
    [...set.byId.values()]
      .filter((c) => c.discountsChangedAt)
      .map((c) => [c.channelId, c.discountsChangedAt!]),
  );
}
