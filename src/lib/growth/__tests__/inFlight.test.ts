/** @jest-environment node */

import { computeInFlight, normaliseCityName, type AdCampaignForInFlight } from '../inFlight';

const ASOF = '2026-09-07T12:00:00Z';

const campaign = (over: Partial<AdCampaignForInFlight> = {}): AdCampaignForInFlight =>
  ({
    id: 'D8bMrAmn',
    metaCampaignId: '120252160782430114',
    status: 'active',
    effectiveStatus: 'ACTIVE',
    objective: 'OUTCOME_TRAFFIC',
    dailyBudgetMinor: 1000,
    endTime: '2026-10-01T20:59:00Z',
    insights: { spend: 2.35, impressions: 215, clicks: 15 },
    proposal: {
      source: 'opportunity-engine',
      occasion: { name: 'Toamna lunga', start: '2026-09-22', end: '2026-10-08', nights: 16 },
      copy: [],
      photos: [],
      cities: [{ name: 'Bucharest', radius: 30 }],
      audiences: [],
      creativeBrief: 'Autumn long-stay, food and fire, couples',
      rationale: '',
    },
    ...over,
  }) as AdCampaignForInFlight;

describe('computeInFlight — the forward commitment', () => {
  it('projects remaining spend from daily budget x days left', () => {
    const b = computeInFlight([campaign()], ASOF);
    expect(b.campaigns[0].daysRemaining).toBe(25);
    expect(b.campaigns[0].projectedRemainingMinor).toBe(25_000); // 250 RON still to spend
    expect(b.totalProjectedRemainingMinor).toBe(25_000);
  });

  it('converts insights.spend from RON to bani (the 100x unit trap)', () => {
    const b = computeInFlight([campaign()], ASOF);
    expect(b.campaigns[0].spentToDateMinor).toBe(235);
  });

  it('never returns a negative days-remaining for a campaign past its end', () => {
    const b = computeInFlight([campaign({ endTime: '2026-08-01T00:00:00Z' })], ASOF);
    expect(b.campaigns[0].daysRemaining).toBe(0);
    expect(b.campaigns[0].projectedRemainingMinor).toBe(0);
  });
});

describe('computeInFlight — collision surface', () => {
  it('exposes normalised city names and audience ids for overlap checks', () => {
    const b = computeInFlight(
      [
        campaign(),
        campaign({
          id: 'OU3kBSX',
          proposal: {
            ...campaign().proposal!,
            cities: [{ name: 'Constanța', radius: 50 }],
            audiences: [{ id: 'aud-1', name: 'All site visitors 180d' }],
          },
        }),
      ],
      ASOF
    );
    expect(b.activeCityNames).toEqual(['bucharest', 'constanta']);
    expect(b.activeAudienceIds).toEqual(['aud-1']);
    expect(b.totalDailyBudgetMinor).toBe(2000);
  });

  it('carries the stay window so an overlapping plan can be detected', () => {
    const b = computeInFlight([campaign()], ASOF);
    expect(b.campaigns[0].window).toEqual({ start: '2026-09-22', end: '2026-10-08', nights: 16 });
  });

  it('tells the planner not to double-target, in the note', () => {
    const b = computeInFlight([], ASOF);
    expect(b.note).toMatch(/same auction/i);
    expect(b.note).toMatch(/EXTEND it/);
  });

  it('degrades to nulls on a manual compose with no proposal', () => {
    const b = computeInFlight([campaign({ proposal: undefined })], ASOF);
    expect(b.campaigns[0].window).toBeNull();
    expect(b.campaigns[0].angle).toBeNull();
    expect(b.campaigns[0].cities).toEqual([]);
  });
});

describe('normaliseCityName', () => {
  it('strips diacritics and case so Constanța matches CONSTANTA', () => {
    expect(normaliseCityName('Constanța')).toBe(normaliseCityName('CONSTANTA'));
    expect(normaliseCityName('București')).toBe('bucuresti');
  });
});
