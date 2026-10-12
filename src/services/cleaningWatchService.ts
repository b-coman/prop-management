// src/services/cleaningWatchService.ts
// Runs the cleaning watch (src/lib/cleaning-watch.ts) against live data and sends what it decides.
//
// Every 15 minutes, per property with `propertySecrets/{id}.cleaningWatch.enabled`:
//   1. read the stays, the OTA-blocked nights and (if configured) the Nuki lock's log
//   2. plan: due checks, lock news, last-minute arrivals, missed iPhone shortcut runs, lock health
//   3. claim each message's key in Firestore, then send it to the owner on the property's WhatsApp
//      number; a failed send releases the claim so the next run tries again
//
// The owner's button taps come back through the WhatsApp webhook to handleCleaningReply().
// Nothing here writes to the cleaner. Her messages still go from the owner's own phone.

import 'server-only';
import { randomBytes } from 'crypto';
import { getAdminDb, FieldValue, Timestamp } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { normalizePhone } from '@/lib/sanitize';
import { addDays, dayLabel } from '@/lib/cleaning-schedule';
import { formatBucharestDate, getBucharestHourMinute } from '@/lib/dates/property-times';
import {
  buildCleanings, cleanerVisit, isQuietHour, nextCheckAt, planCleaning, planLastMinute, planShortcuts,
  type CleaningRecord, type LockEvent, type OwnerMessage, type ShortcutExpectation, type Visit,
  type WatchedCleaning, type WatchSettings, type WeeklySchedule,
} from '@/lib/cleaning-watch';
import { loadCleaningInputs, loadStandardTimes } from '@/services/cleaningData';
import { getSmartlock, getSmartlockLog, nukiConfigured, type NukiSmartlock } from '@/services/nukiClient';
import { sendCloudTemplate, sendCloudText } from '@/services/whatsappCloud';

const logger = loggers.housekeeping;

/** Meta templates (UTILITY, ro). The question one carries Da / Nu inca / Scrie-i pe WhatsApp. */
export const QUESTION_TEMPLATE = 'curatenie_verificare';
export const INFO_TEMPLATE = 'notificare_curatenie';
const TEMPLATE_LANGUAGE = 'ro';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Lock log read on each run; older visits are kept on the cleaning's record. */
const LOG_WINDOW = 36 * HOUR;
/** Lock offline or unreadable this long before the owner hears about it. */
const LOCK_GRACE = HOUR;

/** Settings in `propertySecrets/{propertyId}.cleaningWatch` (admin-only: it holds phone numbers). */
export interface CleaningWatchConfig {
  enabled: boolean;
  /** Short name the owner knows the property by: "Coltei". */
  label: string;
  cleanerName: string;
  /** For the "Scrie-i pe WhatsApp" button. Without it, WhatsApp opens its contact picker. */
  cleanerPhone?: string | null;
  ownerPhone: string;
  /** The lock and the names of the cleaner's keypad codes, exactly as set in the Nuki app. */
  nuki?: { smartlockId: number; cleanerNames: string[] } | null;
  /** When the cleaner's weekly message goes out (Sunday 17:00 for Coltei). */
  weeklyMessage?: WeeklySchedule | null;
  shortcuts?: ShortcutExpectation[];
}

