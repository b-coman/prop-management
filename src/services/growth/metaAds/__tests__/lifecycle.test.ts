/** @jest-environment node */

jest.mock('../adContext', () => ({ resolveAdContext: jest.fn() }));
jest.mock('../client', () => ({ metaGraph: jest.fn(), pauseResource: jest.fn() }));

import { pauseCampaign, pauseAllForProperty } from '../lifecycle';
import { resolveAdContext } from '../adContext';
import { metaGraph, pauseResource } from '../client';

const mockResolveAdContext = resolveAdContext as jest.Mock;
const mockMetaGraph = metaGraph as jest.Mock;
const mockPauseResource = pauseResource as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('pauseCampaign — the STOP primitive (Fable C1)', () => {
  it('no-ops for a property with no ad context (never calls Meta)', async () => {
    mockResolveAdContext.mockResolvedValue(null);
    const res = await pauseCampaign('unconfigured-property', 'camp-1');
    expect(res).toEqual({ success: false, campaignId: 'camp-1', error: 'no-ad-context' });
    expect(mockPauseResource).not.toHaveBeenCalled();
  });

  it('pauses via the client for a configured property', async () => {
    mockResolveAdContext.mockResolvedValue({ adAccountId: 'act_1', token: 'tok' });
    mockPauseResource.mockResolvedValue({ ok: true, data: { success: true } });

    const res = await pauseCampaign('prahova-mountain-chalet', 'camp-1');
    expect(res).toEqual({ success: true, campaignId: 'camp-1' });
    expect(mockPauseResource).toHaveBeenCalledWith('camp-1', 'tok', 'prahova-mountain-chalet');
  });

  it('surfaces (but does not throw on) a Meta-side pause failure', async () => {
    mockResolveAdContext.mockResolvedValue({ adAccountId: 'act_1', token: 'tok' });
    mockPauseResource.mockResolvedValue({ ok: false, error: 'meta-down' });

    const res = await pauseCampaign('prahova-mountain-chalet', 'camp-1');
    expect(res).toEqual({ success: false, campaignId: 'camp-1', error: 'meta-down' });
  });
});

describe('pauseAllForProperty — the panic button (Fable C1)', () => {
  it('no-ops (empty list) for a property with no ad context — never a blind pause-everything', async () => {
    mockResolveAdContext.mockResolvedValue(null);
    const res = await pauseAllForProperty('unconfigured-property');
    expect(res).toEqual([]);
    expect(mockMetaGraph).not.toHaveBeenCalled();
    expect(mockPauseResource).not.toHaveBeenCalled();
  });

  it('lists non-paused campaigns for the property and pauses each', async () => {
    mockResolveAdContext.mockResolvedValue({ adAccountId: 'act_543311232953437', token: 'tok' });
    mockMetaGraph.mockResolvedValue({
      ok: true,
      data: {
        data: [
          { id: 'camp-1', status: 'ACTIVE' },
          { id: 'camp-2', status: 'PAUSED' }, // already paused — skipped
          { id: 'camp-3', status: 'PENDING_REVIEW' },
        ],
      },
    });
    mockPauseResource.mockResolvedValue({ ok: true, data: { success: true } });

    const res = await pauseAllForProperty('prahova-mountain-chalet');
    expect(mockPauseResource).toHaveBeenCalledTimes(2);
    expect(mockPauseResource).toHaveBeenCalledWith('camp-1', 'tok', 'prahova-mountain-chalet');
    expect(mockPauseResource).toHaveBeenCalledWith('camp-3', 'tok', 'prahova-mountain-chalet');
    expect(mockPauseResource).not.toHaveBeenCalledWith('camp-2', 'tok', 'prahova-mountain-chalet');
    expect(res).toEqual([
      { success: true, campaignId: 'camp-1' },
      { success: true, campaignId: 'camp-3' },
    ]);
  });

  it('returns an empty list (no throw) when listing campaigns fails', async () => {
    mockResolveAdContext.mockResolvedValue({ adAccountId: 'act_1', token: 'tok' });
    mockMetaGraph.mockResolvedValue({ ok: false, error: 'timeout' });

    const res = await pauseAllForProperty('prahova-mountain-chalet');
    expect(res).toEqual([]);
    expect(mockPauseResource).not.toHaveBeenCalled();
  });
});
