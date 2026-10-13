// src/lib/cleaning-watch.ts
// Checks that each cleaning happens, and tells the owner in time to fix it when it hasn't.
//
// The cleaner's own messages (Sunday schedule, morning reminders) go out from the owner's phone and
// are built in cleaning-schedule.ts. This is the other half: it writes only to the OWNER, on the
// property's WhatsApp number, and only when something needs him. When it checks depends on the
// window: a same-day changeover within the hour after checkout, a four-day gap the evening before
// the arrival and again that morning. That leaves time to act, which a fixed "3 hours before" does not.
//
// "Done" comes from the Nuki lock when there is one (the cleaner opens the door with her own keypad
// code, which she has to do anyway), otherwise from the owner tapping "Da".
//
// Pure: no Firestore, no network; `now` is passed in.

import {
  addDays, arrivesAfterMidnight, arrivesAt, dayLabel, hhmm, leavesAt, minutesOf, nextWeek, people, prepare,
  type CleaningStay,
} from '@/lib/cleaning-schedule';
import { bucharestAt, formatBucharestDate, getBucharestHourMinute } from '@/lib/dates/property-times';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** A window this short (the standard 11:00 to 15:00 is 4h) is checked on the day itself. */
const TIGHT_WINDOW = 12 * HOUR;
/** A check more than this late (downtime, the first deploy) is dropped rather than sent stale. */
const FRESH_FOR = 2 * HOUR;
/** Guests sometimes leave early and the cleaner starts before checkout; entries this early count. */
const EARLY_ENTRY = 3 * HOUR;
/** A visit has ended when the door was locked and nothing else happened for this long. */
const VISIT_QUIET = 45 * MINUTE;
/** A shorter "visit" is ambiguous (an auto-lock right after she came in), so no end time is claimed. */
const MIN_VISIT = 20 * MINUTE;
/** A visit with no end seen is reported after this long. */
const OPEN_VISIT_REPORT = 6 * HOUR;

export interface StandardTimes {
  /** "15:00" */
  checkIn: string;
  /** "11:00" */
  checkOut: string;
}

/** One cleaning: from a departure to the next arrival. */
export interface WatchedCleaning {
  /** The departure date, YYYY-MM-DD. Identifies the cleaning. */
  key: string;
  departureAt: Date;
  /** null when the apartment empties at the end of OTA-blocked nights with no booking entered. */
  departure: CleaningStay | null;
  /** The check-in date as booked; labels use it so "Joi 22.10, 01:30 noaptea" reads right. */
  checkInYmd: string | null;
  /** When the next guests really arrive (agreed time, else standard check-in). */
  arrivalAt: Date | null;
  arrival: CleaningStay | null;
  /** The next arrival is OTA-blocked nights with no booking entered yet. */
  arrivalUnconfirmed: boolean;
}

/** A Nuki log line: `action` 1 unlock, 2 lock, 3 unlatch, 4/5 lock 'n' go; `state` 0 is success. */
export interface LockEvent {
  at: Date;
  action: number;
  state: number;
  /** The authorization's name: the keypad code or app user that did it. */
  name: string;
}

export interface Visit {
  enteredAt: Date;
  leftAt: Date | null;
}

export type CheckKind = 'ack' | 'arrival' | 'done' | 'evening' | 'morning';

/** What the system already knows about one cleaning. */
export interface CleaningRecord {
  /** The owner confirmed the cleaner is coming / was told. */
  ackAt?: Date | null;
  /** The owner confirmed the cleaning is done. */
  doneAt?: Date | null;
  notYetAt?: Date | null;
  /** Message keys already sent, so nothing goes twice. */
  sent?: Record<string, Date>;
}

export interface WatchSettings {
  /** Short property name for the owner: "Coltei". */
  label: string;
  cleanerName: string;
  /** A lock is configured and was readable this run. */
  lock: boolean;
}

export interface OwnerMessage {
  /** The cleaning the message is about (its record stores the sent key; buttons answer it). */
  cleaningKey: string | null;
  key: string;
  /** 'question' carries the Da / Nu inca / Scrie-i buttons; 'info' needs no answer. */
  kind: 'question' | 'info';
  text: string;
  /** Prefilled text for the "Scrie-i pe WhatsApp" button. */
  cleanerText?: string;
  /** What a "Da" confirms. */
  answers?: 'ack' | 'done';
}

