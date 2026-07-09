/** @jest-environment node */
jest.mock('@/lib/firebaseAdminSafe', () => ({ getAdminDb: jest.fn() }));

import { getPixelIdForProperty, clearPixelCache } from '../meta-pixels';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const mockGetAdminDb = getAdminDb as jest.Mock;

function makeDb(analyticsBySlug: Record<string, unknown>) {
  const getMock = jest.fn(async (slug: string) => ({ data: () => ({ analytics: analyticsBySlug[slug] }) }));
  const db = { collection: jest.fn(() => ({ doc: jest.fn((slug: string) => ({ get: () => getMock(slug) })) })) };
  return { db, getMock };
}

beforeEach(() => {
  jest.clearAllMocks();
  clearPixelCache();
});

describe('getPixelIdForProperty (per-property config from Firestore)', () => {
  it('reads analytics.metaPixelId for the property', async () => {
    const { db } = makeDb({ 'prahova-mountain-chalet': { metaPixelId: '1010060168431159' } });
    mockGetAdminDb.mockResolvedValue(db);
    expect(await getPixelIdForProperty('prahova-mountain-chalet')).toBe('1010060168431159');
  });

  it('returns undefined when the property has no metaPixelId configured', async () => {
    const { db } = makeDb({ 'coltei-apartment-bucharest': { enabled: true } });
    mockGetAdminDb.mockResolvedValue(db);
    expect(await getPixelIdForProperty('coltei-apartment-bucharest')).toBeUndefined();
  });

  it('returns undefined for a null/empty slug without hitting Firestore', async () => {
    const { db, getMock } = makeDb({});
    mockGetAdminDb.mockResolvedValue(db);
    expect(await getPixelIdForProperty(null)).toBeUndefined();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('caches per property (one Firestore read within the TTL)', async () => {
    const { db, getMock } = makeDb({ 'prahova-mountain-chalet': { metaPixelId: '1010060168431159' } });
    mockGetAdminDb.mockResolvedValue(db);
    await getPixelIdForProperty('prahova-mountain-chalet');
    await getPixelIdForProperty('prahova-mountain-chalet');
    expect(getMock).toHaveBeenCalledTimes(1);
  });
});
