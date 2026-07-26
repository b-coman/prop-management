/** @jest-environment node */

jest.mock('../adContext', () => ({ resolveAdContext: jest.fn() }));
jest.mock('../client', () => ({ metaGraph: jest.fn() }));

import { getPageHealth, getAdAccountHealth } from '../brandHealth';
import { resolveAdContext } from '../adContext';
import { metaGraph } from '../client';

const mockResolveAdContext = resolveAdContext as jest.Mock;
const mockMetaGraph = metaGraph as jest.Mock;

const PROPERTY = 'prahova-mountain-chalet';
const CTX = { adAccountId: 'act_1', pageId: 'page_1', token: 'systok' };

/** Route each metaGraph call to a canned response by exact path (order-independent). */
function routeByPath(responses: Record<string, unknown>) {
  mockMetaGraph.mockImplementation((p: string) =>
    Promise.resolve(p in responses ? responses[p] : { ok: false, error: `unexpected path: ${p}` })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── getPageHealth ────────────────────────────────────────────────────────────
describe('getPageHealth', () => {
  it('returns no-ad-context for an unconfigured property, without calling Meta', async () => {
    mockResolveAdContext.mockResolvedValue(null);
    const res = await getPageHealth(PROPERTY);
    expect(res).toEqual({ ok: false, error: 'no-ad-context' });
    expect(mockMetaGraph).not.toHaveBeenCalled();
  });

  it('returns no-page-configured when the context has no pageId', async () => {
    mockResolveAdContext.mockResolvedValue({ adAccountId: 'act_1', token: 'systok' });
    const res = await getPageHealth(PROPERTY);
    expect(res).toEqual({ ok: false, error: 'no-page-configured' });
    expect(mockMetaGraph).not.toHaveBeenCalled();
  });

  it('parses profile + aggregate insights, and flags a dormant page with an OTA website link', async () => {
    mockResolveAdContext.mockResolvedValue(CTX);
    routeByPath({
      page_1: {
        ok: true,
        data: {
          name: 'Comarnic Mountain Chalet',
          username: 'ComarnicChalet',
          link: 'https://facebook.com/page_1',
          followers_count: 552,
          is_published: true,
          talking_about_count: 0,
          category: 'Vacation Home Rental',
          website: 'https://www.airbnb.com/rooms/43265214',
          verification_status: 'not_verified',
        },
      },
      'me/accounts': { ok: true, data: { data: [{ id: 'page_1', access_token: 'pagetok' }] } },
      'page_1/insights': {
        ok: true,
        data: {
          data: [
            { name: 'page_follows', values: [{ value: 3 }] },
            { name: 'page_views_total', values: [{ value: 0 }, { value: 12 }] }, // latest value wins
          ],
        },
      },
    });

    const res = await getPageHealth(PROPERTY);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.followers).toBe(552);
    expect(res.data.dormant).toBe(true);
    expect(res.data.websiteIsOtaLink).toBe(true);
    expect(res.data.canReadInsights).toBe(true);
    expect(res.data.insights28d).toEqual({ page_follows: 3, page_views_total: 12 });
    expect(res.data.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('page-website-points-to-ota'),
        'page-dormant:talking_about_count=0',
      ])
    );
  });

  it('degrades to profile-only (canReadInsights=false) when no page token is derivable', async () => {
    mockResolveAdContext.mockResolvedValue(CTX);
    routeByPath({
      page_1: { ok: true, data: { name: 'X', followers_count: 10, is_published: true, talking_about_count: 5 } },
      'me/accounts': { ok: true, data: { data: [] } }, // system user not on the page
    });

    const res = await getPageHealth(PROPERTY);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.canReadInsights).toBe(false);
    expect(res.data.insights28d).toEqual({});
    expect(res.data.dormant).toBe(false);
    expect(res.data.warnings).toContain('page-insights-unreadable:no-page-token-or-analyze-task');
  });

  it('propagates a profile read failure without throwing', async () => {
    mockResolveAdContext.mockResolvedValue(CTX);
    routeByPath({ page_1: { ok: false, error: 'timeout' } });
    const res = await getPageHealth(PROPERTY);
    expect(res).toEqual({ ok: false, error: 'timeout' });
  });
});

// ── getAdAccountHealth ───────────────────────────────────────────────────────
describe('getAdAccountHealth', () => {
  it('returns no-ad-context for an unconfigured property, without calling Meta', async () => {
    mockResolveAdContext.mockResolvedValue(null);
    const res = await getAdAccountHealth(PROPERTY);
    expect(res).toEqual({ ok: false, error: 'no-ad-context' });
    expect(mockMetaGraph).not.toHaveBeenCalled();
  });

  it('flags no-spend-limit + no-conversion-history for the current live account shape', async () => {
    mockResolveAdContext.mockResolvedValue(CTX);
    routeByPath({
      act_1: {
        ok: true,
        data: {
          name: 'Bogdan-Comarnic',
          account_status: 1,
          currency: 'RON',
          spend_cap: '0',
          amount_spent: '44753',
          funding_source_details: { display_string: 'VISA *0028' },
        },
      },
      'act_1/insights': {
        ok: true,
        data: {
          data: [
            {
              spend: '412.44',
              impressions: '90609',
              clicks: '6062',
              ctr: '6.69',
              cpc: '0.068',
              reach: '41906',
              actions: [{ action_type: 'link_click', value: '2648' }], // no purchase → no conversion history
            },
          ],
        },
      },
      'act_1/campaigns': {
        ok: true,
        data: { data: [{ id: 'c1', effective_status: 'PAUSED' }, { id: 'c2', effective_status: 'PAUSED' }] },
      },
    });

    const res = await getAdAccountHealth(PROPERTY);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.hasSpendLimit).toBe(false);
    expect(res.data.spendCapMinor).toBe(0);
    expect(res.data.amountSpentMinor).toBe(44753);
    expect(res.data.hasConversionHistory).toBe(false);
    expect(res.data.campaignCount).toBe(2);
    expect(res.data.activeCampaignCount).toBe(0);
    expect(res.data.lifetime.clicks).toBe(6062);
    expect(res.data.warnings).toEqual(
      expect.arrayContaining(['no-account-spend-limit', 'no-conversion-optimized-history'])
    );
  });

  it('does not warn when a spend limit is set and there is purchase history', async () => {
    mockResolveAdContext.mockResolvedValue(CTX);
    routeByPath({
      act_1: { ok: true, data: { account_status: 1, currency: 'RON', spend_cap: '50000', amount_spent: '10000' } },
      'act_1/insights': {
        ok: true,
        data: { data: [{ spend: '100', actions: [{ action_type: 'offsite_conversion.fb_pixel_purchase', value: '4' }] }] },
      },
      'act_1/campaigns': { ok: true, data: { data: [{ id: 'c1', effective_status: 'ACTIVE' }] } },
    });

    const res = await getAdAccountHealth(PROPERTY);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.hasSpendLimit).toBe(true);
    expect(res.data.hasConversionHistory).toBe(true);
    expect(res.data.activeCampaignCount).toBe(1);
    expect(res.data.warnings).not.toContain('no-account-spend-limit');
    expect(res.data.warnings).not.toContain('no-conversion-optimized-history');
  });

  it('propagates an account read failure without throwing', async () => {
    mockResolveAdContext.mockResolvedValue(CTX);
    routeByPath({ act_1: { ok: false, error: 'bad-token' } });
    const res = await getAdAccountHealth(PROPERTY);
    expect(res).toEqual({ ok: false, error: 'bad-token' });
  });
});
