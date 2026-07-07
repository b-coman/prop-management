/** @jest-environment node */
jest.mock('@/lib/firebaseAdminSafe', () => ({ getAdminDb: jest.fn() }));

import {
  getGrowthPropertyConfig,
  clearGrowthConfigCache,
  DEFAULT_GROWTH_PROPERTY_CONFIG,
} from '../growthConfigService';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const mockGetAdminDb = getAdminDb as jest.Mock;

function makeDb(configDoc: Record<string, unknown> | null) {
  const db = {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ exists: !!configDoc, data: () => configDoc }),
      })),
    })),
  };
  return db;
}

beforeEach(() => {
  jest.clearAllMocks();
  clearGrowthConfigCache();
});

describe('getGrowthPropertyConfig', () => {
  it('returns the SAFE default (reactivation OFF) for an unconfigured property', async () => {
    mockGetAdminDb.mockResolvedValue(makeDb(null));
    const config = await getGrowthPropertyConfig('some-property');
    expect(config).toEqual(DEFAULT_GROWTH_PROPERTY_CONFIG);
    expect(config.reactivationEnabled).toBe(false);
  });

  it('merges a stored config over the defaults', async () => {
    mockGetAdminDb.mockResolvedValue(makeDb({ reactivationEnabled: true, reactivationCohort: 'all' }));
    const config = await getGrowthPropertyConfig('coltei-apartment-bucharest');
    expect(config.reactivationEnabled).toBe(true);
    expect(config.reactivationCohort).toBe('all');
    // unspecified field falls back to default
    expect(config.reactivationTemplate).toBe(DEFAULT_GROWTH_PROPERTY_CONFIG.reactivationTemplate);
  });

  it('caches per property (one Firestore read)', async () => {
    const db = makeDb({ reactivationEnabled: true });
    mockGetAdminDb.mockResolvedValue(db);
    await getGrowthPropertyConfig('p1');
    await getGrowthPropertyConfig('p1');
    expect(db.collection).toHaveBeenCalledTimes(1);
  });

  it('falls back to defaults if the read throws', async () => {
    mockGetAdminDb.mockRejectedValue(new Error('firestore down'));
    const config = await getGrowthPropertyConfig('p2');
    expect(config).toEqual(DEFAULT_GROWTH_PROPERTY_CONFIG);
  });
});
