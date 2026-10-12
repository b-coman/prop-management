import { cleaningReminder, nextWeek, weeklyCleaningMessage, type CleaningStay } from '../cleaning-schedule';

// Stays stored the way the booking form writes them for Coltei: check-in 14:00, check-out 12:00
// Bucharest (UTC+3 until 25 Oct 2026, UTC+2 after).
function stay(checkIn: string, checkOut: string, guests: number, extra: Partial<CleaningStay> = {}): CleaningStay {
  const offset = (ymd: string) => (ymd < '2026-10-25' ? 3 : 2);
  const at = (ymd: string, hour: number) => new Date(`${ymd}T${String(hour - offset(ymd)).padStart(2, '0')}:00:00Z`);
  return { checkIn: at(checkIn, 14), checkOut: at(checkOut, 12), guests, ...extra };
}

// The real Coltei calendar for October and November 2026.
const COLTEI = [
  stay('2026-10-15', '2026-10-18', 4),
  stay('2026-10-22', '2026-10-25', 4),
  stay('2026-10-25', '2026-10-30', 3),
  stay('2026-10-30', '2026-11-01', 3),
  stay('2026-11-20', '2026-11-22', 4),
  stay('2026-11-28', '2026-11-30', 3),
];

describe('nextWeek', () => {
  it('starts tomorrow when run on Sunday', () => {
    expect(nextWeek('2026-10-18')).toEqual({ start: '2026-10-19', end: '2026-10-25' });
  });
  it('starts the following Monday on any other day, including a Monday', () => {
    expect(nextWeek('2026-10-21')).toEqual({ start: '2026-10-26', end: '2026-11-01' });
    expect(nextWeek('2026-10-19')).toEqual({ start: '2026-10-26', end: '2026-11-01' });
  });
});

describe('weeklyCleaningMessage', () => {
  it('warns about a same-day changeover and says when to be there', () => {
    expect(weeklyCleaningMessage(COLTEI, [], '2026-10-18')).toBe(
      'Buna seara! Programul pentru saptamana 19-25 octombrie:\n\n' +
      'O curatenie: Duminica 25.10.\n\n' +
      'Joi 22.10: sosesc 4 persoane, check-in de la 14:00.\n\n' +
      'Duminica 25.10: ATENTIE, plecare si sosire in aceeasi zi!\n' +
      'La 12:00 pleaca 4 persoane, iar la 14:00 sosesc 3 persoane. ' +
      'Curatenia trebuie facuta intre 12:00 si 14:00, deci va rog sa fiti acolo la 12:00.\n\n' +
      'Multumesc!'
    );
  });

  it('lists two cleanings in one week and gives each its window up to the next check-in', () => {
    const msg = weeklyCleaningMessage(COLTEI, [], '2026-10-25')!;
    expect(msg).toContain('saptamana 26 octombrie - 1 noiembrie');
    expect(msg).toContain('2 curatenii: Vineri 30.10 si Duminica 01.11.');
    expect(msg).toContain('Vineri 30.10: ATENTIE, plecare si sosire in aceeasi zi!');
    expect(msg).toContain('Duminica 01.11: la 12:00 pleaca 3 persoane. Curatenie oricand dupa 12:00, pana Vineri 20.11 la 14:00, cand sosesc 4 persoane.');
  });

  it('says "until tomorrow" for a next-day changeover', () => {
    const msg = weeklyCleaningMessage([stay('2026-11-12', '2026-11-16', 3), stay('2026-11-17', '2026-11-19', 4)], [], '2026-11-15')!;
    expect(msg).toContain('Luni 16.11: la 12:00 pleaca 3 persoane. Curatenia trebuie terminata pana maine, Marti 17.11, la 14:00, cand sosesc 4 persoane.');
  });

  it('sends nothing for a week without a checkout, even with an arrival in it', () => {
    expect(weeklyCleaningMessage(COLTEI, [], '2026-11-01')).toBeNull();
    expect(weeklyCleaningMessage([stay('2026-11-19', '2026-11-24', 4)], [], '2026-11-15')).toBeNull();
  });

  it('flags OTA-blocked nights that no booking covers, and ends the previous window there', () => {
    const blocked = ['2026-11-12', '2026-11-13', '2026-11-14'];
    expect(weeklyCleaningMessage(COLTEI, blocked, '2026-11-08')).toContain(
      'ATENTIE: Joi 12.11 - Duminica 15.11 apare ocupat in calendar, dar nu am inca detaliile rezervarii.'
    );
    expect(weeklyCleaningMessage(COLTEI, blocked, '2026-10-25')).toContain(
      'Din Joi 12.11 apare ocupat in calendar (rezervare neconfirmata, va confirm separat)'
    );
  });

  it('ignores OTA-blocked nights that a booking already covers', () => {
    expect(weeklyCleaningMessage(COLTEI, ['2026-11-20', '2026-11-21'], '2026-11-01')).toBeNull();
  });

  it('shows children only when they were recorded, and copes with a missing guest count', () => {
    const msg = weeklyCleaningMessage([
      stay('2026-11-10', '2026-11-12', 5, { adults: 2, children: 3 }),
      stay('2026-11-13', '2026-11-15', 0),
    ], [], '2026-11-08')!;
    expect(msg).toContain('pleaca 5 persoane (2 adulti, 3 copii)');
    expect(msg).toContain('sosesc oaspeti (numarul de persoane nu este trecut)');
  });

  it('does not stretch a window to a reservation months away', () => {
    const msg = weeklyCleaningMessage([stay('2026-12-26', '2026-12-30', 3), stay('2027-04-18', '2027-04-25', 5)], [], '2026-12-27')!;
    expect(msg).toContain('urmatorii oaspeti sosesc abia Duminica 18.04.');
  });

  it('uses each booking\'s own times', () => {
    const late = { ...stay('2026-11-28', '2026-11-30', 3), checkOut: new Date('2026-11-30T09:00:00Z') }; // 11:00
    expect(weeklyCleaningMessage([late], [], '2026-11-29')).toContain('Luni 30.11: la 11:00 pleaca 3 persoane.');
  });
});

