import { cleaningReminder, nextWeek, weeklyCleaningMessage, type CleaningStay } from '../cleaning-schedule';

// Stays stored the way the booking form writes them for Coltei: check-in 15:00, check-out 11:00
// Bucharest (UTC+3 until 25 Oct 2026, UTC+2 after).
function stay(checkIn: string, checkOut: string, guests: number, extra: Partial<CleaningStay> = {}): CleaningStay {
  const offset = (ymd: string) => (ymd < '2026-10-25' ? 3 : 2);
  const at = (ymd: string, hour: number) => new Date(`${ymd}T${String(hour - offset(ymd)).padStart(2, '0')}:00:00Z`);
  return { checkIn: at(checkIn, 15), checkOut: at(checkOut, 11), guests, ...extra };
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
  it('warns about a same-day changeover, asks her to come half an hour after check-out, and carries last week\'s pending cleaning', () => {
    expect(weeklyCleaningMessage(COLTEI, [], '2026-10-18')).toBe(
      'Buna seara! Programul pentru saptamana 19-25 octombrie:\n\n' +
      '2 curatenii: pana Joi 22.10 (daca nu e deja facuta) si Duminica 25.10.\n\n' +
      'Joi 22.10: sosesc 4 persoane, check-in la 15:00. Apartamentul e liber din Duminica 18.10 (check-out la 11:00), ' +
      'deci curatenia trebuie facuta pana Joi 22.10 la 15:00, daca nu ati facut-o deja.\n\n' +
      'Duminica 25.10: ATENTIE, plecare si sosire in aceeasi zi!\n' +
      'Check-out la 11:00: pleaca 4 persoane. Check-in la 15:00: sosesc 3 persoane.\n' +
      'Curatenia se face dupa plecarea oaspetilor si trebuie terminata pana la 15:00. Va rog sa veniti pe la 11:30.\n\n' +
      'Multumesc!'
    );
  });

  it('lists two cleanings in one week and gives each its window up to the next check-in', () => {
    const msg = weeklyCleaningMessage(COLTEI, [], '2026-10-25')!;
    expect(msg).toContain('saptamana 26 octombrie - 1 noiembrie');
    expect(msg).toContain('2 curatenii: Vineri 30.10 si Duminica 01.11.');
    expect(msg).toContain('Vineri 30.10: ATENTIE, plecare si sosire in aceeasi zi!');
    expect(msg).toContain('Duminica 01.11: check-out la 11:00, pleaca 3 persoane. Curatenie oricand dupa 11:00, pana Vineri 20.11 la 15:00, cand sosesc 4 persoane.');
  });

  it('says "until tomorrow" for a next-day changeover', () => {
    const msg = weeklyCleaningMessage([stay('2026-11-12', '2026-11-16', 3), stay('2026-11-17', '2026-11-19', 4)], [], '2026-11-15')!;
    expect(msg).toContain('Luni 16.11: check-out la 11:00, pleaca 3 persoane. Curatenia trebuie terminata pana maine, Marti 17.11, la 15:00, cand sosesc 4 persoane.');
  });

  it('sends nothing for a week with no checkout and no arrival to prepare for', () => {
    expect(weeklyCleaningMessage(COLTEI, [], '2026-11-01')).toBeNull();
    expect(weeklyCleaningMessage([stay('2026-11-12', '2026-11-30', 4)], [], '2026-11-15')).toBeNull(); // mid-stay all week
  });

  it('lists an arrival whose cleaning window opened last week, even with no checkout this week', () => {
    expect(weeklyCleaningMessage([stay('2026-11-10', '2026-11-13', 3), stay('2026-11-19', '2026-11-24', 4)], [], '2026-11-15')).toBe(
      'Buna seara! Programul pentru saptamana 16-22 noiembrie:\n\n' +
      'O curatenie: pana Joi 19.11 (daca nu e deja facuta).\n\n' +
      'Joi 19.11: sosesc 4 persoane, check-in la 15:00. Apartamentul e liber din Vineri 13.11 (check-out la 11:00), ' +
      'deci curatenia trebuie facuta pana Joi 19.11 la 15:00, daca nu ati facut-o deja.\n\n' +
      'Multumesc!'
    );
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
    expect(weeklyCleaningMessage(COLTEI, ['2026-11-20', '2026-11-21'], '2026-11-15')).not.toContain('apare ocupat');
  });

  it('shows children only when they were recorded, and copes with a missing guest count', () => {
    const msg = weeklyCleaningMessage([
      stay('2026-11-10', '2026-11-12', 5, { adults: 2, children: 3 }),
      stay('2026-11-13', '2026-11-15', 0),
    ], [], '2026-11-08')!;
    expect(msg).toContain('pleaca 5 persoane (2 adulti, 3 copii)');
    expect(msg).toContain('sosesc oaspeti (numarul de persoane nu este trecut), check-in la 15:00');
  });

  it('does not stretch a window to a reservation months away', () => {
    const msg = weeklyCleaningMessage([stay('2026-12-26', '2026-12-30', 3), stay('2027-04-18', '2027-04-25', 5)], [], '2026-12-27')!;
    expect(msg).toContain('urmatorii oaspeti sosesc abia Duminica 18.04.');
  });
});

