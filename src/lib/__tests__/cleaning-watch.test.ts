import {
  buildCleanings, cleanerVisit, nextCheckAt, nextCoverageStart, planCleaning, planLastMinute, planShortcuts,
  scheduledChecks, type LockEvent, type WatchedCleaning, type WatchSettings,
} from '../cleaning-watch';
import type { CleaningStay } from '../cleaning-schedule';
import { bucharestAt } from '../dates/property-times';

const at = bucharestAt;
const STD = { checkIn: '15:00', checkOut: '11:00' };

// Stays stored the way the booking form writes them for Coltei: check-in 15:00, check-out 11:00.
function stay(checkIn: string, checkOut: string, guests: number, extra: Partial<CleaningStay> = {}): CleaningStay {
  return { checkIn: at(checkIn, '15:00'), checkOut: at(checkOut, '11:00'), guests, ...extra };
}

// The real Coltei calendar for October and November 2026, with the 21:00 arrival on 22 Oct.
const COLTEI = [
  stay('2026-10-15', '2026-10-18', 4),
  stay('2026-10-22', '2026-10-25', 4, { arrivalTime: '21:00' }),
  stay('2026-10-25', '2026-10-30', 3),
  stay('2026-10-30', '2026-11-01', 3),
  stay('2026-11-20', '2026-11-22', 4),
];

const cleanings = buildCleanings(COLTEI, [], STD, '2026-10-01', '2026-11-30');
const byKey = (key: string, list: WatchedCleaning[] = cleanings) => list.find(c => c.key === key)!;

const NO_LOCK: WatchSettings = { label: 'Coltei', cleanerName: 'Mihaela', lock: false };
const LOCK: WatchSettings = { ...NO_LOCK, lock: true };

function ev(ymd: string, time: string, action: number, name: string, state = 0): LockEvent {
  return { at: at(ymd, time), action, name, state };
}

describe('buildCleanings', () => {
  it('pairs each departure with the next arrival, using the agreed arrival time', () => {
    expect(cleanings.map(c => [c.key, c.checkInYmd])).toEqual([
      ['2026-10-18', '2026-10-22'],
      ['2026-10-25', '2026-10-25'],
      ['2026-10-30', '2026-10-30'],
      ['2026-11-01', '2026-11-20'],
      ['2026-11-22', null],
    ]);
    expect(byKey('2026-10-18').arrivalAt).toEqual(at('2026-10-22', '21:00'));
  });

  it('puts an after-midnight arrival on the next day', () => {
    const list = buildCleanings([stay('2026-11-10', '2026-11-12', 2), stay('2026-11-14', '2026-11-16', 2, { arrivalTime: '01:30' })], [], STD, '2026-11-01', '2026-11-30');
    expect(list[0].arrivalAt).toEqual(at('2026-11-15', '01:30'));
    expect(list[0].checkInYmd).toBe('2026-11-14');
  });

  it('treats OTA-blocked nights with no booking as an unconfirmed arrival at the standard time', () => {
    const list = buildCleanings([stay('2026-11-10', '2026-11-12', 2)], ['2026-11-14', '2026-11-15'], STD, '2026-11-01', '2026-11-30');
    expect(list[0]).toMatchObject({ key: '2026-11-12', checkInYmd: '2026-11-14', arrivalUnconfirmed: true, arrival: null });
    expect(list[0].arrivalAt).toEqual(at('2026-11-14', '15:00'));
    expect(list[1]).toMatchObject({ key: '2026-11-16', departure: null });
  });
});

