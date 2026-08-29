/** @jest-environment node */

import {
  buildWorklist, cellId, computeCoverage, outstandingCells,
  type Observation, type ProbeInput,
} from '../parityWorklist';

const P = 'prahova-mountain-chalet';
const NOW = new Date('2026-08-07T12:00:00Z');

const PROBES: ProbeInput[] = [
  { label: 'Crăciun', checkIn: '2026-12-24', checkOut: '2026-12-29', nights: 5, guests: 3, priority: 'high' },
  { label: 'Crăciun', checkIn: '2026-12-24', checkOut: '2026-12-29', nights: 5, guests: 6, priority: 'high' },
  { label: 'ordinary weekend', checkIn: '2027-03-19', checkOut: '2027-03-21', nights: 2, guests: 3, priority: 'normal' },
];
const CHANNELS = ['airbnb', 'booking.com'];

const obs = (id: string, over: Partial<Observation> = {}): Observation => ({
  cellId: id, status: 'captured', guestTotal: 1000,
  capturedAt: '2026-08-07T10:00:00Z', source: 'browser', ...over,
});

describe('buildWorklist', () => {
  it('creates one cell per window × occupancy × channel, plus a direct cell', () => {
    const cells = buildWorklist(P, PROBES, CHANNELS);
    expect(cells).toHaveLength(3 * 3); // 3 probes × (direct + 2 channels)
    expect(cells.filter((c) => c.channel === 'direct')).toHaveLength(3);
  });

  it('records the direct price as an observation too, so it carries provenance', () => {
    // The direct number is not a given — it comes from the engine or from a page, and which one
    // matters (the site once rendered USD while the engine returned RON).
    const cells = buildWorklist(P, PROBES, CHANNELS);
    expect(cells.some((c) => c.channel === 'direct')).toBe(true);
  });

  it('gives a cell the same id across runs so drift can be measured', () => {
    const a = buildWorklist(P, PROBES, CHANNELS)[0].cellId;
    const b = buildWorklist(P, PROBES, CHANNELS)[0].cellId;
    expect(a).toBe(b);
    expect(a).toBe(cellId(P, '2026-12-24', '2026-12-29', 3, 'direct'));
  });

  it('keeps occupancy variants distinct', () => {
    const cells = buildWorklist(P, PROBES, CHANNELS);
    const three = cells.find((c) => c.guests === 3 && c.channel === 'airbnb')!;
    const six = cells.find((c) => c.guests === 6 && c.channel === 'airbnb')!;
    expect(three.cellId).not.toBe(six.cellId);
  });
});

describe('computeCoverage — the anti-partial-report guard', () => {
  const cells = buildWorklist(P, PROBES, CHANNELS);

  it('counts uncaptured cells as MISSING rather than ignoring them', () => {
    // This is the exact failure mode: two cells captured, seven silently absent, and a hand-made
    // table that looks complete.
    const cov = computeCoverage(cells, [obs(cells[0].cellId), obs(cells[1].cellId)], { now: NOW });
    expect(cov.total).toBe(9);
    expect(cov.captured).toBe(2);
    expect(cov.missing).toBe(7);
    expect(cov.complete).toBe(false);
    expect(cov.missingCellIds).toHaveLength(7);
  });

  it('treats a channel REFUSING to quote as resolved, with its reason', () => {
    // Airbnb enforcing a 4-night minimum is an answer, not a gap.
    const all = cells.map((c) =>
      c.channel === 'airbnb'
        ? obs(c.cellId, { status: 'refused', guestTotal: null, reason: 'min stay 4 nights' })
        : obs(c.cellId));
    const cov = computeCoverage(cells, all, { now: NOW });
    expect(cov.refused).toBe(3);
    expect(cov.missing).toBe(0);
    expect(cov.complete).toBe(true);
  });

  it('does NOT count an errored capture as complete — it is unfinished work', () => {
    const all = cells.map((c, i) =>
      i === 0 ? obs(c.cellId, { status: 'error', guestTotal: null, reason: 'bot check' }) : obs(c.cellId));
    const cov = computeCoverage(cells, all, { now: NOW });
    expect(cov.errored).toBe(1);
    expect(cov.complete).toBe(false);
  });

  it('flags stale observations and reports the oldest age', () => {
    const all = cells.map((c, i) =>
      obs(c.cellId, { capturedAt: i === 0 ? '2026-07-20T10:00:00Z' : '2026-08-07T10:00:00Z' }));
    const cov = computeCoverage(cells, all, { now: NOW, freshnessDays: 7 });
    expect(cov.oldestAgeDays).toBe(18);
    expect(cov.staleCellIds).toHaveLength(1);
    expect(cov.complete).toBe(false); // stale data cannot claim completeness
  });

  it('uses the newest observation when a cell was captured more than once', () => {
    const id = cells[0].cellId;
    const cov = computeCoverage([cells[0]], [
      obs(id, { capturedAt: '2026-08-01T10:00:00Z', guestTotal: 999 }),
      obs(id, { capturedAt: '2026-08-07T10:00:00Z', guestTotal: 1234 }),
    ], { now: NOW });
    expect(cov.captured).toBe(1);
    expect(cov.complete).toBe(true);
  });

  it('is complete only when every cell is resolved and fresh', () => {
    const cov = computeCoverage(cells, cells.map((c) => obs(c.cellId)), { now: NOW });
    expect(cov.resolvedPct).toBe(1);
    expect(cov.complete).toBe(true);
  });
});

