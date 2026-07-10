/** @jest-environment node */

jest.mock('../adContext', () => ({ resolveAdContext: jest.fn() }));
jest.mock('../client', () => ({ metaGraph: jest.fn() }));

import { getInsights, getEffectiveStatus } from '../insights';
import { resolveAdContext } from '../adContext';
import { metaGraph } from '../client';

const mockResolveAdContext = resolveAdContext as jest.Mock;
const mockMetaGraph = metaGraph as jest.Mock;

const PROPERTY = 'prahova-mountain-chalet';
const OBJECT_ID = 'meta-campaign-1';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getInsights — no ad context (unconfigured property)', () => {
  it('returns {ok:false,error:"no-ad-context"} without calling Meta', async () => {
    mockResolveAdContext.mockResolvedValue(null);
    const res = await getInsights(PROPERTY, OBJECT_ID);
    expect(res).toEqual({ ok: false, error: 'no-ad-context' });
    expect(mockMetaGraph).not.toHaveBeenCalled();
  });
});

describe('getInsights — request shape', () => {
  beforeEach(() => {
    mockResolveAdContext.mockResolvedValue({ adAccountId: 'act_1', token: 'tok' });
  });

  it('GETs <objectId>/insights with the expected fields and defaults date_preset to "maximum"', async () => {
    mockMetaGraph.mockResolvedValue({ ok: true, data: { data: [] } });
    await getInsights(PROPERTY, OBJECT_ID);
    expect(mockMetaGraph).toHaveBeenCalledWith(`${OBJECT_ID}/insights`, {
      method: 'GET',
      params: {
        fields: 'spend,impressions,clicks,actions,action_values,purchase_roas',
        date_preset: 'maximum',
      },
      token: 'tok',
      propertyId: PROPERTY,
    });
  });

  it('honors a caller-supplied date_preset override', async () => {
    mockMetaGraph.mockResolvedValue({ ok: true, data: { data: [] } });
    await getInsights(PROPERTY, OBJECT_ID, { datePreset: 'last_30d' });
    const [, opts] = mockMetaGraph.mock.calls[0];
    expect(opts.params.date_preset).toBe('last_30d');
  });

  it('propagates a Graph API failure without throwing', async () => {
    mockMetaGraph.mockResolvedValue({ ok: false, error: 'timeout' });
    const res = await getInsights(PROPERTY, OBJECT_ID);
    expect(res).toEqual({ ok: false, error: 'timeout' });
  });
});