describe('agreed arrival and departure times', () => {
  it('gives the cleaner the extra time of a late arrival on a changeover day', () => {
    const stays = [stay('2026-10-22', '2026-10-25', 4), stay('2026-10-25', '2026-10-30', 3, { arrivalTime: '19:00' })];
    expect(weeklyCleaningMessage(stays, [], '2026-10-18')).toContain(
      'Check-out la 11:00: pleaca 4 persoane. Sosire anuntata pe la 19:00: sosesc 3 persoane.\n' +
      'Curatenia se face dupa plecarea oaspetilor si trebuie terminata pana la 19:00.\n\n'
    );
  });

  it('extends a normal window to the announced arrival and says so', () => {
    const msg = weeklyCleaningMessage([stay('2026-11-12', '2026-11-16', 3), stay('2026-11-17', '2026-11-19', 4, { arrivalTime: '20:30' })], [], '2026-11-15')!;
    expect(msg).toContain('pana maine, Marti 17.11, la 20:30, cand sosesc 4 persoane (au anuntat sosirea mai tarziu).');
    expect(msg).toContain('Marti 17.11: sosesc 4 persoane, sosire anuntata pe la 20:30.');
  });

  it('pulls the deadline forward for an early arrival and flags it', () => {
    const msg = weeklyCleaningMessage([stay('2026-11-12', '2026-11-16', 3), stay('2026-11-18', '2026-11-20', 2, { arrivalTime: '10:00' })], [], '2026-11-15')!;
    expect(msg).toContain('pana Miercuri 18.11 la 10:00, cand sosesc 2 persoane (mai devreme decat de obicei).');
    expect(msg).toContain('Miercuri 18.11: ATENTIE, sosesc 2 persoane mai devreme decat de obicei, la 10:00. Apartamentul trebuie sa fie gata pana atunci.');
  });

  it('shortens a changeover window for a late departure', () => {
    const stays = [stay('2026-10-22', '2026-10-25', 4, { departureTime: '13:00' }), stay('2026-10-25', '2026-10-30', 3)];
    expect(weeklyCleaningMessage(stays, [], '2026-10-18')).toContain(
      'Check-out la 13:00: pleaca 4 persoane. Check-in la 15:00: sosesc 3 persoane.\n' +
      'Curatenia se face dupa plecarea oaspetilor si trebuie terminata pana la 15:00. Va rog sa veniti pe la 13:30.'
    );
  });

  it('hands a clash (new guests before the old ones leave) back to the owner', () => {
    const stays = [stay('2026-10-22', '2026-10-25', 4), stay('2026-10-25', '2026-10-30', 3, { arrivalTime: '10:00' })];
    expect(weeklyCleaningMessage(stays, [], '2026-10-18')).toContain(
      'Check-out la 11:00: pleaca 4 persoane. Dar oaspetii noi (3 persoane) vor sa ajunga la 10:00, inainte de check-out. Va sun ca sa ne organizam.'
    );
  });
});