describe('scheduledChecks', () => {
  const times = (c: WatchedCleaning, lock: boolean) => scheduledChecks(c, lock).map(k => [k.check, k.at.toISOString()]);

  it('same-day changeover without a lock: ask at 10:00 if she confirmed, last call at 14:00', () => {
    expect(times(byKey('2026-10-25'), false)).toEqual([
      ['ack', at('2026-10-25', '10:00').toISOString()],
      ['done', at('2026-10-25', '14:00').toISOString()],
    ]);
  });

  it('same-day changeover with a lock: check she came by 12:00, last call at 14:00', () => {
    expect(times(byKey('2026-10-25'), true)).toEqual([
      ['arrival', at('2026-10-25', '12:00').toISOString()],
      ['done', at('2026-10-25', '14:00').toISOString()],
    ]);
  });

  it('a long window: the evening before the arrival day and that morning', () => {
    expect(times(byKey('2026-10-18'), false)).toEqual([
      ['evening', at('2026-10-21', '19:00').toISOString()],
      ['morning', at('2026-10-22', '09:00').toISOString()],
    ]);
  });

  it('a next-day changeover: 19:00 on the checkout day', () => {
    const list = buildCleanings([stay('2026-11-12', '2026-11-16', 3), stay('2026-11-17', '2026-11-19', 4)], [], STD, '2026-11-01', '2026-11-30');
    expect(times(list[0], false)[0]).toEqual(['evening', at('2026-11-16', '19:00').toISOString()]);
  });

  it('an early arrival gets no morning check, only the evening before', () => {
    const list = buildCleanings([stay('2026-11-12', '2026-11-16', 3), stay('2026-11-17', '2026-11-19', 4, { arrivalTime: '09:00' })], [], STD, '2026-11-01', '2026-11-30');
    expect(times(list[0], false)).toEqual([['evening', at('2026-11-16', '19:00').toISOString()]]);
  });

  it('a same-day changeover with a late arrival: last call at 19:00, not 20:00', () => {
    const list = buildCleanings([stay('2026-11-12', '2026-11-16', 3), stay('2026-11-16', '2026-11-19', 4, { arrivalTime: '21:00' })], [], STD, '2026-11-01', '2026-11-30');
    expect(times(list[0], false)[1]).toEqual(['done', at('2026-11-16', '19:00').toISOString()]);
  });

  it('nothing to check when no arrival follows', () => {
    expect(scheduledChecks(byKey('2026-11-22'), false)).toEqual([]);
  });
});

