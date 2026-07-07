/** @jest-environment node */
jest.mock('@/services/segmentService', () => ({ evaluateSegment: jest.fn() }));

import { formatPhoneForMeta, buildCustomAudiencePayload, isMetaAudienceConfigured } from '../metaAudienceService';
import { evaluateSegment } from '@/services/segmentService';
import { hashForMeta } from '@/lib/meta-capi';

const mockEvaluateSegment = evaluateSegment as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('formatPhoneForMeta', () => {
  it('strips + and non-digits', () => {
    expect(formatPhoneForMeta('+40 712 345 678')).toBe('40712345678');
    expect(formatPhoneForMeta('+40712345678')).toBe('40712345678');
  });
});

describe('buildCustomAudiencePayload', () => {
  it('hashes phone (digits-only) and email, skipping unreachable guests', async () => {
    mockEvaluateSegment.mockResolvedValue([
      { id: 'g1', normalizedPhone: '+40712345678', email: 'a@b.com' },
      { id: 'g2', normalizedPhone: '+40733111222' }, // phone only
      { id: 'g3' }, // neither -> skipped
    ]);

    const payload = await buildCustomAudiencePayload({ propertyId: 'p' });

    expect(payload.schema).toEqual(['PHONE', 'EMAIL']);
    expect(payload.data).toHaveLength(2); // g3 skipped
    // g1: both hashed with the SAME algorithm meta-capi uses
    expect(payload.data[0][0]).toBe(hashForMeta('40712345678'));
    expect(payload.data[0][1]).toBe(hashForMeta('a@b.com'));
    // g2: phone hashed, email slot empty
    expect(payload.data[1][0]).toBe(hashForMeta('40733111222'));
    expect(payload.data[1][1]).toBe('');
    // hashes are 64-hex sha256, never raw PII
    expect(payload.data[0][0]).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns an empty member list for an empty segment', async () => {
    mockEvaluateSegment.mockResolvedValue([]);
    const payload = await buildCustomAudiencePayload({ propertyId: 'p' });
    expect(payload.data).toEqual([]);
  });
});

describe('isMetaAudienceConfigured', () => {
  it('is false without the Meta env vars (dark launch default)', () => {
    delete process.env.META_SYSTEM_USER_TOKEN;
    delete process.env.META_AD_ACCOUNT_ID;
    expect(isMetaAudienceConfigured()).toBe(false);
  });
});
