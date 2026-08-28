/** @jest-environment node */
import { offerPublishDay, nextTypeByDebt, alreadyQuoted, bucharestIso } from '../fortnightPlanner';

describe('offerPublishDay', () => {
  // The owner's rule: a weekend offer has to be seen with time to act on it — Tue or Wed, three
  // days clear. An offer that lands the night before is not an offer.
  it('puts a Friday check-in on the Tuesday before', () => {
    expect(offerPublishDay('2026-09-04')).toBe('2026-09-01'); // Fri -> Tue
  });

  it('puts a Saturday check-in on the Wednesday before', () => {
    expect(offerPublishDay('2026-09-26')).toBe('2026-09-23'); // Sat -> Wed
  });

  it('reaches back past Thursday for a Monday check-in', () => {
    expect(offerPublishDay('2026-09-07')).toBe('2026-09-02'); // Mon -> Wed, 5 days out
  });

  it('never returns a day less than three ahead', () => {
    for (const start of ['2026-09-04', '2026-09-07', '2026-09-26', '2026-10-24', '2026-12-25']) {
      const day = offerPublishDay(start)!;
      const lead = (Date.parse(`${start}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400000;
      expect(lead).toBeGreaterThanOrEqual(3);
      expect([2, 3]).toContain(new Date(`${day}T00:00:00Z`).getUTCDay()); // Tue or Wed only
    }
  });
});

describe('nextTypeByDebt', () => {
  // The mix is a debt measured across ALL history plus everything already scheduled, not a quota
  // inside each batch — the owner's point, that the ratio has to hold over the long run.
  it('starts a dormant page on place, the type that earns reach', () => {
    expect(nextTypeByDebt({ place: 0, proof: 0, offer: 0 }, 0)).toBe('place');
  });

  it('calls the offer when one place and one proof are on the board', () => {
    expect(nextTypeByDebt({ place: 1, proof: 1, offer: 0 }, 2)).toBe('offer');
  });

  it('walks a fortnight back towards 60/25/15', () => {
    const counts: Record<string, number> = { place: 1, proof: 1, offer: 0 };
    let total = 2;
    const picked: string[] = [];
    for (let i = 0; i < 4; i++) {
      const t = nextTypeByDebt(counts, total);
      picked.push(t); counts[t] += 1; total += 1;
    }
    expect(picked).toEqual(['offer', 'place', 'place', 'proof']);
    expect(counts).toEqual({ place: 3, proof: 2, offer: 1 });
  });
});

describe('alreadyQuoted', () => {
  const review = {
    id: 'mada', author: 'Madalina', rating: 5, source: 'airbnb', at: 0,
    text: 'Cabana asta e un soi de acasa departe de casa! Este locul perfect pentru cateva zile petrecute cu familia.',
  };

  it('recognises a quote even when the caption added the diacritics', () => {
    const posts = [{ message: '"Cabana asta e un soi de acasă departe de casă. Locul perfect pentru câteva zile cu familia" - așa ne-a scris Mădălina.' }];
    expect(alreadyQuoted([review], posts).has('mada')).toBe(true);
  });

  it('trusts a stored reviewId outright', () => {
    expect(alreadyQuoted([review], [{ message: 'something else entirely', reviewId: 'mada' }]).has('mada')).toBe(true);
  });

  it('does not flag a review nobody quoted', () => {
    expect(alreadyQuoted([review], [{ message: 'Vine toamna, bine-mi pare, în grădină am culoare.' }]).size).toBe(0);
  });
});

describe('bucharestIso', () => {
  // Hardcoding an offset posts an hour out for half the year: the fortnight before 25 Oct 2026 is
  // UTC+3, the one after it is UTC+2.
  it('resolves summer time (UTC+3)', () => {
    expect(bucharestIso('2026-09-01', 19, 30)).toBe('2026-09-01T16:30:00.000Z');
  });

  it('resolves winter time (UTC+2)', () => {
    expect(bucharestIso('2026-12-02', 19, 30)).toBe('2026-12-02T17:30:00.000Z');
  });
});
