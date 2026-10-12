// src/lib/cleaning-schedule.ts
// The weekly cleaning schedule a property's cleaner gets on Sunday evening.
//
// It covers next Monday to Sunday: which days she cleans, how long each cleaning window is, and
// how many guests to prepare for. A cleaning starts at a checkout and has to be finished by the
// next check-in. When both fall on the same day the window is only the gap between checkout and
// check-in time (4 hours at Coltei, about a fifth of its changeovers), so it gets an attention note.
// Those days, weekend check-ins right after a checkout, and early arrivals also get a reminder.
//
// Times agreed with a guest move the window: a late arrival gives the cleaner the extra time (the
// owner's rule: she cleans for other owners too), an early one pulls the deadline forward.
//
// Pure: the caller passes the stays and the OTA-blocked nights; nothing here reads Firestore.

import { formatBucharestDate, getBucharestHourMinute } from '@/lib/dates/property-times';

export interface CleaningStay {
  checkIn: Date;
  checkOut: Date;
  guests?: number;
  adults?: number;
  children?: number;
  /** HH:MM the guest announced, when it differs from the standard check-in in `checkIn`. */
  arrivalTime?: string | null;
  /** HH:MM agreed for leaving, when it differs from the standard check-out in `checkOut`. */
  departureTime?: string | null;
}

const DAYS = ['Duminica', 'Luni', 'Marti', 'Miercuri', 'Joi', 'Vineri', 'Sambata'];
const MONTHS = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
];