export interface ShortcutExpectation {
  /** The /api/automation op the shortcut calls. */
  op: string;
  /** 0 = Sunday. */
  weekdays: number[];
  /** Days of the month it also runs on (the 1st, for a monthly list). */
  monthDays?: number[];
  /** "17:00" */
  time: string;
  /** What the owner calls it: "programul de duminica pentru Mihaela". */
  label: string;
}

export interface WeeklySchedule {
  weekday: number;
  time: string;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function clock(d: Date): string {
  const { hour, minute } = getBucharestHourMinute(d);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

/** No messages to the owner between 22:00 and 07:00. */
export function isQuietHour(now: Date): boolean {
  const { hour } = getBucharestHourMinute(now);
  return hour >= 22 || hour < 7;
}

function duration(ms: number): string {
  const total = Math.round(ms / MINUTE);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  const hours = h === 1 ? '1 ora' : `${h} ore`;
  return m ? `${hours} ${m} min` : hours;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Cleanings
// ---------------------------------------------------------------------------

function arrivalInstant(s: CleaningStay, checkInYmd: string): Date {
  if (!s.arrivalTime) return s.checkIn;
  return bucharestAt(arrivesAfterMidnight(s) ? addDays(checkInYmd, 1) : checkInYmd, s.arrivalTime);
}

/**
 * The cleanings whose departure falls between `fromYmd` and `toYmd`, each paired with the next
 * arrival. OTA-blocked nights with no booking count as a stay at the standard times, so an
 * unentered reservation still gets its cleaning watched.
 */
export function buildCleanings(
  stays: CleaningStay[],
  otaBlockedNights: string[],
  std: StandardTimes,
  fromYmd: string,
  toYmd: string,
): WatchedCleaning[] {
  const { dated, unknownRanges } = prepare(stays, otaBlockedNights);
  const arrivals = [
    ...dated.map(s => ({ checkInYmd: s.in, at: arrivalInstant(s.stay, s.in), stay: s.stay as CleaningStay | null })),
    ...unknownRanges.map(r => ({ checkInYmd: r.from, at: bucharestAt(r.from, std.checkIn), stay: null })),
  ].sort((a, b) => a.checkInYmd.localeCompare(b.checkInYmd));
  const departures = [
    ...dated.map(s => ({
      ymd: s.out,
      at: s.stay.departureTime ? bucharestAt(s.out, s.stay.departureTime) : s.stay.checkOut,
      stay: s.stay as CleaningStay | null,
    })),
    ...unknownRanges.map(r => ({ ymd: r.to, at: bucharestAt(r.to, std.checkOut), stay: null })),
  ]
    .filter(d => d.ymd >= fromYmd && d.ymd <= toYmd)
    .sort((a, b) => a.ymd.localeCompare(b.ymd));

  const seen = new Set<string>();
  const cleanings: WatchedCleaning[] = [];
  for (const d of departures) {
    if (seen.has(d.ymd)) continue; // overlapping bookings: one cleaning per day
    seen.add(d.ymd);
    const next = arrivals.find(a => a.checkInYmd >= d.ymd);
    cleanings.push({
      key: d.ymd,
      departureAt: d.at,
      departure: d.stay,
      checkInYmd: next?.checkInYmd ?? null,
      arrivalAt: next?.at ?? null,
      arrival: next?.stay ?? null,
      arrivalUnconfirmed: !!next && !next.stay,
    });
  }
  return cleanings;
}

function isTight(c: WatchedCleaning): boolean {
  return !!c.arrivalAt && c.arrivalAt.getTime() - c.departureAt.getTime() <= TIGHT_WINDOW;
}

// ---------------------------------------------------------------------------
// Lock visits
// ---------------------------------------------------------------------------

const UNLOCK_ACTIONS = new Set([1, 3]);
const LOCK_ACTIONS = new Set([2, 4, 5]);

/**
 * The cleaner's visit for this cleaning, from the lock's log: her first unlock (with her own code)
 * between shortly before the departure and the next arrival, and the last lock after it once the
 * door has stayed quiet for a while. The visit stops at the first unlock by anyone else.
 */
export function cleanerVisit(
  c: WatchedCleaning,
  events: LockEvent[],
  cleanerNames: string[],
  now: Date,
): Visit | null {
  if (cleanerNames.length === 0) return null;
  const isCleaner = (e: LockEvent) => cleanerNames.some(n => sameName(n, e.name || ''));
  const from = c.departureAt.getTime() - EARLY_ENTRY;
  const until = Math.min(c.arrivalAt ? c.arrivalAt.getTime() : Infinity, now.getTime());
  const ok = events.filter(e => e.state === 0).sort((a, b) => a.at.getTime() - b.at.getTime());

  const entry = ok.find(e =>
    e.at.getTime() >= from && e.at.getTime() < until && UNLOCK_ACTIONS.has(e.action) && isCleaner(e));
  if (!entry) return null;

  const after = ok.filter(e => e.at.getTime() > entry.at.getTime() && e.at.getTime() <= until);
  const someoneElse = after.findIndex(e => UNLOCK_ACTIONS.has(e.action) && !isCleaner(e));
  const during = someoneElse === -1 ? after : after.slice(0, someoneElse);

  let lastLock = -1;
  during.forEach((e, i) => { if (LOCK_ACTIONS.has(e.action)) lastLock = i; });
  if (lastLock === -1) return { enteredAt: entry.at, leftAt: null };

  const lock = during[lastLock];
  const nothingAfter = lastLock === during.length - 1;
  const settled = nothingAfter && (someoneElse !== -1 || now.getTime() - lock.at.getTime() >= VISIT_QUIET);
  const longEnough = lock.at.getTime() - entry.at.getTime() >= MIN_VISIT;
  return { enteredAt: entry.at, leftAt: settled && longEnough ? lock.at : null };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/**
 * When to check a cleaning. Tight window: before checkout (no lock: "has she confirmed?"), an hour
 * after it (lock: "she hasn't come"), and a last call before the arrival, at 19:00 at the latest.
 * Longer window: 19:00 the evening before the arrival day, and 09:00 that day if the arrival is
 * at least two hours later.
 */
export function scheduledChecks(c: WatchedCleaning, lock: boolean): { check: CheckKind; at: Date }[] {
  if (!c.arrivalAt) return [];
  const D = c.departureAt.getTime();
  const A = c.arrivalAt.getTime();

  if (A - D <= TIGHT_WINDOW) {
    const checks: { check: CheckKind; at: Date }[] = [];
    const lastCall = Math.max(D + HOUR, Math.min(A - HOUR, bucharestAt(c.key, '19:00').getTime()));
    if (lock) {
      if (lastCall - (D + HOUR) >= 30 * MINUTE) checks.push({ check: 'arrival', at: new Date(D + HOUR) });
    } else {
      checks.push({ check: 'ack', at: new Date(Math.max(D - HOUR, bucharestAt(c.key, '07:00').getTime())) });
    }
    checks.push({ check: 'done', at: new Date(lastCall) });
    return checks;
  }

  const arrivalDay = formatBucharestDate(c.arrivalAt);
  const checks: { check: CheckKind; at: Date }[] = [];
  const evening = bucharestAt(addDays(arrivalDay, -1), '19:00');
  if (evening.getTime() >= D + 2 * HOUR) checks.push({ check: 'evening', at: evening });
  const morning = bucharestAt(arrivalDay, '09:00');
  if (morning.getTime() <= A - 2 * HOUR && morning.getTime() >= D + 2 * HOUR) {
    checks.push({ check: 'morning', at: morning });
  }
  return checks;
}

/** The next check still ahead for this cleaning, if any (for "I'll ask again at 09:00"). */
export function nextCheckAt(c: WatchedCleaning, record: CleaningRecord, lock: boolean, now: Date): Date | null {
  if (record.doneAt) return null;
  const ahead = scheduledChecks(c, lock).filter(k =>
    k.at.getTime() > now.getTime() && !((k.check === 'ack' || k.check === 'arrival') && record.ackAt));
  return ahead.length ? ahead[0].at : null;
}

/** "Joi 22.10", "azi, Joi 22.10", "maine, Joi 22.10". */
function when(ymd: string, todayYmd: string): string {
  if (ymd === todayYmd) return `azi, ${dayLabel(ymd)}`;
  if (ymd === addDays(todayYmd, 1)) return `maine, ${dayLabel(ymd)}`;
  return dayLabel(ymd);
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "sosesc 4 persoane pe la 21:00", "soseste 1 persoana la 15:00". */
function whoArrives(c: WatchedCleaning): string {
  if (!c.arrival) return `apare o rezervare noua in calendar (fara detalii inca), check-in de la ${clock(c.arrivalAt!)}`;
  const p = people(c.arrival);
  const verb = p.count === 1 ? 'soseste' : 'sosesc';
  const at = c.arrival.arrivalTime ? `pe la ${arrivesAt(c.arrival)}` : `la ${arrivesAt(c.arrival)}`;
  return `${verb} ${p.text} ${at}`;
}

/** "Joi 22.10 sosesc 4 persoane pe la 21:00", "Maine, Joi 22.10, sosesc ...". */
function arrivalSentence(c: WatchedCleaning, todayYmd: string): string {
  const ymd = c.checkInYmd!;
  const day = ymd === todayYmd || ymd === addDays(todayYmd, 1) ? `${capital(when(ymd, todayYmd))},` : dayLabel(ymd);
  return `${day} ${whoArrives(c)}`;
}

/** Where the apartment stands since the departure. */
function sinceDeparture(c: WatchedCleaning, todayYmd: string, now: Date): string {
  const at = c.departure ? leavesAt(c.departure) : clock(c.departureAt);
  if (c.key === todayYmd) {
    return now.getTime() >= c.departureAt.getTime()
      ? `Oaspetii de dinainte au plecat azi la ${at}`
      : `Oaspetii de acum pleaca azi la ${at}`;
  }
  return `Apartamentul e liber din ${dayLabel(c.key)} (check-out la ${at})`;
}

function checkMessage(c: WatchedCleaning, check: CheckKind, now: Date, s: WatchSettings): OwnerMessage {
  const todayYmd = formatBucharestDate(now);
  const name = s.cleanerName;
  const D = c.departure ? leavesAt(c.departure) : clock(c.departureAt);
  const comeAt = hhmm(minutesOf(D) + 30);
  const arrivalPart = arrivalSentence(c, todayYmd);
  const base = { cleaningKey: c.key, key: check, kind: 'question' as const };

  if (check === 'ack') {
    return {
      ...base,
      answers: 'ack',
      text: `Azi, ${dayLabel(c.key)}: check-out la ${D}, apoi ${whoArrives(c)}. ${name} ar trebui sa vina pe la ${comeAt}. A confirmat ca vine?`,
      cleanerText: `Buna ziua! Azi oaspetii pleaca la ${D}, iar ${whoArrives(c)}. Ajungeti pe la ${comeAt}? Multumesc!`,
    };
  }
  if (check === 'arrival') {
    return {
      ...base,
      answers: 'ack',
      text: `Azi, ${dayLabel(c.key)}: check-out la ${D}, apoi ${whoArrives(c)}. ${name} nu a ajuns inca in apartament. Stii daca vine?`,
      cleanerText: `Buna ziua! Oaspetii au plecat, iar ${whoArrives(c)}. Cand ajungeti? Multumesc!`,
    };
  }
  const notIn = s.lock ? `, iar ${name} nu a fost inca in apartament` : '';
  return {
    ...base,
    answers: 'done',
    text: check === 'done'
      ? `${arrivalPart}${notIn}. E gata curatenia?`
      : `${arrivalPart}. ${sinceDeparture(c, todayYmd, now)}${notIn}. E gata curatenia?`,
    cleanerText: `Buna ziua! Ati reusit sa faceti curatenia? ${arrivalPart}. Multumesc!`,
  };
}

/**
 * What to tell the owner about one cleaning right now. Lock news first (no answer needed), then
 * the latest check that is due, unless the cleaning is already known to be done.
 */
export function planCleaning(
  c: WatchedCleaning,
  record: CleaningRecord,
  visit: Visit | null,
  now: Date,
  s: WatchSettings,
): OwnerMessage[] {
  if (isQuietHour(now)) return [];
  const sent = record.sent ?? {};
  const t = now.getTime();
  const out: OwnerMessage[] = [];
  const todayYmd = formatBucharestDate(now);

  if (s.lock && visit) {
    const entered = visit.enteredAt.getTime();
    const next = c.checkInYmd
      ? ` Urmatorii oaspeti: ${when(c.checkInYmd, todayYmd)}, ${whoArrives(c)}.`
      : ' Nu urmeaza alta rezervare deocamdata.';
    if (visit.leftAt) {
      if (!sent.visit && t - visit.leftAt.getTime() < OPEN_VISIT_REPORT) {
        out.push({
          cleaningKey: c.key, key: 'visit', kind: 'info',
          text: `${s.cleanerName} a fost la apartament ${when(formatBucharestDate(visit.enteredAt), todayYmd)}, ` +
            `intre ${clock(visit.enteredAt)} si ${clock(visit.leftAt)} (${duration(visit.leftAt.getTime() - entered)}).${next}`,
        });
      }
    } else if (isTight(c) && !sent.entered && !sent.visit && t - entered < FRESH_FOR) {
      out.push({
        cleaningKey: c.key, key: 'entered', kind: 'info',
        text: `${s.cleanerName} a ajuns la apartament la ${clock(visit.enteredAt)}.${next}`,
      });
    } else if (!sent.entered && !sent.visit && t - entered >= OPEN_VISIT_REPORT && t - entered < OPEN_VISIT_REPORT + FRESH_FOR) {
      out.push({
        cleaningKey: c.key, key: 'visit', kind: 'info',
        text: `${s.cleanerName} a intrat in apartament ${when(formatBucharestDate(visit.enteredAt), todayYmd)} ` +
          `la ${clock(visit.enteredAt)}. Nu am vazut cand a plecat (usa nu a fost incuiata dupa ea).${next}`,
      });
    }
  }

  if (!c.arrivalAt || t >= c.arrivalAt.getTime()) return out;
  if (record.doneAt || (s.lock && visit)) return out;

  // After downtime several checks can be due at once: only the latest one is worth sending.
  const due = scheduledChecks(c, s.lock).filter(k =>
    t >= k.at.getTime() && t - k.at.getTime() < FRESH_FOR &&
    !((k.check === 'ack' || k.check === 'arrival') && record.ackAt));
  const latest = due[due.length - 1];
  if (latest && !sent[latest.check]) out.push(checkMessage(c, latest.check, now, s));
  return out;
}

// ---------------------------------------------------------------------------
// Last-minute bookings
// ---------------------------------------------------------------------------

/**
 * The first day the cleaner's NEXT weekly message will cover. An arrival before it was never in a
 * weekly message she got, so someone has to tell her. Without a weekly message, a week ahead.
 */
export function nextCoverageStart(now: Date, weekly: WeeklySchedule | null): string {
  const today = formatBucharestDate(now);
  if (!weekly) return addDays(today, 8);
  let send = today;
  for (let i = 0; i < 8; i++) {
    if (weekdayOf(send) === weekly.weekday && bucharestAt(send, weekly.time).getTime() > now.getTime()) break;
    send = addDays(send, 1);
  }
  return nextWeek(send).start;
}

/**
 * New arrivals the cleaner can't know about yet. `known` is the set of check-in dates seen on
 * earlier runs; null on the very first run, which only records what's there. During quiet hours
 * nothing is sent and new dates stay unknown, so they go out at 07:00.
 */
export function planLastMinute(
  cleanings: WatchedCleaning[],
  upcomingCheckIns: string[],
  known: string[] | null,
  records: Record<string, CleaningRecord>,
  visits: Record<string, Visit | null>,
  now: Date,
  weekly: WeeklySchedule | null,
  s: WatchSettings,
): { messages: OwnerMessage[]; known: string[] } {
  const today = formatBucharestDate(now);
  const upcoming = [...new Set(upcomingCheckIns.filter(d => d >= today))].sort();
  if (known === null) return { messages: [], known: upcoming };
  const stillKnown = known.filter(d => d >= today);
  if (isQuietHour(now)) return { messages: [], known: stillKnown };

  const coverage = nextCoverageStart(now, weekly);
  const knownSet = new Set(stillKnown);
  const messages: OwnerMessage[] = [];
  for (const ymd of upcoming) {
    if (knownSet.has(ymd)) continue;
    knownSet.add(ymd);
    if (ymd >= coverage) continue; // the next weekly message will tell her

    const c = cleanings.find(x => x.checkInYmd === ymd);
    const key = `lastminute:${ymd}`;
    if (!c || !c.arrivalAt) {
      messages.push({
        cleaningKey: null, key, kind: 'info',
        text: `Rezervare noua: ${dayLabel(ymd)}. Nu era in programul de duminica, deci ${s.cleanerName} nu stie de ea.`,
      });
      continue;
    }
    if (records[c.key]?.sent?.[key]) continue;
    const urgent = c.arrivalAt.getTime() - now.getTime() <= 48 * HOUR ? 'URGENT: ' : '';
    const arrival = arrivalSentence(c, today);
    const D = c.departure ? leavesAt(c.departure) : clock(c.departureAt);
    const visit = visits[c.key];
    const record = records[c.key] ?? {};

    if (c.departureAt.getTime() > now.getTime()) {
      const sameDay = c.key === c.checkInYmd;
      const departure = sameDay
        ? `In aceeasi zi pleaca oaspetii de acum, la ${D} (plecare si sosire in aceeasi zi)`
        : `Oaspetii de acum pleaca ${when(c.key, today)} la ${D}`;
      messages.push({
        cleaningKey: c.key, key, kind: 'question', answers: 'ack',
        text: `${urgent}Rezervare noua: ${arrival}. ${departure}. Nu era in programul de duminica. Ai vorbit cu ${s.cleanerName}?`,
        cleanerText: `Buna ziua! Avem o rezervare noua: ${arrival}. ${departure}. Puteti face curatenia intre timp? Multumesc!`,
      });
    } else if (record.doneAt || (s.lock && visit)) {
      const how = s.lock && visit
        ? `${s.cleanerName} a fost la apartament ${when(formatBucharestDate(visit.enteredAt), today)} la ${clock(visit.enteredAt)}`
        : 'ai confirmat-o tu';
      messages.push({
        cleaningKey: c.key, key, kind: 'info',
        text: `${urgent}Rezervare noua: ${arrival}. Curatenia e deja facuta: ${how}.`,
      });
    } else {
      messages.push({
        cleaningKey: c.key, key, kind: 'question', answers: 'done',
        text: `${urgent}Rezervare noua: ${arrival}. ${sinceDeparture(c, today, now)}. Nu era in programul de duminica. E gata curatenia?`,
        cleanerText: `Buna ziua! Avem o rezervare noua: ${arrival}. Apartamentul e liber din ${dayLabel(c.key)}. ` +
          `Ati facut deja curatenia, sau o puteti face pana atunci? Multumesc!`,
      });
    }
  }
  return { messages, known: [...knownSet].filter(d => d >= today).sort() };
}

// ---------------------------------------------------------------------------
// Shortcut heartbeat
// ---------------------------------------------------------------------------

/**
 * The cleaner's messages depend on the owner's iPhone running its automations. When an expected
 * run hasn't reached the server 20 minutes after its time, say so (once, and not hours later).
 */
export function planShortcuts(
  expectations: ShortcutExpectation[],
  lastCalls: Record<string, Date | undefined>,
  sent: Record<string, Date | undefined>,
  now: Date,
): OwnerMessage[] {
  if (isQuietHour(now)) return [];
  const today = formatBucharestDate(now);
  const out: OwnerMessage[] = [];
  for (const e of expectations) {
    const dayOfMonth = parseInt(today.slice(8, 10), 10);
    if (!e.weekdays.includes(weekdayOf(today)) && !(e.monthDays ?? []).includes(dayOfMonth)) continue;
    const due = bucharestAt(today, e.time).getTime();
    const t = now.getTime();
    if (t < due + 20 * MINUTE || t > due + 3 * HOUR) continue;
    const key = `shortcut:${e.op}:${today}`;
    if (sent[key]) continue;
    const last = lastCalls[e.op];
    if (last && last.getTime() >= due - 15 * MINUTE) continue;
    out.push({
      cleaningKey: null, key, kind: 'info',
      text: `Scurtatura de pe iPhone pentru ${e.label} nu a rulat azi la ${e.time}, deci mesajul nu a plecat. ` +
        `Deschide aplicatia Shortcuts si ruleaz-o de mana, apoi verifica automatizarea.`,
    });
  }
  return out;
}