describe('cleaningReminder', () => {
  it('reminds on the morning of a same-day changeover, any day of the week', () => {
    expect(cleaningReminder(COLTEI, [], '2026-10-25')).toBe(
      'Buna dimineata! Va reamintesc: azi, Duminica 25.10, avem plecare si sosire in aceeasi zi.\n' +
      'La 12:00 pleaca 4 persoane, iar la 14:00 sosesc 3 persoane. ' +
      'Curatenia trebuie facuta intre 12:00 si 14:00, deci va rog sa fiti acolo la 12:00.\n\n' +
      'Multumesc!'
    );
    expect(cleaningReminder(COLTEI, [], '2026-10-30')).toContain('azi, Vineri 30.10, avem plecare si sosire in aceeasi zi');
  });

  it('reminds on a Saturday or Sunday check-in the day after a checkout', () => {
    const friToSat = [stay('2026-11-04', '2026-11-06', 3), stay('2026-11-07', '2026-11-09', 4)];
    expect(cleaningReminder(friToSat, [], '2026-11-07')).toBe(
      'Buna dimineata! Va reamintesc: azi, Sambata 07.11, la 14:00 sosesc 4 persoane. ' +
      'Oaspetii de dinainte au plecat ieri la 12:00. Daca nu s-a apucat curatenia ieri, va rog sa fie gata azi pana la 14:00.\n\n' +
      'Multumesc!'
    );
    const satToSun = [stay('2026-11-05', '2026-11-07', 3), stay('2026-11-08', '2026-11-10', 2)];
    expect(cleaningReminder(satToSun, [], '2026-11-08')).toContain('azi, Duminica 08.11, la 14:00 sosesc 2 persoane.');
  });

  it('stays quiet on a weekday next-day check-in, a plain checkout, a plain arrival, and quiet days', () => {
    const wedToThu = [stay('2026-11-09', '2026-11-11', 3), stay('2026-11-12', '2026-11-14', 4)];
    expect(cleaningReminder(wedToThu, [], '2026-11-12')).toBeNull();
    expect(cleaningReminder(COLTEI, [], '2026-11-01')).toBeNull(); // checkout, next guests weeks later
    expect(cleaningReminder(COLTEI, [], '2026-10-22')).toBeNull(); // arrival, last checkout 4 days before
    expect(cleaningReminder(COLTEI, [], '2026-10-27')).toBeNull();
  });

  it('reminds when a checkout meets a reservation that is only in the OTA calendar', () => {
    const msg = cleaningReminder([stay('2026-11-09', '2026-11-12', 3)], ['2026-11-12', '2026-11-13'], '2026-11-12');
    expect(msg).toContain('la 12:00 pleaca 3 persoane, iar in calendar apare o rezervare noua din aceeasi zi, neconfirmata inca.');
  });
});