export interface WatchReport {
  propertyId: string;
  lock?: string;
  watched?: { key: string; arrival: string | null; visit: string | null; done: boolean }[];
  messages?: { key: string; kind: string; text: string; sent?: boolean; error?: string }[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Firestore shapes
// ---------------------------------------------------------------------------

function asDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const t = v as { toDate?: () => Date };
  return typeof t.toDate === 'function' ? t.toDate() : null;
}

function asDates(map: unknown): Record<string, Date> {
  const out: Record<string, Date> = {};
  for (const [k, v] of Object.entries((map as Record<string, unknown>) || {})) {
    const d = asDate(v);
    if (d) out[k] = d;
  }
  return out;
}

function toRecord(data: FirebaseFirestore.DocumentData | undefined): CleaningRecord & { visit: Visit | null } {
  const enteredAt = asDate(data?.visit?.enteredAt);
  return {
    ackAt: asDate(data?.ackAt),
    doneAt: asDate(data?.doneAt),
    notYetAt: asDate(data?.notYetAt),
    sent: asDates(data?.sent),
    visit: enteredAt ? { enteredAt, leftAt: asDate(data?.visit?.leftAt) } : null,
  };
}

async function loadConfigs(onlyProperty: string | undefined, dryRun: boolean) {
  const db = await getAdminDb();
  if (onlyProperty) {
    // A dry run may look at a property that is not switched on yet.
    const config = (await db.collection('propertySecrets').doc(onlyProperty).get()).data()?.cleaningWatch as CleaningWatchConfig | undefined;
    return config && (config.enabled || dryRun) ? [{ propertyId: onlyProperty, config }] : [];
  }
  const snap = await db.collection('propertySecrets').where('cleaningWatch.enabled', '==', true).get();
  return snap.docs.map(d => ({ propertyId: d.id, config: d.data().cleaningWatch as CleaningWatchConfig }));
}

// ---------------------------------------------------------------------------
// The lock
// ---------------------------------------------------------------------------

interface LockRead {
  configured: boolean;
  /** Online and its log was read: visits can be trusted this run. */
  usable: boolean;
  events: LockEvent[];
  smartlock: NukiSmartlock | null;
  error: string | null;
}

async function readLock(config: CleaningWatchConfig, now: Date): Promise<LockRead> {
  const smartlockId = config.nuki?.smartlockId;
  if (!smartlockId || !nukiConfigured()) return { configured: false, usable: false, events: [], smartlock: null, error: null };
  try {
    const smartlock = await getSmartlock(smartlockId);
    const events = await getSmartlockLog(smartlockId, new Date(now.getTime() - LOG_WINDOW));
    return { configured: true, usable: smartlock.serverState === 0, events, smartlock, error: null };
  } catch (error) {
    logger.warn('Nuki lock unreadable', { smartlockId, error: (error as Error).message });
    return { configured: true, usable: false, events: [], smartlock: null, error: (error as Error).message };
  }
}

function clock(d: Date): string {
  const { hour, minute } = getBucharestHourMinute(d);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Battery and connection news, once per episode. An episode ends when the condition clears, which
 * also clears its key so the next one is reported again. Returns the messages and the key changes.
 */
function planLockHealth(
  lock: LockRead,
  health: { offlineSince?: Date | null; errorSince?: Date | null },
  sent: Record<string, Date>,
  now: Date,
): { messages: OwnerMessage[]; health: { offlineSince: Date | null; errorSince: Date | null }; clear: string[] } {
  const messages: OwnerMessage[] = [];
  const clear: string[] = [];
  const next = { offlineSince: null as Date | null, errorSince: null as Date | null };
  if (!lock.configured) return { messages, health: next, clear };
  const info = (key: string, text: string) => { if (!sent[key]) messages.push({ cleaningKey: null, key, kind: 'info', text }); };
  const quiet = isQuietHour(now);

  if (lock.error) {
    next.errorSince = health.errorSince ?? now;
    if (!quiet && now.getTime() - next.errorSince.getTime() >= LOCK_GRACE) {
      info('health:error', `Nu pot citi incuietoarea Nuki din ${clock(next.errorSince)} (${lock.error}). ` +
        `Pana se rezolva, te intreb pe tine de curatenii.`);
    }
    return { messages, health: next, clear };
  }
  clear.push('health:error');

  const s = lock.smartlock!;
  if (s.serverState !== 0) {
    next.offlineSince = health.offlineSince ?? now;
    if (!quiet && now.getTime() - next.offlineSince.getTime() >= LOCK_GRACE) {
      info('health:offline', `Incuietoarea Nuki e offline din ${clock(next.offlineSince)}. Pana revine online (Wi-Fi sau baterii), ` +
        `nu vad cine intra in apartament, asa ca te intreb pe tine de curatenii.`);
    }
  } else {
    clear.push('health:offline');
  }
  if (s.state?.batteryCritical) {
    if (!quiet) info('health:battery', 'Bateriile incuietorii Nuki sunt aproape descarcate. Schimba cele 4 baterii AA cat mai curand, altfel incuietoarea se opreste.');
  } else {
    clear.push('health:battery');
  }
  if (s.state?.keypadBatteryCritical) {
    if (!quiet) info('health:keypad', 'Bateria tastaturii Nuki e aproape descarcata. Schimba-o cat mai curand, altfel codurile nu mai merg.');
  } else {
    clear.push('health:keypad');
  }
  return { messages, health: next, clear };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/** Claims `key` in the doc's `sent` map. False when it was already sent (or claimed by a parallel run). */
async function claim(ref: FirebaseFirestore.DocumentReference, key: string, extra: Record<string, unknown>): Promise<boolean> {
  const db = await getAdminDb();
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.data()?.sent?.[key]) return false;
    tx.set(ref, { ...extra, sent: { [key]: Timestamp.now() } }, { merge: true });
    return true;
  });
}

