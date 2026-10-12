// src/lib/cleaning-schedule.ts
// The weekly cleaning schedule a property's cleaner gets on Sunday evening.
//
// It covers next Monday to Sunday: which days she cleans, how long each cleaning window is, and
// how many guests to prepare for. A cleaning starts at a checkout and has to be finished by the
// next check-in. When both fall on the same day the window is only the gap between checkout and
// check-in time (2 hours at Coltei, about a fifth of its changeovers), so it gets an attention note.
// Those days, and weekend check-ins right after a checkout, also get a reminder that morning.
//
// Pure: the caller passes the stays and the OTA-blocked nights; nothing here reads Firestore.

import { formatBucharestDate, getBucharestHourMinute } from '@/lib/dates/property-times';

export interface CleaningStay {
  checkIn: Date;
  checkOut: Date;
  guests?: number;
  adults?: number;
  children?: number;
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
 * Two kinds of day: a same-day changeover (any day of the week), and a Saturday or Sunday
 * check-in the day after a checkout, when the cleaning can slip into the morning of the arrival.
 */
export function cleaningReminder(
  stays: CleaningStay[],
  otaBlockedNights: string[],
  todayYmd: string,
): string | null {
  const { dated, unknownRanges } = prepare(stays, otaBlockedNights);
  const today = dayLabel(todayYmd);
  const departing = dated.find(s => s.out === todayYmd);
  const arriving = dated.find(s => s.in === todayYmd);
  const unconfirmedArrival = !arriving && unknownRanges.some(r => r.from === todayYmd);
  const leftYesterday = dated.find(s => s.out === addDays(todayYmd, -1));
  const weekend = weekday(todayYmd) === 0 || weekday(todayYmd) === 6;

  let body: string | null = null;
  if (departing && arriving) {
    const from = clock(departing.stay.checkOut);
    const until = clock(arriving.stay.checkIn);
    body = `azi, ${today}, avem plecare si sosire in aceeasi zi.\n` +
      `La ${from} ${leave(departing.stay)}, iar la ${until} ${arrive(arriving.stay)}. ` +
      `Curatenia trebuie facuta intre ${from} si ${until}, deci va rog sa fiti acolo la ${from}.`;
  } else if (departing && unconfirmedArrival) {
    const from = clock(departing.stay.checkOut);
    body = `azi, ${today}, la ${from} ${leave(departing.stay)}, iar in calendar apare o rezervare noua ` +
      `din aceeasi zi, neconfirmata inca. Va rog sa faceti curatenia imediat dupa ${from}; va confirm separat.`;
  } else if (weekend && leftYesterday && arriving) {
    const until = clock(arriving.stay.checkIn);
    body = `azi, ${today}, la ${until} ${arrive(arriving.stay)}. ` +
      `Oaspetii de dinainte au plecat ieri la ${clock(leftYesterday.stay.checkOut)}. ` +
      `Daca nu s-a apucat curatenia ieri, va rog sa fie gata azi pana la ${until}.`;
  } else if (weekend && leftYesterday && unconfirmedArrival) {
    body = `azi, ${today}, in calendar apare o rezervare noua, neconfirmata inca, iar oaspetii de dinainte ` +
      `au plecat ieri. Daca nu s-a apucat curatenia ieri, va rog sa fie gata azi; va confirm separat ora sosirii.`;
  }
  return body ? `Buna dimineata! Va reamintesc: ${body}\n\nMultumesc!` : null;
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
      const from = clock(dep.stay.checkOut);
      const until = clock(arr.stay.checkIn);
      blocks.push(
        `${label}: ATENTIE, plecare si sosire in aceeasi zi!\n` +
        `La ${from} ${leave(dep.stay)}, iar la ${until} ${arrive(arr.stay)}. ` +
        `Curatenia trebuie facuta intre ${from} si ${until}, deci va rog sa fiti acolo la ${from}.`
      );
    } else if (dep) {
      const from = clock(dep.stay.checkOut);
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
        window = `Curatenia trebuie terminata pana maine, ${dayLabel(next.in)}, la ${clock(next.stay.checkIn)}, cand ${arrive(next.stay)}.`;
      } else {
        window = `Curatenie oricand dupa ${from}, pana ${dayLabel(next.in)} la ${clock(next.stay.checkIn)}, cand ${arrive(next.stay)}.`;
      }
      blocks.push(`${label}: la ${from} ${leave(dep.stay)}. ${window}`);
    } else if (arr) {
      blocks.push(`${label}: ${arrive(arr.stay)}, check-in de la ${clock(arr.stay.checkIn)}.`);
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