/** YYYY-MM-DD plus n calendar days. Noon UTC keeps DST from shifting the date. */
export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekday(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

/** The Monday-to-Sunday week after `todayYmd`. Run on a Sunday, it starts tomorrow. */
export function nextWeek(todayYmd: string): { start: string; end: string } {
  const start = addDays(todayYmd, ((8 - weekday(todayYmd)) % 7) || 7);
  return { start, end: addDays(start, 6) };
}

function dayLabel(ymd: string): string {
  return `${DAYS[weekday(ymd)]} ${ymd.slice(8, 10)}.${ymd.slice(5, 7)}`;
}

function weekLabel(start: string, end: string): string {
  const day = (ymd: string) => String(parseInt(ymd.slice(8, 10), 10));
  const month = (ymd: string) => MONTHS[parseInt(ymd.slice(5, 7), 10) - 1];
  return month(start) === month(end)
    ? `${day(start)}-${day(end)} ${month(end)}`
    : `${day(start)} ${month(start)} - ${day(end)} ${month(end)}`;
}

function clock(d: Date): string {
  const { hour, minute } = getBucharestHourMinute(d);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** "4 persoane", "3 persoane (1 adult, 2 copii)". Children are often not recorded, so the
 *  total guest count leads and the split only shows when children were entered. */
function people(s: CleaningStay): { text: string; count: number } {
  const children = s.children && s.children > 0 ? s.children : 0;
  const count = s.guests && s.guests > 0 ? s.guests : (s.adults || 0) + children;
  if (!count) return { text: 'oaspeti (numarul de persoane nu este trecut)', count: 0 };
  const total = count === 1 ? '1 persoana' : `${count} persoane`;
  if (!children) return { text: total, count };
  const adults = s.adults && s.adults > 0 ? s.adults : count - children;
  return {
    text: `${total} (${adults} ${adults === 1 ? 'adult' : 'adulti'}, ${children} ${children === 1 ? 'copil' : 'copii'})`,
    count,
  };
}

function arrive(s: CleaningStay): string {
  const p = people(s);
  return `${p.count === 1 ? 'soseste' : 'sosesc'} ${p.text}`;
}

function leave(s: CleaningStay): string {
  return `pleaca ${people(s).text}`;
}

/** When the guests really arrive / leave: the agreed time, else the booking's standard one. */
function arrivesAt(s: CleaningStay): string {
  return s.arrivalTime || clock(s.checkIn);
}
function leavesAt(s: CleaningStay): string {
  return s.departureTime || clock(s.checkOut);
}
function arrivesEarly(s: CleaningStay): boolean {
  return !!s.arrivalTime && s.arrivalTime < clock(s.checkIn);
}
function arrivesLate(s: CleaningStay): boolean {
  return !!s.arrivalTime && s.arrivalTime > clock(s.checkIn);
}

/** "sosesc 4 persoane", plus why the time differs from the usual check-in when it does. */
function arrival(s: CleaningStay): string {
  const one = people(s).count === 1;
  if (arrivesLate(s)) return `${arrive(s)} (${one ? 'a anuntat' : 'au anuntat'} sosirea mai tarziu)`;
  if (arrivesEarly(s)) return `${arrive(s)} (mai devreme decat de obicei)`;
  return arrive(s);
}

function minutesOf(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

/** The body of a same-day changeover note: who leaves, who comes, and the window between. */
function changeoverText(dep: CleaningStay, arr: CleaningStay): string {
  const from = leavesAt(dep);
  const until = arrivesAt(arr);
  const gap = minutesOf(until) - minutesOf(from);
  if (gap <= 0) {
    return `La ${from} ${leave(dep)}, dar oaspetii noi (${people(arr).text}) vor sa ajunga la ${until}, ` +
      `inainte de plecarea celorlalti. Va sun ca sa ne organizam.`;
  }
  // Four hours or less (the standard 11:00 to 15:00) is tight enough to fix the start time.
  const tight = gap <= 240 ? `, deci va rog sa fiti acolo la ${from}` : '';
  return `La ${from} ${leave(dep)}, iar la ${until} ${arrival(arr)}. ` +
    `Curatenia trebuie facuta intre ${from} si ${until}${tight}.`;
}

interface DatedStay {
  stay: CleaningStay;
  in: string;
  out: string;
}

/**
 * Stays as Bucharest calendar dates, sorted by check-in, plus the runs of OTA-blocked nights
 * (YYYY-MM-DD) that no stay covers. Such a run is a reservation not entered yet: it may still
 * need a cleaning, so the messages flag it rather than stay silent. `to` is its checkout date.
 */
function prepare(stays: CleaningStay[], otaBlockedNights: string[]) {
  const dated: DatedStay[] = stays
    .map(stay => ({ stay, in: formatBucharestDate(stay.checkIn), out: formatBucharestDate(stay.checkOut) }))
    .filter(s => s.in < s.out)
    .sort((a, b) => a.in.localeCompare(b.in));

  const covered = new Set<string>();
  for (const s of dated) {
    for (let night = s.in; night < s.out; night = addDays(night, 1)) covered.add(night);
  }
  const unknownRanges: { from: string; to: string }[] = [];
  for (const night of [...new Set(otaBlockedNights)].filter(n => !covered.has(n)).sort()) {
    const last = unknownRanges[unknownRanges.length - 1];
    if (last && last.to === night) last.to = addDays(night, 1);
    else unknownRanges.push({ from: night, to: addDays(night, 1) });
  }
  return { dated, unknownRanges };
}

/**
 * The morning reminder for a day the cleaner must not miss, or null on any other day.
 *
 * Sensitive days: a same-day changeover (any day of the week); a Saturday or Sunday check-in the
 * day after a checkout, when the cleaning can slip into the morning of the arrival; and an early
 * arrival, reminded the day before as well, since a 9:00 arrival leaves no morning to clean in.
 */
export function cleaningReminder(
  stays: CleaningStay[],
  otaBlockedNights: string[],
  todayYmd: string,
): string | null {
  const { dated, unknownRanges } = prepare(stays, otaBlockedNights);
  const today = dayLabel(todayYmd);
  const tomorrowYmd = addDays(todayYmd, 1);
  const departing = dated.find(s => s.out === todayYmd);
  const arriving = dated.find(s => s.in === todayYmd);
  const unconfirmedArrival = !arriving && unknownRanges.some(r => r.from === todayYmd);
  const leftYesterday = dated.find(s => s.out === addDays(todayYmd, -1));
  const weekend = weekday(todayYmd) === 0 || weekday(todayYmd) === 6;
  const earlyTomorrow = dated.find(s => s.in === tomorrowYmd && arrivesEarly(s.stay));

  const notes: string[] = [];
  if (departing && arriving) {
    notes.push(`Azi, ${today}, avem plecare si sosire in aceeasi zi.\n${changeoverText(departing.stay, arriving.stay)}`);
  } else if (departing && unconfirmedArrival) {
    const from = leavesAt(departing.stay);
    notes.push(`Azi, ${today}, la ${from} ${leave(departing.stay)}, iar in calendar apare o rezervare noua ` +
      `din aceeasi zi, neconfirmata inca. Va rog sa faceti curatenia imediat dupa ${from}; va confirm separat.`);
  } else if (arriving && (arrivesEarly(arriving.stay) || (weekend && leftYesterday))) {
    const until = arrivesAt(arriving.stay);
    const lastCleaning = weekend && leftYesterday
      ? `Oaspetii de dinainte au plecat ieri la ${leavesAt(leftYesterday.stay)}. Daca nu s-a apucat curatenia ieri, va rog sa fie gata azi pana la ${until}.`
      : `Va rog ca apartamentul sa fie gata pana la ${until}.`;
    notes.push(`Azi, ${today}, la ${until} ${arrival(arriving.stay)}. ${lastCleaning}`);
  } else if (weekend && leftYesterday && unconfirmedArrival) {
    notes.push(`Azi, ${today}, in calendar apare o rezervare noua, neconfirmata inca, iar oaspetii de dinainte ` +
      `au plecat ieri. Daca nu s-a apucat curatenia ieri, va rog sa fie gata azi; va confirm separat ora sosirii.`);
  }

  const departingTomorrow = dated.find(s => s.out === tomorrowYmd);
  if (earlyTomorrow && departingTomorrow) {
    notes.push(`Maine, ${dayLabel(tomorrowYmd)}, avem plecare si sosire in aceeasi zi, iar oaspetii noi vin mai devreme.\n` +
      changeoverText(departingTomorrow.stay, earlyTomorrow.stay));
  } else if (earlyTomorrow) {
    const until = arrivesAt(earlyTomorrow.stay);
    const cleanToday = departing && !arriving
      ? ` Oaspetii de acum pleaca azi la ${leavesAt(departing.stay)}, deci curatenia trebuie facuta azi sau maine pana la ${until}.`
      : ` Va rog ca apartamentul sa fie gata pana atunci.`;
    notes.push(`Maine, ${dayLabel(tomorrowYmd)}, ${arrive(earlyTomorrow.stay)} mai devreme decat de obicei, la ${until}.${cleanToday}`);
  }

  return notes.length ? `Buna dimineata! Va reamintesc:\n\n${notes.join('\n\n')}\n\nMultumesc!` : null;
}

/**
 * The Sunday message for the week after `todayYmd`, or null when that week needs no cleaning.
 * `otaBlockedNights` (YYYY-MM-DD) are nights an OTA calendar marks as taken.
 */
export function weeklyCleaningMessage(
  stays: CleaningStay[],
  otaBlockedNights: string[],
  todayYmd: string,
): string | null {
  const { start, end } = nextWeek(todayYmd);
  const inWeek = (ymd: string) => ymd >= start && ymd <= end;
  const { dated, unknownRanges } = prepare(stays, otaBlockedNights);
  const unknownThisWeek = unknownRanges.filter(r => r.from <= end && r.to >= start);

  const departures = dated.filter(s => inWeek(s.out));
  if (departures.length === 0 && unknownThisWeek.length === 0) return null;

  const blocks: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const dep = departures.find(s => s.out === day);
    const arr = dated.find(s => s.in === day);
    const label = dayLabel(day);

    if (dep && arr) {
      blocks.push(`${label}: ATENTIE, plecare si sosire in aceeasi zi!\n${changeoverText(dep.stay, arr.stay)}`);
    } else if (dep) {
      const from = leavesAt(dep.stay);
      const next = dated.find(s => s.in > day);
      const nextUnknown = unknownRanges.find(r => r.from >= day);
      let window: string;
      if (nextUnknown && (!next || nextUnknown.from < next.in)) {
        window = `Curatenie dupa ${from}. Din ${dayLabel(nextUnknown.from)} apare ocupat in calendar ` +
          `(rezervare neconfirmata, va confirm separat), deci ar fi bine ca pana atunci curatenia sa fie gata.`;
      } else if (!next) {
        window = `Curatenie oricand dupa ${from}, nu urmeaza alta rezervare deocamdata.`;
      } else if (next.in > addDays(day, 31)) {
        window = `Curatenie oricand dupa ${from}, urmatorii oaspeti sosesc abia ${dayLabel(next.in)}.`;
      } else if (next.in === addDays(day, 1)) {
        window = `Curatenia trebuie terminata pana maine, ${dayLabel(next.in)}, la ${arrivesAt(next.stay)}, cand ${arrival(next.stay)}.`;
      } else {
        window = `Curatenie oricand dupa ${from}, pana ${dayLabel(next.in)} la ${arrivesAt(next.stay)}, cand ${arrival(next.stay)}.`;
      }
      blocks.push(`${label}: la ${from} ${leave(dep.stay)}. ${window}`);
    } else if (arr && arrivesEarly(arr.stay)) {
      blocks.push(`${label}: ATENTIE, ${arrive(arr.stay)} mai devreme decat de obicei, la ${arrivesAt(arr.stay)}. ` +
        `Apartamentul trebuie sa fie gata pana atunci.`);
    } else if (arr && arrivesLate(arr.stay)) {
      blocks.push(`${label}: ${arrive(arr.stay)}, ${people(arr.stay).count === 1 ? 'a anuntat' : 'au anuntat'} sosirea pe la ${arrivesAt(arr.stay)}.`);
    } else if (arr) {
      blocks.push(`${label}: ${arrive(arr.stay)}, check-in de la ${arrivesAt(arr.stay)}.`);
    }
  }

  for (const r of unknownThisWeek) {
    blocks.push(
      `ATENTIE: ${dayLabel(r.from)} - ${dayLabel(r.to)} apare ocupat in calendar, ` +
      `dar nu am inca detaliile rezervarii. Va confirm separat daca e nevoie de curatenie.`
    );
  }

  const cleaningDays = departures.map(s => dayLabel(s.out));
  const summary = cleaningDays.length === 0
    ? ''
    : cleaningDays.length === 1
      ? `O curatenie: ${cleaningDays[0]}.\n\n`
      : `${cleaningDays.length} curatenii: ${cleaningDays.slice(0, -1).join(', ')} si ${cleaningDays[cleaningDays.length - 1]}.\n\n`;

  return `Buna seara! Programul pentru saptamana ${weekLabel(start, end)}:\n\n${summary}${blocks.join('\n\n')}\n\nMultumesc!`;
}