async function release(ref: FirebaseFirestore.DocumentReference, key: string): Promise<void> {
  await ref.set({ sent: { [key]: FieldValue.delete() } }, { merge: true });
}

async function deliver(propertyId: string, config: CleaningWatchConfig, m: OwnerMessage) {
  if (m.kind === 'info') {
    return sendCloudTemplate(config.ownerPhone, INFO_TEMPLATE, TEMPLATE_LANGUAGE, [config.label, m.text]);
  }
  // The "Scrie-i pe WhatsApp" button opens /api/cleaning/wa/<id>, which redirects to wa.me with the
  // cleaner's number and the text ready. An unguessable id keeps her number out of the URL.
  const db = await getAdminDb();
  const waId = randomBytes(12).toString('hex');
  await db.collection('cleaningWa').doc(waId).set({
    propertyId,
    phone: config.cleanerPhone || null,
    text: m.cleanerText || '',
    createdAt: FieldValue.serverTimestamp(),
  });
  const payload = (answer: 'yes' | 'no') => ['cw', propertyId, m.cleaningKey, m.answers || 'done', answer].join('|');
  return sendCloudTemplate(config.ownerPhone, QUESTION_TEMPLATE, TEMPLATE_LANGUAGE, [config.label, m.text], [
    { index: 0, type: 'quick_reply', param: payload('yes') },
    { index: 1, type: 'quick_reply', param: payload('no') },
    { index: 2, type: 'url', param: waId },
  ]);
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

export async function runCleaningWatch(opts: { now: Date; dryRun: boolean; propertyId?: string }): Promise<WatchReport[]> {
  const reports: WatchReport[] = [];
  for (const { propertyId, config } of await loadConfigs(opts.propertyId, opts.dryRun)) {
    try {
      reports.push(await watchProperty(propertyId, config, opts.now, opts.dryRun));
    } catch (error) {
      logger.error('Cleaning watch failed for property', error as Error, { propertyId });
      reports.push({ propertyId, error: (error as Error).message });
    }
  }
  return reports;
}

async function watchProperty(propertyId: string, config: CleaningWatchConfig, now: Date, dryRun: boolean): Promise<WatchReport> {
  const db = await getAdminDb();
  const today = formatBucharestDate(now);
  const from = addDays(today, -45);
  const to = addDays(today, 60);

  const [{ stays, otaBlockedNights }, std, lock, watchSnap] = await Promise.all([
    loadCleaningInputs(propertyId, from, to),
    loadStandardTimes(propertyId),
    readLock(config, now),
    db.collection('cleaningWatch').doc(propertyId).get(),
  ]);
  const watch = watchSnap.data() || {};
  const watchSent = asDates(watch.sent);

  const all = buildCleanings(stays, otaBlockedNights, std, from, to);
  // Watched: the arrival is still ahead (or was today), or no arrival follows a recent departure.
  const active = all.filter(c => c.arrivalAt
    ? c.arrivalAt.getTime() > now.getTime() - DAY
    : c.departureAt.getTime() > now.getTime() - 2 * DAY);

  const cleaningRef = (c: WatchedCleaning | string) =>
    db.collection('cleanings').doc(`${propertyId}_${typeof c === 'string' ? c : c.key}`);
  const snaps = active.length ? await db.getAll(...active.map(cleaningRef)) : [];
  const records: Record<string, CleaningRecord> = {};
  const storedVisits: Record<string, Visit | null> = {};
  snaps.forEach((snap, i) => {
    const r = toRecord(snap.data());
    records[active[i].key] = r;
    storedVisits[active[i].key] = r.visit;
  });

  // A visit seen once is kept on the record: the log read covers only the last 36 hours.
  const visits: Record<string, Visit | null> = {};
  for (const c of active) {
    const fresh = lock.usable ? cleanerVisit(c, lock.events, config.nuki?.cleanerNames ?? [], now) : null;
    const stored = storedVisits[c.key];
    visits[c.key] = stored ? { enteredAt: stored.enteredAt, leftAt: stored.leftAt ?? fresh?.leftAt ?? null } : fresh;
  }

  const settings: WatchSettings = { label: config.label, cleanerName: config.cleanerName, lock: lock.usable };
  const messages: OwnerMessage[] = [];
  for (const c of active) messages.push(...planCleaning(c, records[c.key], visits[c.key], now, settings));

  const checkIns = [
    ...stays.map(s => formatBucharestDate(s.checkIn)),
    ...all.map(c => c.checkInYmd).filter((d): d is string => !!d),
  ];
  const known = Array.isArray(watch.knownArrivals) ? (watch.knownArrivals as string[]) : null;
  const lastMinute = planLastMinute(all, checkIns, known, records, visits, now, config.weeklyMessage ?? null, settings);
  messages.push(...lastMinute.messages);

  messages.push(...planShortcuts(config.shortcuts ?? [], asDates(watch.shortcutCalls), watchSent, now));

  const health = planLockHealth(lock, { offlineSince: asDate(watch.health?.offlineSince), errorSince: asDate(watch.health?.errorSince) }, watchSent, now);
  messages.push(...health.messages);

  const report: WatchReport = {
    propertyId,
    lock: !lock.configured ? 'none' : lock.usable ? 'online' : lock.error ? `error: ${lock.error}` : 'offline',
    watched: active.map(c => ({
      key: c.key,
      arrival: c.arrivalAt ? c.arrivalAt.toISOString() : null,
      visit: visits[c.key] ? `${visits[c.key]!.enteredAt.toISOString()}..${visits[c.key]!.leftAt?.toISOString() ?? ''}` : null,
      done: !!records[c.key]?.doneAt,
    })),
    messages: messages.map(m => ({ key: m.key, kind: m.kind, text: m.text })),
  };
  if (dryRun) return report;

  // Send. Each key is claimed first, so two overlapping runs can't both send it.
  const watchRef = db.collection('cleaningWatch').doc(propertyId);
  for (const [i, m] of messages.entries()) {
    const ref = m.cleaningKey ? cleaningRef(m.cleaningKey) : watchRef;
    const extra = m.cleaningKey ? { propertyId, key: m.cleaningKey } : { propertyId };
    if (!(await claim(ref, m.key, extra))) continue;
    const result = await deliver(propertyId, config, m);
    report.messages![i].sent = result.ok;
    if (!result.ok) {
      report.messages![i].error = result.error;
      await release(ref, m.key);
      continue;
    }
    if (result.wamid) {
      await db.collection('ownerAlerts').doc(result.wamid).set({
        propertyId, key: m.key, cleaningKey: m.cleaningKey, kind: m.kind, text: m.text,
        sentAt: FieldValue.serverTimestamp(),
      });
    }
    logger.info('Cleaning watch message sent', { propertyId, key: m.key, kind: m.kind });
  }

  // Keep what this run learned.
  const clearKeys = Object.fromEntries(health.clear.filter(k => watchSent[k]).map(k => [k, FieldValue.delete()]));
  await watchRef.set({
    propertyId,
    knownArrivals: lastMinute.known,
    health: health.health,
    lastRunAt: FieldValue.serverTimestamp(),
    ...(Object.keys(clearKeys).length ? { sent: clearKeys } : {}),
  }, { merge: true });
  for (const c of active) {
    const v = visits[c.key];
    const stored = storedVisits[c.key];
    if (v && (!stored || (!stored.leftAt && v.leftAt))) {
      await cleaningRef(c).set({ propertyId, key: c.key, visit: { enteredAt: v.enteredAt, leftAt: v.leftAt } }, { merge: true });
    }
  }
  return report;
}

// ---------------------------------------------------------------------------
// The owner's answers
// ---------------------------------------------------------------------------

function whenAt(d: Date, now: Date): string {
  const ymd = formatBucharestDate(d);
  if (ymd === formatBucharestDate(now)) return `la ${clock(d)}`;
  if (ymd === addDays(formatBucharestDate(now), 1)) return `maine la ${clock(d)}`;
  return `${dayLabel(ymd)} la ${clock(d)}`;
}

/**
 * A tap on "Da" / "Nu inca" under a question. The payload is `cw|<propertyId>|<cleaning>|<ack|done>|<yes|no>`.
 * Only the configured owner's number is listened to. Returns true when the tap was handled.
 */
export async function handleCleaningReply(from: string, payload: string): Promise<boolean> {
  const parts = payload.split('|');
  if (parts.length !== 5 || parts[0] !== 'cw') return false;
  const [, propertyId, key, answers, answer] = parts;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !['ack', 'done'].includes(answers) || !['yes', 'no'].includes(answer)) return false;

  const db = await getAdminDb();
  const config = (await db.collection('propertySecrets').doc(propertyId).get()).data()?.cleaningWatch as CleaningWatchConfig | undefined;
  if (!config?.ownerPhone || normalizePhone(config.ownerPhone) !== normalizePhone(from)) {
    logger.warn('Cleaning reply from an unexpected number ignored', { propertyId });
    return false;
  }

  const now = new Date();
  const update = answer === 'no'
    ? { notYetAt: now }
    : answers === 'done' ? { doneAt: now, doneBy: 'owner' } : { ackAt: now };
  await db.collection('cleanings').doc(`${propertyId}_${key}`).set({ propertyId, key, ...update }, { merge: true });

  let text = 'Notat.';
  try {
    const today = formatBucharestDate(now);
    const [{ stays, otaBlockedNights }, std, snap] = await Promise.all([
      loadCleaningInputs(propertyId, addDays(today, -45), addDays(today, 60)),
      loadStandardTimes(propertyId),
      db.collection('cleanings').doc(`${propertyId}_${key}`).get(),
    ]);
    const c = buildCleanings(stays, otaBlockedNights, std, key, key)[0];
    const record = toRecord(snap.data());
    const lock = !!config.nuki?.smartlockId && nukiConfigured();
    const next = c ? nextCheckAt(c, record, lock, now) : null;
    if (answer === 'yes' && answers === 'done') {
      text = c?.checkInYmd
        ? `Notat: curatenia pentru sosirea de ${dayLabel(c.checkInYmd)} e facuta. Multumesc!`
        : 'Notat: curatenia e facuta. Multumesc!';
    } else if (answer === 'yes') {
      text = next ? `Notat. Te intreb ${whenAt(next, now)} daca e gata curatenia.` : 'Notat.';
    } else {
      text = next
        ? `Notat. Te mai intreb ${whenAt(next, now)}.`
        : 'Notat. Nu mai am alta verificare programata inainte de sosire, te rog sa urmaresti tu.';
    }
  } catch (error) {
    logger.warn('Could not work out the next check for the reply', { propertyId, key, error: (error as Error).message });
  }
  // The tap opened WhatsApp's 24h window, so a plain text reply is allowed.
  await sendCloudText(config.ownerPhone, text);
  logger.info('Cleaning reply handled', { propertyId, key, answers, answer });
  return true;
}

// ---------------------------------------------------------------------------
// Shortcut heartbeat
// ---------------------------------------------------------------------------

const TRACKED_OPS = new Set(['weeklySchedule', 'cleaningReminder', 'dailyMessages', 'changedReservations', 'monthlyReservations']);

/** Records that the owner's phone called /api/automation for `op`. Never throws. */
export async function recordShortcutCall(propertyId: string, op: string): Promise<void> {
  if (!TRACKED_OPS.has(op)) return;
  try {
    const db = await getAdminDb();
    await db.collection('cleaningWatch').doc(propertyId).set(
      { shortcutCalls: { [op]: FieldValue.serverTimestamp() } },
      { merge: true },
    );
  } catch {
    // Bookkeeping only: it must never cost the shortcut its answer.
  }
}
