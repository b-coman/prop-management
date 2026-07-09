/** @jest-environment node */
jest.mock('@/lib/firebaseAdminSafe', () => ({ getAdminDb: jest.fn() }));

import { resolveAdContext, clearAdContextCache } from '../adContext';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const mockGetAdminDb = getAdminDb as jest.Mock;

function makeDb(analyticsByProperty: Record<string, unknown>) {
  const getMock = jest.fn(async (propertyId: string) => ({
    data: () => ({ analytics: analyticsByProperty[propertyId] }),
  }));
  const db = {
    collection: jest.fn(() => ({
      doc: jest.fn((propertyId: string) => ({ get: () => getMock(propertyId) })),
    })),
  };
  return { db, getMock };
}

const origTokens = process.env.META_ADS_TOKENS;

beforeEach(() => {
  jest.clearAllMocks();
  clearAdContextCache();
});

afterAll(() => {
  process.env.META_ADS_TOKENS = origTokens;
});

describe('resolveAdContext — per-property Meta Ads config (Phase 0)', () => {
  it('resolves a fully configured property', async () => {
    process.env.META_ADS_TOKENS = JSON.stringify({ 'prahova-mountain-chalet': 'tok-prahova' });
    const { db } = makeDb({
      'prahova-mountain-chalet': {
        metaAdAccountId: 'act_543311232953437',
        metaPageId: '107610677616243',
        metaInstagramActorId: '17841435421272996',
        metaTokenRef: 'prahova-mountain-chalet',
      },
    });
    mockGetAdminDb.mockResolvedValue(db);

    const ctx = await resolveAdContext('prahova-mountain-chalet');
    expect(ctx).toEqual({
      adAccountId: 'act_543311232953437',
      pageId: '107610677616243',
      instagramActorId: '17841435421272996',
      token: 'tok-prahova',
    });
  });

  it('returns null for a property with no ad account configured (isolation)', async () => {
    process.env.META_ADS_TOKENS = JSON.stringify({ 'prahova-mountain-chalet': 'tok-prahova' });
    const { db } = makeDb({ 'coltei-apartment-bucharest': { metaPixelId: 'px-only' } });
    mockGetAdminDb.mockResolvedValue(db);

    expect(await resolveAdContext('coltei-apartment-bucharest')).toBeNull();
  });

  it('returns null when the ad account is configured but the tokenRef has no secret entry (isolation)', async () => {
    process.env.META_ADS_TOKENS = JSON.stringify({ 'some-other-ref': 'tok-x' });
    const { db } = makeDb({
      'coltei-apartment-bucharest': {
        metaAdAccountId: 'act_999',
        metaTokenRef: 'coltei-apartment-bucharest', // not in the secret map
      },
    });
    mockGetAdminDb.mockResolvedValue(db);

    expect(await resolveAdContext('coltei-apartment-bucharest')).toBeNull();
  });

  it('returns null for an empty/falsy propertyId without hitting Firestore', async () => {
    const { db, getMock } = makeDb({});
    mockGetAdminDb.mockResolvedValue(db);
    expect(await resolveAdContext('')).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('caches per property (one Firestore read within the TTL)', async () => {
    process.env.META_ADS_TOKENS = JSON.stringify({ 'prahova-mountain-chalet': 'tok-prahova' });
    const { db, getMock } = makeDb({
      'prahova-mountain-chalet': { metaAdAccountId: 'act_543311232953437', metaTokenRef: 'prahova-mountain-chalet' },
    });
    mockGetAdminDb.mockResolvedValue(db);

    await resolveAdContext('prahova-mountain-chalet');
    await resolveAdContext('prahova-mountain-chalet');
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('a shared tokenRef resolves the SAME token for two different properties (agency shape)', async () => {
    process.env.META_ADS_TOKENS = JSON.stringify({ agency: 'tok-agency' });
    const { db } = makeDb({
      'property-a': { metaAdAccountId: 'act_a', metaTokenRef: 'agency' },
      'property-b': { metaAdAccountId: 'act_b', metaTokenRef: 'agency' },
    });
    mockGetAdminDb.mockResolvedValue(db);

    const ctxA = await resolveAdContext('property-a');
    const ctxB = await resolveAdContext('property-b');
    expect(ctxA?.token).toBe('tok-agency');
    expect(ctxB?.token).toBe('tok-agency');
    expect(ctxA?.adAccountId).not.toBe(ctxB?.adAccountId); // still two distinct accounts
  });
});