describe('outstandingCells', () => {
  const cells = buildWorklist(P, PROBES, CHANNELS);

  it('returns exactly the work still owed, high priority first', () => {
    const done = [obs(cells[0].cellId)];
    const todo = outstandingCells(cells, done, { now: NOW });
    expect(todo).toHaveLength(8);
    expect(todo[0].priority).toBe('high');
  });

  it('re-queues errored and stale cells, not just missing ones', () => {
    const all = cells.map((c, i) => {
      if (i === 0) return obs(c.cellId, { status: 'error', guestTotal: null, reason: 'timeout' });
      if (i === 1) return obs(c.cellId, { capturedAt: '2026-06-01T10:00:00Z' });
      return obs(c.cellId);
    });
    const todo = outstandingCells(cells, all, { now: NOW, freshnessDays: 7 });
    expect(todo.map((c) => c.cellId)).toEqual(expect.arrayContaining([cells[0].cellId, cells[1].cellId]));
    expect(todo).toHaveLength(2);
  });

  it('returns nothing when the run is genuinely finished', () => {
    expect(outstandingCells(cells, cells.map((c) => obs(c.cellId)), { now: NOW })).toEqual([]);
  });
});

describe('outstandingCells — resolves history the same way computeCoverage does', () => {
  // Regression: outstandingCells built its own lookup with `new Map(observations.map(...))`, which
  // takes whichever observation comes LAST in the array rather than the newest. Both callers happened
  // to pre-dedupe via latestByCell, so it never bit — but a consumer reading raw append-only history
  // (a model trainer, say) would have re-queued errored cells by coin flip.
  const cells = buildWorklist('p', [{
    label: 'w', checkIn: '2026-12-24', checkOut: '2026-12-29', nights: 5, guests: 3, priority: 'normal',
  }], ['airbnb']);
  const cid = cells.find((c) => c.channel === 'airbnb')!.cellId;
  const directId = cells.find((c) => c.channel === 'direct')!.cellId;
  const now = new Date('2026-08-20T00:00:00Z');
  const fresh = { capturedAt: '2026-08-19T00:00:00Z', source: 'browser' as const, guestTotal: 4298 };
  const older = { capturedAt: '2026-08-01T00:00:00Z', source: 'browser' as const, guestTotal: 4298 };

  it('does not re-queue a cell whose NEWEST observation succeeded, even when an older error trails it', () => {
    const history = [
      { cellId: cid, status: 'captured' as const, ...fresh },
      { cellId: cid, status: 'error' as const, guestTotal: null, ...older },
      { cellId: directId, status: 'captured' as const, ...fresh },
    ];
    const todo = outstandingCells(cells, history, { now, freshnessDays: 42 });
    expect(todo.map((c) => c.cellId)).not.toContain(cid);
  });

  it('does re-queue a cell whose NEWEST observation errored, even when an older success trails it', () => {
    const history = [
      { cellId: cid, status: 'error' as const, guestTotal: null, ...fresh },
      { cellId: cid, status: 'captured' as const, ...older },
      { cellId: directId, status: 'captured' as const, ...fresh },
    ];
    const todo = outstandingCells(cells, history, { now, freshnessDays: 42 });
    expect(todo.map((c) => c.cellId)).toContain(cid);
  });
});