describe('planCleaning', () => {
  it('asks the owner on the evening before, with a message for the cleaner ready', () => {
    const [msg] = planCleaning(byKey('2026-10-18'), {}, null, at('2026-10-21', '19:05'), NO_LOCK);
    expect(msg).toEqual({
      cleaningKey: '2026-10-18', key: 'evening', kind: 'question', answers: 'done',
      text: 'Maine, Joi 22.10, sosesc 4 persoane pe la 21:00. Apartamentul e liber din Duminica 18.10 (check-out la 11:00). E gata curatenia?',
      cleanerText: 'Buna ziua! Ati reusit sa faceti curatenia? Maine, Joi 22.10, sosesc 4 persoane pe la 21:00. Multumesc!',
    });
  });

  it('says the cleaner has not been in when the lock shows no visit', () => {
    const [msg] = planCleaning(byKey('2026-10-18'), {}, null, at('2026-10-22', '09:10'), LOCK);
    expect(msg.text).toBe('Azi, Joi 22.10, sosesc 4 persoane pe la 21:00. Apartamentul e liber din Duminica 18.10 (check-out la 11:00), iar Mihaela nu a fost inca in apartament. E gata curatenia?');
    expect(msg.key).toBe('morning');
  });

  it('same-day changeover: asks at 10:00 whether she confirmed, with the time she should come', () => {
    const [msg] = planCleaning(byKey('2026-10-25'), {}, null, at('2026-10-25', '10:02'), NO_LOCK);
    expect(msg.text).toBe('Azi, Duminica 25.10: check-out la 11:00, apoi sosesc 3 persoane la 15:00. Mihaela ar trebui sa vina pe la 11:30. A confirmat ca vine?');
    expect(msg.answers).toBe('ack');
    expect(msg.cleanerText).toBe('Buna ziua! Azi oaspetii pleaca la 11:00, iar sosesc 3 persoane la 15:00. Ajungeti pe la 11:30? Multumesc!');
  });

  it('same-day changeover with a lock: tells the owner at 12:00 she has not arrived', () => {
    const [msg] = planCleaning(byKey('2026-10-25'), {}, null, at('2026-10-25', '12:01'), LOCK);
    expect(msg.text).toBe('Azi, Duminica 25.10: check-out la 11:00, apoi sosesc 3 persoane la 15:00. Mihaela nu a ajuns inca in apartament. Stii daca vine?');
  });

  it('an owner "Da, she is coming" skips the arrival check but not the last call', () => {
    const record = { ackAt: at('2026-10-25', '10:05') };
    expect(planCleaning(byKey('2026-10-25'), record, null, at('2026-10-25', '10:20'), NO_LOCK)).toEqual([]);
    const [last] = planCleaning(byKey('2026-10-25'), record, null, at('2026-10-25', '14:00'), NO_LOCK);
    expect(last.text).toBe('Azi, Duminica 25.10, sosesc 3 persoane la 15:00. E gata curatenia?');
  });

  it('sends nothing before a check, once it is sent, when done, after the arrival, or when stale', () => {
    const c = byKey('2026-10-18');
    expect(planCleaning(c, {}, null, at('2026-10-21', '18:55'), NO_LOCK)).toEqual([]);
    expect(planCleaning(c, { sent: { evening: at('2026-10-21', '19:00') } }, null, at('2026-10-21', '19:15'), NO_LOCK)).toEqual([]);
    expect(planCleaning(c, { doneAt: at('2026-10-20', '14:00') }, null, at('2026-10-21', '19:05'), NO_LOCK)).toEqual([]);
    expect(planCleaning(c, {}, null, at('2026-10-21', '21:30'), NO_LOCK)).toEqual([]); // 2.5h late
    expect(planCleaning(byKey('2026-10-25'), {}, null, at('2026-10-25', '15:30'), NO_LOCK)).toEqual([]);
  });

  it('after downtime only the latest due check goes out', () => {
    const msgs = planCleaning(byKey('2026-10-25'), {}, null, at('2026-10-25', '14:10'), LOCK);
    expect(msgs.map(m => m.key)).toEqual(['done']);
  });

  it('stays quiet at night', () => {
    const late = buildCleanings([stay('2026-11-12', '2026-11-16', 3, { departureTime: '21:00' }), stay('2026-11-16', '2026-11-19', 4, { arrivalTime: '23:30' })], [], STD, '2026-11-01', '2026-11-30');
    expect(planCleaning(late[0], {}, null, at('2026-11-16', '22:10'), NO_LOCK)).toEqual([]);
  });

  it('with a lock visit: no question, and a note when she leaves', () => {
    const visit = { enteredAt: at('2026-10-20', '11:42'), leftAt: at('2026-10-20', '13:55') };
    expect(planCleaning(byKey('2026-10-18'), {}, visit, at('2026-10-21', '19:05'), LOCK)).toEqual([]); // already reported
    const [msg] = planCleaning(byKey('2026-10-18'), {}, visit, at('2026-10-20', '14:45'), LOCK);
    expect(msg).toEqual({
      cleaningKey: '2026-10-18', key: 'visit', kind: 'info',
      text: 'Mihaela a fost la apartament azi, Marti 20.10, intre 11:42 si 13:55 (2 ore 13 min). Urmatorii oaspeti: Joi 22.10, sosesc 4 persoane pe la 21:00.',
    });
  });

  it('on a same-day changeover, tells the owner as soon as she arrives', () => {
    const visit = { enteredAt: at('2026-10-25', '11:42'), leftAt: null };
    const [msg] = planCleaning(byKey('2026-10-25'), {}, visit, at('2026-10-25', '11:50'), LOCK);
    expect(msg.text).toBe('Mihaela a ajuns la apartament la 11:42. Urmatorii oaspeti: azi, Duminica 25.10, sosesc 3 persoane la 15:00.');
    expect(planCleaning(byKey('2026-10-25'), { sent: { entered: at('2026-10-25', '11:50') } }, visit, at('2026-10-25', '14:00'), LOCK)).toEqual([]);
  });

  it('reports a visit with no end seen after six hours', () => {
    const visit = { enteredAt: at('2026-10-20', '10:00'), leftAt: null };
    const [msg] = planCleaning(byKey('2026-10-18'), {}, visit, at('2026-10-20', '16:05'), LOCK);
    expect(msg.text).toContain('Mihaela a intrat in apartament azi, Marti 20.10 la 10:00. Nu am vazut cand a plecat');
  });
});

describe('nextCheckAt', () => {
  it('names the next check for the "I will ask again" reply', () => {
    expect(nextCheckAt(byKey('2026-10-18'), {}, false, at('2026-10-21', '19:10'))).toEqual(at('2026-10-22', '09:00'));
    expect(nextCheckAt(byKey('2026-10-18'), {}, false, at('2026-10-22', '09:10'))).toBeNull();
    expect(nextCheckAt(byKey('2026-10-25'), { ackAt: at('2026-10-25', '10:05') }, false, at('2026-10-25', '09:00'))).toEqual(at('2026-10-25', '14:00'));
  });
});

