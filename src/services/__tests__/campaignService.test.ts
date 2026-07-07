/** @jest-environment node */

jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'ts') },
  Timestamp: { fromDate: jest.fn((d: Date) => d) },
}));
jest.mock('@/services/segmentService', () => ({
  evaluateSegment: jest.fn(),
  previewAudience: jest.fn(),
}));
jest.mock('@/services/executionGateway', () => ({ executeSend: jest.fn() }));

import { sendCampaign } from '../campaignService';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { evaluateSegment } from '@/services/segmentService';
import { executeSend } from '@/services/executionGateway';

const mockGetAdminDb = getAdminDb as jest.Mock;
const mockEvaluateSegment = evaluateSegment as jest.Mock;
const mockExecuteSend = executeSend as jest.Mock;

function campaignDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    name: 'Winter reactivation',
    propertyId: 'prahova-mountain-chalet',
    channel: 'whatsapp',
    templateName: 'winter_invite',
    variables: {},
    segmentDefinition: { propertyId: 'prahova-mountain-chalet' },
    status: 'draft',
    sentAt: null,
    ...overrides,
  };
}

function makeDb(campaign: Record<string, unknown> | null) {
  const updateMock = jest.fn().mockResolvedValue(undefined);
  const docRef = {
    get: jest.fn().mockResolvedValue({
      exists: !!campaign,
      id: campaign?.id,
      data: () => campaign,
    }),
    update: updateMock,
  };
  const db = { collection: jest.fn(() => ({ doc: jest.fn(() => docRef) })) };
  return { db, updateMock };
}

beforeEach(() => {
  delete process.env.GROWTH_ENGINE_ENABLED; // dark-launch default => dry-run
  delete process.env.GROWTH_ENGINE_SEND_MODE;
  jest.clearAllMocks();
});

describe('campaignService.sendCampaign (dry-run by default)', () => {
  it('iterates the whole audience and tallies dry-run stats', async () => {
    const { db } = makeDb(campaignDoc());
    mockGetAdminDb.mockResolvedValue(db);
    mockEvaluateSegment.mockResolvedValue([{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }]);
    mockExecuteSend.mockResolvedValue({ status: 'dry-run', mode: 'dry-run' });

    const res = await sendCampaign('c1');

    expect(mockExecuteSend).toHaveBeenCalledTimes(3);
    expect(mockExecuteSend.mock.calls[0][0]).toMatchObject({
      guestId: 'g1',
      campaignId: 'c1',
      channel: 'whatsapp',
      templateName: 'winter_invite',
    });
    expect(res.mode).toBe('dry-run');
    expect(res.capped).toBe(false);
    expect(res.stats).toMatchObject({ audienceSize: 3, attempted: 3, dryRun: 3, sent: 0 });
  });

  it('respects the per-run cap and reports capped', async () => {
    const { db } = makeDb(campaignDoc());
    mockGetAdminDb.mockResolvedValue(db);
    mockEvaluateSegment.mockResolvedValue(Array.from({ length: 10 }, (_, i) => ({ id: `g${i}` })));
    mockExecuteSend.mockResolvedValue({ status: 'dry-run', mode: 'dry-run' });

    const res = await sendCampaign('c1', { cap: 4 });

    expect(mockExecuteSend).toHaveBeenCalledTimes(4);
    expect(res.capped).toBe(true);
    expect(res.stats.attempted).toBe(4);
  });

  it('tallies mixed gateway outcomes', async () => {
    const { db } = makeDb(campaignDoc());
    mockGetAdminDb.mockResolvedValue(db);
    mockEvaluateSegment.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    mockExecuteSend
      .mockResolvedValueOnce({ status: 'dry-run', mode: 'dry-run' })
      .mockResolvedValueOnce({ status: 'suppressed', mode: 'dry-run' })
      .mockResolvedValueOnce({ status: 'skipped', mode: 'dry-run' });

    const res = await sendCampaign('c1');
    expect(res.stats).toMatchObject({ dryRun: 1, suppressed: 1, skipped: 1, sent: 0, failed: 0 });
  });

  it('throws for a missing campaign', async () => {
    const { db } = makeDb(null);
    mockGetAdminDb.mockResolvedValue(db);
    await expect(sendCampaign('missing')).rejects.toThrow(/not found/i);
  });
});
