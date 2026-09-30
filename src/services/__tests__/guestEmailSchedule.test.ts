import {
  classifySource,
  audienceAllows,
  stageFiresAt,
  PRE_ARRIVAL,
  REVIEW_REQUEST,
  RETURN_INCENTIVE,
  SEASONAL_REMINDER,
  GUEST_EMAIL_STAGES,
} from '@/services/guestEmailSchedule';

describe('classifySource', () => {
  it('recognises a paid direct booking', () => {
    expect(classifySource('direct')).toBe('direct');
  });

  it('recognises every OTA we take bookings from', () => {
    for (const s of ['airbnb', 'booking.com', 'vrbo', 'expedia', 'travelmint']) {
      expect(classifySource(s)).toBe('ota');
    }
  });

  it('is case- and whitespace-insensitive', () => {
    expect(classifySource(' Booking.com ')).toBe('ota');
    expect(classifySource('DIRECT')).toBe('direct');
  });

  it('treats an unpaid web booking as unknown, not direct', () => {
    // bookingService promotes these to 'direct' on payment, so one still wearing the provisional
    // source is a booking nobody paid for.
    expect(classifySource('website-pending')).toBe('unknown');
    expect(classifySource('website-hold')).toBe('unknown');
  });

  it('treats simulations and missing values as unknown', () => {
    expect(classifySource('simulation')).toBe('unknown');
    expect(classifySource('test-button')).toBe('unknown');
    expect(classifySource(undefined)).toBe('unknown');
    expect(classifySource('')).toBe('unknown');
  });

  it('classifies a source nobody has added yet as unknown rather than direct', () => {
    // The failure we want is silence, not mailing a guest we promised to reach via their platform.
    expect(classifySource('some-new-channel')).toBe('unknown');
  });
});

describe('audienceAllows', () => {
  it('direct-only admits only direct bookings', () => {
    expect(audienceAllows('direct-only', 'direct')).toBe(true);
    expect(audienceAllows('direct-only', 'booking.com')).toBe(false);
    expect(audienceAllows('direct-only', undefined)).toBe(false);
  });

  it('any admits everything, including an OTA booking', () => {
    expect(audienceAllows('any', 'airbnb')).toBe(true);
    expect(audienceAllows('any', undefined)).toBe(true);
  });
});

describe('the schedule itself', () => {
  it('never writes to an OTA guest — they are contacted through the OTA', () => {
    for (const stage of GUEST_EMAIL_STAGES) {
      expect(audienceAllows(stage.audience, 'booking.com')).toBe(false);
    }
  });

  it('gives every stage a catch-up day, so one missed run costs nothing', () => {
    // A daily cron steps a whole day at a time. A stage firing on a single offset would be
    // skipped entirely by one failed run.
    for (const stage of GUEST_EMAIL_STAGES) {
      expect(stage.offsets.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('gives every stage its own stamp, so stages cannot cancel each other out', () => {
    const stamps = GUEST_EMAIL_STAGES.map((s) => s.stamp);
    expect(new Set(stamps).size).toBe(stamps.length);
  });

  it('places the stages where the old crons placed them', () => {
    // Day-offsets replaced fractional-day arithmetic; these are the windows that were live.
    expect(PRE_ARRIVAL.offsets).toEqual([-1, 0]);        // was: checkIn is today or tomorrow
    expect(REVIEW_REQUEST.offsets).toEqual([2, 3]);      // was: 1.5-3.5 days after checkout
    expect(RETURN_INCENTIVE.offsets).toEqual([14, 15]);  // was: 13.5-15.5
    expect(SEASONAL_REMINDER.offsets).toEqual([90, 91]); // was: 89.5-91.5
  });

  it('anchors pre-arrival on check-in and everything else on checkout', () => {
    expect(PRE_ARRIVAL.anchor).toBe('checkInDate');
    for (const s of [REVIEW_REQUEST, RETURN_INCENTIVE, SEASONAL_REMINDER]) {
      expect(s.anchor).toBe('checkOutDate');
    }
  });

  it('treats only the pre-arrival email as transactional', () => {
    // It concerns a stay already paid for. The rest ask for something, so they obey unsubscribe
    // strictly and carry an opt-out link.
    expect(PRE_ARRIVAL.kind).toBe('transactional');
    for (const s of [REVIEW_REQUEST, RETURN_INCENTIVE, SEASONAL_REMINDER]) {
      expect(s.kind).toBe('marketing');
    }
  });

  it('runs pre-arrival on confirmed bookings and the rest on completed ones', () => {
    expect(PRE_ARRIVAL.statuses).toEqual(['confirmed']);
    for (const s of [REVIEW_REQUEST, RETURN_INCENTIVE, SEASONAL_REMINDER]) {
      expect(s.statuses).toEqual(['completed']);
    }
  });
});

describe('stageFiresAt', () => {
  it('fires on the declared offsets and nowhere else', () => {
    expect(stageFiresAt(REVIEW_REQUEST, 2)).toBe(true);
    expect(stageFiresAt(REVIEW_REQUEST, 3)).toBe(true);
    expect(stageFiresAt(REVIEW_REQUEST, 1)).toBe(false);
    expect(stageFiresAt(REVIEW_REQUEST, 4)).toBe(false);
    expect(stageFiresAt(PRE_ARRIVAL, -1)).toBe(true);
    expect(stageFiresAt(PRE_ARRIVAL, -2)).toBe(false);
  });
});