describe('getInsights — parsing', () => {
  beforeEach(() => {
    mockResolveAdContext.mockResolvedValue({ adAccountId: 'act_1', token: 'tok' });
  });

  it('parses spend/impressions/clicks, sums purchases + purchaseValue from actions/action_values, and uses purchase_roas', async () => {
    mockMetaGraph.mockResolvedValue({
      ok: true,
      data: {
        data: [
          {
            spend: '123.45',
            impressions: '1000',
            clicks: '50',
            actions: [
              { action_type: 'offsite_conversion.fb_pixel_purchase', value: '3' },
              { action_type: 'link_click', value: '50' }, // non-purchase action, must be ignored
            ],
            action_values: [{ action_type: 'offsite_conversion.fb_pixel_purchase', value: '900' }],
            purchase_roas: [{ value: '7.29' }],
          },
        ],
      },
    });

    const res = await getInsights(PROPERTY, OBJECT_ID);
    expect(res).toEqual({
      ok: true,
      data: { spend: 123.45, impressions: 1000, clicks: 50, purchases: 3, purchaseValue: 900, roas: 7.29 },
    });
  });

  it('does NOT double-count when both purchase action_types are present — picks the pixel-specific one', async () => {
    // Meta commonly mirrors the same web conversions under both types; summing
    // them would double-count. We pick offsite_conversion.fb_pixel_purchase.
    mockMetaGraph.mockResolvedValue({
      ok: true,
      data: {
        data: [
          {
            spend: '100',
            actions: [
              { action_type: 'offsite_conversion.fb_pixel_purchase', value: '2' },
              { action_type: 'purchase', value: '2' },
            ],
            action_values: [
              { action_type: 'offsite_conversion.fb_pixel_purchase', value: '200' },
              { action_type: 'purchase', value: '200' },
            ],
          },
        ],
      },
    });

    const res = await getInsights(PROPERTY, OBJECT_ID);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.purchases).toBe(2); // not 4
      expect(res.data.purchaseValue).toBe(200); // not 400
      // no purchase_roas in this fixture → falls back to purchaseValue/spend
      expect(res.data.roas).toBeCloseTo(2, 5);
    }
  });

  it('falls back to the unified "purchase" action_type when the pixel-specific one is absent', async () => {
    mockMetaGraph.mockResolvedValue({
      ok: true,
      data: {
        data: [
          {
            spend: '100',
            actions: [{ action_type: 'purchase', value: '5' }],
            action_values: [{ action_type: 'purchase', value: '500' }],
          },
        ],
      },
    });

    const res = await getInsights(PROPERTY, OBJECT_ID);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.purchases).toBe(5);
      expect(res.data.purchaseValue).toBe(500);
    }
  });

  it('falls back to purchaseValue/spend when Meta omits purchase_roas entirely', async () => {
    mockMetaGraph.mockResolvedValue({
      ok: true,
      data: { data: [{ spend: '50', action_values: [{ action_type: 'purchase', value: '150' }] }] },
    });
    const res = await getInsights(PROPERTY, OBJECT_ID);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.roas).toBe(3);
  });

  it('falls back to roas=0 when there is no spend and no purchase_roas (avoids divide-by-zero)', async () => {
    mockMetaGraph.mockResolvedValue({ ok: true, data: { data: [{ spend: '0' }] } });
    const res = await getInsights(PROPERTY, OBJECT_ID);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.roas).toBe(0);
  });

  it('returns all-zero insights when there is no data row yet (object never delivered)', async () => {
    mockMetaGraph.mockResolvedValue({ ok: true, data: { data: [] } });
    const res = await getInsights(PROPERTY, OBJECT_ID);
    expect(res).toEqual({
      ok: true,
      data: { spend: 0, impressions: 0, clicks: 0, purchases: 0, purchaseValue: 0, roas: 0 },
    });
  });
});

describe('getEffectiveStatus — OD4 on-demand drift/REJECTED read-back', () => {
  it('returns {ok:false,error:"no-ad-context"} without calling Meta for an unconfigured property', async () => {
    mockResolveAdContext.mockResolvedValue(null);
    const res = await getEffectiveStatus(PROPERTY, OBJECT_ID);
    expect(res).toEqual({ ok: false, error: 'no-ad-context' });
    expect(mockMetaGraph).not.toHaveBeenCalled();
  });

  it('GETs the object with fields=id,effective_status and returns the parsed value', async () => {
    mockResolveAdContext.mockResolvedValue({ adAccountId: 'act_1', token: 'tok' });
    mockMetaGraph.mockResolvedValue({ ok: true, data: { id: OBJECT_ID, effective_status: 'REJECTED' } });

    const res = await getEffectiveStatus(PROPERTY, OBJECT_ID);

    expect(mockMetaGraph).toHaveBeenCalledWith(OBJECT_ID, {
      method: 'GET',
      params: { fields: 'id,effective_status' },
      token: 'tok',
      propertyId: PROPERTY,
    });
    expect(res).toEqual({ ok: true, data: { effectiveStatus: 'REJECTED' } });
  });

  it('falls back to "UNKNOWN" when Meta omits effective_status on an otherwise-ok response', async () => {
    mockResolveAdContext.mockResolvedValue({ adAccountId: 'act_1', token: 'tok' });
    mockMetaGraph.mockResolvedValue({ ok: true, data: { id: OBJECT_ID } });
    const res = await getEffectiveStatus(PROPERTY, OBJECT_ID);
    expect(res).toEqual({ ok: true, data: { effectiveStatus: 'UNKNOWN' } });
  });

  it('propagates a Graph API failure without throwing', async () => {
    mockResolveAdContext.mockResolvedValue({ adAccountId: 'act_1', token: 'tok' });
    mockMetaGraph.mockResolvedValue({ ok: false, error: 'timeout' });
    const res = await getEffectiveStatus(PROPERTY, OBJECT_ID);
    expect(res).toEqual({ ok: false, error: 'timeout' });
  });
});