describe('cleaningReminder', () => {
  it('reminds on the morning of a same-day changeover, any day of the week', () => {
    expect(cleaningReminder(COLTEI, [], '2026-10-25')).toBe(
      'Buna dimineata! Va reamintesc:\n\n' +
      'Azi, Duminica 25.10, avem plecare si sosire in aceeasi zi.\n' +
      'Check-out la 11:00: pleaca 4 persoane. Check-in la 15:00: sosesc 3 persoane.\n' +
      'Curatenia se face dupa plecarea oaspetilor si trebuie terminata pana la 15:00. Va rog sa veniti pe la 11:30.\n\n' +
      'Multumesc!'
    );
    expect(cleaningReminder(COLTEI, [], '2026-10-30')).toContain('Azi, Vineri 30.10, avem plecare si sosire in aceeasi zi');
  });

  it('reminds on a Saturday or Sunday check-in the day after a checkout', () => {
    const friToSat = [stay('2026-11-04', '2026-11-06', 3), stay('2026-11-07', '2026-11-09', 4)];
    expect(cleaningReminder(friToSat, [], '2026-11-07')).toBe(
      'Buna dimineata! Va reamintesc:\n\n' +
      'Azi, Sambata 07.11, sosesc 4 persoane, check-in la 15:00. ' +
      'Oaspetii de dinainte au avut check-out ieri la 11:00. Daca nu s-a apucat curatenia ieri, va rog sa fie gata azi pana la 15:00.\n\n' +
      'Multumesc!'
    );
    const satToSun = [stay('2026-11-05', '2026-11-07', 3), stay('2026-11-08', '2026-11-10', 2, { arrivalTime: '18:00' })];
    expect(cleaningReminder(satToSun, [], '2026-11-08')).toContain(
      'Azi, Duminica 08.11, sosesc 2 persoane, sosire anuntata pe la 18:00. Oaspetii de dinainte au avut check-out ieri la 11:00.'
    );
  });

  it('reminds the day before and the morning of an early arrival', () => {
    const stays = [stay('2026-11-09', '2026-11-11', 3), stay('2026-11-12', '2026-11-14', 4, { arrivalTime: '09:00' })];
    expect(cleaningReminder(stays, [], '2026-11-11')).toBe(
      'Buna dimineata! Va reamintesc:\n\n' +
      'Maine, Joi 12.11, sosesc 4 persoane mai devreme decat de obicei, la 09:00. ' +
      'Azi e check-out la 11:00, deci curatenia trebuie facuta azi dupa plecarea oaspetilor sau maine pana la 09:00.\n\n' +
      'Multumesc!'
    );
    expect(cleaningReminder(stays, [], '2026-11-12')).toContain(
      'Azi, Joi 12.11, sosesc 4 persoane mai devreme decat de obicei, la 09:00. Va rog ca apartamentul sa fie gata pana la 09:00.'
    );
  });

  it('warns the day before when an early arrival lands on a changeover day', () => {
    const stays = [stay('2026-11-09', '2026-11-12', 3), stay('2026-11-12', '2026-11-14', 4, { arrivalTime: '13:00' })];
    expect(cleaningReminder(stays, [], '2026-11-11')).toContain(
      'Maine, Joi 12.11, avem plecare si sosire in aceeasi zi, iar oaspetii noi vin mai devreme.\n' +
      'Check-out la 11:00: pleaca 3 persoane. Sosire mai devreme decat de obicei, la 13:00: sosesc 4 persoane.\n' +
      'Curatenia se face dupa plecarea oaspetilor si trebuie terminata pana la 13:00. Va rog sa veniti pe la 11:30.'
    );
  });

  it('stays quiet on a weekday next-day check-in, a plain checkout, a plain arrival, and quiet days', () => {
    const wedToThu = [stay('2026-11-09', '2026-11-11', 3), stay('2026-11-12', '2026-11-14', 4)];
    expect(cleaningReminder(wedToThu, [], '2026-11-12')).toBeNull();
    expect(cleaningReminder(wedToThu, [], '2026-11-11')).toBeNull();
    expect(cleaningReminder(COLTEI, [], '2026-11-01')).toBeNull();
    expect(cleaningReminder(COLTEI, [], '2026-10-22')).toBeNull();
    expect(cleaningReminder(COLTEI, [], '2026-10-27')).toBeNull();
  });

  it('reminds when a checkout meets a reservation that is only in the OTA calendar', () => {
    const msg = cleaningReminder([stay('2026-11-09', '2026-11-12', 3)], ['2026-11-12', '2026-11-13'], '2026-11-12');
    expect(msg).toContain('check-out la 11:00: pleaca 3 persoane. In calendar apare si o rezervare noua din aceeasi zi, neconfirmata inca.');
  });
});