describe('cleanerVisit', () => {
  const c = byKey('2026-10-18');
  const names = ['Mihaela'];

  it('runs from her keypad unlock to the last lock, once the door has been quiet', () => {
    const events = [
      ev('2026-10-20', '11:42', 1, 'mihaela '),
      ev('2026-10-20', '11:44', 2, 'Auto Lock'),
      ev('2026-10-20', '13:55', 4, 'Mihaela'),
    ];
    expect(cleanerVisit(c, events, names, at('2026-10-20', '14:45'))).toEqual({ enteredAt: at('2026-10-20', '11:42'), leftAt: at('2026-10-20', '13:55') });
    expect(cleanerVisit(c, events, names, at('2026-10-20', '14:20'))).toEqual({ enteredAt: at('2026-10-20', '11:42'), leftAt: null });
  });

  it('does not claim an end from an auto-lock two minutes after she came in', () => {
    const events = [ev('2026-10-20', '11:42', 1, 'Mihaela'), ev('2026-10-20', '11:44', 2, 'Auto Lock')];
    expect(cleanerVisit(c, events, names, at('2026-10-20', '15:00'))!.leftAt).toBeNull();
  });

  it('ends at the guests\' unlock even without the quiet period', () => {
    const late = byKey('2026-10-25');
    const events = [ev('2026-10-25', '11:40', 1, 'Mihaela'), ev('2026-10-25', '14:20', 2, 'Mihaela'), ev('2026-10-25', '14:50', 1, 'Guest 25.10')];
    expect(cleanerVisit(late, events, names, at('2026-10-25', '14:55'))!.leftAt).toEqual(at('2026-10-25', '14:20'));
  });

  it('ignores other people, failed attempts, and entries long before the checkout', () => {
    const events = [
      ev('2026-10-18', '07:30', 1, 'Mihaela'), // guests still inside
      ev('2026-10-19', '12:00', 1, 'Bogdan'),
      ev('2026-10-19', '12:05', 1, 'Mihaela', 1), // motor blocked
    ];
    expect(cleanerVisit(c, events, names, at('2026-10-21', '19:00'))).toBeNull();
  });
});

describe('planLastMinute', () => {
  const weekly = { weekday: 0, time: '17:00' };
  const run = (stays: CleaningStay[], known: string[] | null, now: Date, lock = false, visits = {}) => {
    const list = buildCleanings(stays, [], STD, '2026-09-01', '2026-12-31');
    const checkIns = list.map(c => c.checkInYmd).filter(Boolean) as string[];
    return planLastMinute(list, checkIns, known, {}, visits, now, weekly, lock ? LOCK : NO_LOCK);
  };

  it('the next weekly message covers from the Monday after the next Sunday 17:00', () => {
    expect(nextCoverageStart(at('2026-10-20', '10:00'), weekly)).toBe('2026-10-26');
    expect(nextCoverageStart(at('2026-10-25', '16:00'), weekly)).toBe('2026-10-26');
    expect(nextCoverageStart(at('2026-10-25', '18:00'), weekly)).toBe('2026-11-02');
  });

  it('records what is there on the first run without alerting', () => {
    expect(run(COLTEI, null, at('2026-10-20', '10:00'))).toEqual({ messages: [], known: ['2026-10-22', '2026-10-25', '2026-10-30', '2026-11-20'] });
  });

  it('alerts on a new arrival the weekly message did not cover, urgent within 48h', () => {
    const stays = [stay('2026-10-10', '2026-10-18', 2), stay('2026-10-21', '2026-10-23', 2)];
    const { messages, known } = run(stays, [], at('2026-10-20', '10:00'));
    expect(messages).toEqual([{
      cleaningKey: '2026-10-18', key: 'lastminute:2026-10-21', kind: 'question', answers: 'done',
      text: 'URGENT: Rezervare noua: Maine, Miercuri 21.10, sosesc 2 persoane la 15:00. Apartamentul e liber din Duminica 18.10 (check-out la 11:00). ' +
        'Nu era in programul de duminica. E gata curatenia?',
      cleanerText: 'Buna ziua! Avem o rezervare noua: Maine, Miercuri 21.10, sosesc 2 persoane la 15:00. Apartamentul e liber din Duminica 18.10. ' +
        'Ati facut deja curatenia, sau o puteti face pana atunci? Multumesc!',
    }]);
    expect(known).toEqual(['2026-10-21']);
  });

  it('stays silent for an arrival the next weekly message will announce', () => {
    const stays = [stay('2026-10-10', '2026-10-18', 2), stay('2026-10-28', '2026-10-30', 2)];
    expect(run(stays, [], at('2026-10-20', '10:00'))).toEqual({ messages: [], known: ['2026-10-28'] });
  });

  it('asks whether the cleaner was told when the new guests arrive on a checkout day still ahead', () => {
    const stays = [stay('2026-10-18', '2026-10-24', 2), stay('2026-10-24', '2026-10-26', 3)];
    const [msg] = run(stays, ['2026-10-18'], at('2026-10-21', '12:00')).messages;
    expect(msg.text).toBe('Rezervare noua: Sambata 24.10 sosesc 3 persoane la 15:00. In aceeasi zi pleaca oaspetii de acum, la 11:00 ' +
      '(plecare si sosire in aceeasi zi). Nu era in programul de duminica. Ai vorbit cu Mihaela?');
    expect(msg.answers).toBe('ack');
  });

  it('only informs when the lock shows the cleaning was done', () => {
    const stays = [stay('2026-10-10', '2026-10-18', 2), stay('2026-10-21', '2026-10-23', 2)];
    const visits = { '2026-10-18': { enteredAt: at('2026-10-19', '12:00'), leftAt: at('2026-10-19', '14:00') } };
    const [msg] = run(stays, [], at('2026-10-20', '10:00'), true, visits).messages;
    expect(msg.kind).toBe('info');
    expect(msg.text).toBe('URGENT: Rezervare noua: Maine, Miercuri 21.10, sosesc 2 persoane la 15:00. Curatenia e deja facuta: Mihaela a fost la apartament Luni 19.10 la 12:00.');
  });

  it('waits for 07:00 at night and keeps the arrival unknown until then', () => {
    const stays = [stay('2026-10-10', '2026-10-18', 2), stay('2026-10-21', '2026-10-23', 2)];
    expect(run(stays, [], at('2026-10-20', '02:00'))).toEqual({ messages: [], known: [] });
    expect(run(stays, [], at('2026-10-20', '07:00')).messages).toHaveLength(1);
  });
});

describe('planShortcuts', () => {
  const expected = [
    { op: 'weeklySchedule', weekdays: [0], time: '17:00', label: 'programul de duminica pentru Mihaela' },
    { op: 'cleaningReminder', weekdays: [0, 1, 2, 3, 4, 5, 6], time: '08:30', label: 'reminderul de dimineata pentru Mihaela' },
  ];

  it('tells the owner when the Sunday shortcut has not run by 17:20', () => {
    const [msg] = planShortcuts(expected, {}, {}, at('2026-10-18', '17:21'));
    expect(msg.key).toBe('shortcut:weeklySchedule:2026-10-18');
    expect(msg.text).toBe('Scurtatura de pe iPhone pentru programul de duminica pentru Mihaela nu a rulat azi la 17:00, deci mesajul nu a plecat. ' +
      'Deschide aplicatia Shortcuts si ruleaz-o de mana, apoi verifica automatizarea.');
  });

  it('is quiet when it ran, before the grace period, hours later, or once said', () => {
    expect(planShortcuts(expected, { weeklySchedule: at('2026-10-18', '17:00') }, {}, at('2026-10-18', '17:25'))).toEqual([]);
    expect(planShortcuts(expected, {}, {}, at('2026-10-18', '17:10'))).toEqual([]);
    expect(planShortcuts(expected, {}, {}, at('2026-10-18', '20:30'))).toEqual([]);
    expect(planShortcuts(expected, {}, { 'shortcut:weeklySchedule:2026-10-18': at('2026-10-18', '17:21') }, at('2026-10-18', '17:40'))).toEqual([]);
    expect(planShortcuts(expected, { cleaningReminder: at('2026-10-17', '08:30') }, {}, at('2026-10-19', '08:55')).map(m => m.key))
      .toEqual(['shortcut:cleaningReminder:2026-10-19']); // yesterday's run does not count
  });
});