describe('edge cases', () => {
  it('reads an arrival before 06:00 as after midnight: more time, not an early arrival', () => {
    const stays = [stay('2026-10-22', '2026-10-25', 4), stay('2026-10-25', '2026-10-30', 3, { arrivalTime: '01:30' })];
    expect(weeklyCleaningMessage(stays, [], '2026-10-18')).toContain(
      'Check-out la 11:00: pleaca 4 persoane. Sosire anuntata pe la 01:30 noaptea: sosesc 3 persoane.\n' +
      'Curatenia se face dupa plecarea oaspetilor si trebuie terminata pana la 01:30 noaptea.\n\n'
    );
    expect(cleaningReminder(stays, [], '2026-10-24')).toBeNull(); // no "early arrival tomorrow" alarm
  });

  it('treats an arrival typed as the standard time like an empty field', () => {
    const msg = weeklyCleaningMessage([stay('2026-11-12', '2026-11-16', 3), stay('2026-11-17', '2026-11-19', 4, { arrivalTime: '15:00' })], [], '2026-11-15')!;
    expect(msg).toContain('Marti 17.11: sosesc 4 persoane, check-in la 15:00.');
  });

  it('flags a checkout on the day an unconfirmed OTA reservation starts', () => {
    const msg = weeklyCleaningMessage([stay('2026-11-09', '2026-11-12', 3)], ['2026-11-12', '2026-11-13'], '2026-11-08')!;
    expect(msg).toContain('Joi 12.11: check-out la 11:00, pleaca 3 persoane. ATENTIE: tot azi apare o rezervare noua in calendar, neconfirmata inca.');
  });

  it('carries a Sunday checkout into a Monday arrival across the week boundary', () => {
    const msg = weeklyCleaningMessage([stay('2026-11-13', '2026-11-15', 3), stay('2026-11-16', '2026-11-18', 2)], [], '2026-11-08')!;
    expect(msg).toContain('Duminica 15.11: check-out la 11:00, pleaca 3 persoane. Curatenia trebuie terminata pana maine, Luni 16.11, la 15:00, cand sosesc 2 persoane.');
  });

  it('labels a week that crosses the new year', () => {
    expect(weeklyCleaningMessage([stay('2026-12-29', '2026-12-31', 3)], [], '2026-12-27')).toContain('saptamana 28 decembrie - 3 ianuarie');
  });

  it('puts both notes in one reminder when a changeover today precedes an early changeover tomorrow', () => {
    const stays = [
      stay('2026-11-09', '2026-11-11', 3),
      stay('2026-11-11', '2026-11-12', 2), // one night
      stay('2026-11-12', '2026-11-14', 4, { arrivalTime: '13:00' }),
    ];
    expect(cleaningReminder(stays, [], '2026-11-11')).toBe(
      'Buna dimineata! Va reamintesc:\n\n' +
      'Azi, Miercuri 11.11, avem plecare si sosire in aceeasi zi.\n' +
      'Check-out la 11:00: pleaca 3 persoane. Check-in la 15:00: sosesc 2 persoane.\n' +
      'Curatenia se face dupa plecarea oaspetilor si trebuie terminata pana la 15:00. Va rog sa veniti pe la 11:30.\n\n' +
      'Maine, Joi 12.11, avem plecare si sosire in aceeasi zi, iar oaspetii noi vin mai devreme.\n' +
      'Check-out la 11:00: pleaca 2 persoane. Sosire mai devreme decat de obicei, la 13:00: sosesc 4 persoane.\n' +
      'Curatenia se face dupa plecarea oaspetilor si trebuie terminata pana la 13:00. Va rog sa veniti pe la 11:30.\n\n' +
      'Multumesc!'
    );
  });

  it('appends the calendar link to the weekly message when given', () => {
    const msg = weeklyCleaningMessage(COLTEI, [], '2026-10-18', 'https://prahova-chalet.ro/calendar/abc')!;
    expect(msg.endsWith('Aveti aici calendarul complet: https://prahova-chalet.ro/calendar/abc\n\nMultumesc!')).toBe(true);
    expect(weeklyCleaningMessage(COLTEI, [], '2026-10-18')).not.toContain('calendarul');
  });
});
