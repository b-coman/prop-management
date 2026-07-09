/** @jest-environment node */

// Mock resolution/config/Firestore layers; use the REAL client.ts (createResource
// / deleteResource / metaGraph) against a mocked global.fetch, so the PAUSED
// enforcement and exact payload shape are exercised end-to-end, not assumed.
jest.mock('../adContext', () => ({ resolveAdContext: jest.fn() }));
jest.mock('@/lib/meta-pixels', () => ({ getPixelIdForProperty: jest.fn() }));
jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'server-ts') },
}));

import { createCampaignChain } from '../campaignBuilder';
import { resolveAdContext } from '../adContext';
import { getPixelIdForProperty } from '@/lib/meta-pixels';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const mockResolveAdContext = resolveAdContext as jest.Mock;
const mockGetPixelIdForProperty = getPixelIdForProperty as jest.Mock;
const mockGetAdminDb = getAdminDb as jest.Mock;
const mockFetch = global.fetch as jest.Mock;

const PROPERTY = 'prahova-mountain-chalet';
const AD_ACCOUNT = 'act_543311232953437';
const PAGE_ID = '107610677616243';

/** Last path segment of a Graph API URL — 'campaigns' | 'adsets' | 'adcreatives' | 'ads' | a bare resource id (DELETE). */
function nodeFromUrl(urlStr: string): string {
  const parts = new URL(urlStr).pathname.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

function findCall(node: string): [string, RequestInit] {
  const call = mockFetch.mock.calls.find(([u]: [string, RequestInit]) => nodeFromUrl(String(u)) === node);
  if (!call) throw new Error(`no fetch call found for node: ${node}`);
  return call as [string, RequestInit];
}

function findDeleteCalls(): [string, RequestInit][] {
  return mockFetch.mock.calls.filter(
    ([, init]: [string, RequestInit]) => init?.method === 'DELETE'
  ) as [string, RequestInit][];
}

/** Wires mocked fetch to return a distinct id per Graph edge, and success for any DELETE. */
function mockMetaResponses() {
  mockFetch.mockImplementation(async (url: string, init: RequestInit) => {
    if ((init?.method ?? 'GET') === 'DELETE') {
      return { ok: true, json: async () => ({ success: true }) };
    }
    const node = nodeFromUrl(String(url));
    if (node === 'campaigns') return { ok: true, json: async () => ({ id: 'meta-campaign-1' }) };
    if (node === 'adsets') return { ok: true, json: async () => ({ id: 'meta-adset-1' }) };
    if (node === 'adcreatives') return { ok: true, json: async () => ({ id: 'meta-creative-1' }) };
    if (node === 'ads') return { ok: true, json: async () => ({ id: 'meta-ad-1' }) };
    return { ok: false, status: 404, text: async () => `unexpected node in test: ${node}` };
  });
}

function makeAdminDb() {
  const addMock = jest.fn().mockResolvedValue({ id: 'adcamp-doc-1' });
  const db = {
    collection: jest.fn((name: string) => {
      if (name === 'adCampaigns') return { add: addMock };
      throw new Error(`unexpected collection read in test: ${name}`);
    }),
  };
  return { db, addMock };
}

const CHAIN_SPEC = {
  campaign: { name: 'Test Campaign' },
  adSet: {
    name: 'Test Ad Set',
    dailyBudgetMinor: 5000, // 50 RON
    landingUrl: 'https://www.prahova-chalet.ro/book',
    targeting: { geo_locations: { countries: ['RO'] } },
  },
  creative: {
    name: 'Test Creative',
    link: 'https://prahova-chalet.ro/book?utm_source=facebook&utm_campaign=abc',
    message: 'Book your stay',
    imageHash: 'abc123hash',
  },
  ad: { name: 'Test Ad' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  delete process.env.GROWTH_ADS_ENABLED;
});

describe('createCampaignChain — dark-launch gate (master switch OFF by default)', () => {
  it('returns ads-engine-disabled and makes ZERO Meta calls / writes nothing to Firestore', async () => {
    const res = await createCampaignChain(PROPERTY, CHAIN_SPEC);
    expect(res).toEqual({ ok: false, error: 'ads-engine-disabled', stage: 'gate' });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockResolveAdContext).not.toHaveBeenCalled();
    expect(mockGetAdminDb).not.toHaveBeenCalled();
  });
});

describe('createCampaignChain — engine enabled', () => {
  beforeEach(() => {
    process.env.GROWTH_ADS_ENABLED = 'true';
    mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, pageId: PAGE_ID, token: 'tok' });
    mockGetPixelIdForProperty.mockResolvedValue('pixel-123');
    mockMetaResponses();
  });

  it('happy path: creates all four objects via createResource (PAUSED enforced), writes an adCampaigns doc, returns all ids', async () => {
    const { db, addMock } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    const res = await createCampaignChain(PROPERTY, CHAIN_SPEC);

    expect(res).toEqual({
      ok: true,
      campaignId: 'meta-campaign-1',
      adSetId: 'meta-adset-1',
      creativeId: 'meta-creative-1',
      adId: 'meta-ad-1',
      adCampaignId: 'adcamp-doc-1',
    });

    // exactly 4 creates, 0 rollback deletes
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(findDeleteCalls()).toHaveLength(0);

    // --- campaign payload ---
    const [campaignUrl, campaignInit] = findCall('campaigns');
    expect(String(campaignUrl)).toContain(`${AD_ACCOUNT}/campaigns`);
    expect(campaignInit.method).toBe('POST');
    const campaignBody = new URLSearchParams(campaignInit.body as string);
    expect(campaignBody.get('status')).toBe('PAUSED'); // createResource enforcement (Fable C2)
    expect(campaignBody.get('name')).toBe('Test Campaign');
    expect(campaignBody.get('objective')).toBe('OUTCOME_SALES');
    expect(JSON.parse(campaignBody.get('special_ad_categories') as string)).toEqual([]);
    expect(campaignBody.get('is_adset_budget_sharing_enabled')).toBe('false');

    // --- ad set payload ---
    const [, adSetInit] = findCall('adsets');
    const adSetBody = new URLSearchParams(adSetInit.body as string);
    expect(adSetBody.get('status')).toBe('PAUSED');
    expect(adSetBody.get('campaign_id')).toBe('meta-campaign-1');
    expect(adSetBody.get('billing_event')).toBe('IMPRESSIONS');
    expect(adSetBody.get('optimization_goal')).toBe('OFFSITE_CONVERSIONS');
    expect(adSetBody.get('bid_strategy')).toBe('LOWEST_COST_WITHOUT_CAP');
    expect(adSetBody.get('daily_budget')).toBe('5000');
    expect(adSetBody.get('conversion_domain')).toBe('prahova-chalet.ro'); // leading www. stripped
    expect(JSON.parse(adSetBody.get('promoted_object') as string)).toEqual({
      pixel_id: 'pixel-123',
      custom_event_type: 'PURCHASE',
    });

    // --- creative payload ---
    const [, creativeInit] = findCall('adcreatives');
    const creativeBody = new URLSearchParams(creativeInit.body as string);
    expect(creativeBody.get('status')).toBe('PAUSED');
    expect(JSON.parse(creativeBody.get('object_story_spec') as string)).toEqual({
      page_id: PAGE_ID,
      link_data: {
        link: CHAIN_SPEC.creative.link,
        message: CHAIN_SPEC.creative.message,
        image_hash: 'abc123hash',
        call_to_action: { type: 'LEARN_MORE' },
      },
    });

    // --- ad payload ---
    const [, adInit] = findCall('ads');
    const adBody = new URLSearchParams(adInit.body as string);
    expect(adBody.get('status')).toBe('PAUSED');
    expect(adBody.get('adset_id')).toBe('meta-adset-1');
    expect(JSON.parse(adBody.get('creative') as string)).toEqual({ creative_id: 'meta-creative-1' });

    // --- Firestore doc ---
    expect(addMock).toHaveBeenCalledTimes(1);
    const doc = addMock.mock.calls[0][0];
    expect(doc).toMatchObject({
      propertyId: PROPERTY,
      metaCampaignId: 'meta-campaign-1',
      metaAdSetIds: ['meta-adset-1'],
      metaAdIds: ['meta-ad-1'],
      objective: 'OUTCOME_SALES',
      dailyBudgetMinor: 5000,
      creativeRef: 'meta-creative-1',
      status: 'draft',
    });
    // CRITICAL invariant: never activatable straight out of creation.
    expect(doc).not.toHaveProperty('spendCapMinor');
    expect(doc.status).not.toBe('approved');
  });

  it('pixel missing → adSet stage fails with no-pixel, rolls back the campaign', async () => {
    mockGetPixelIdForProperty.mockResolvedValue(undefined);
    const { db, addMock } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    const res = await createCampaignChain(PROPERTY, CHAIN_SPEC);
    expect(res).toEqual({ ok: false, error: 'no-pixel', stage: 'adSet' });

    // campaign create + campaign delete only
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const deletes = findDeleteCalls();
    expect(deletes).toHaveLength(1);
    expect(String(deletes[0][0])).toContain('meta-campaign-1');
    expect(addMock).not.toHaveBeenCalled();
  });

  it('malformed landingUrl → adSet stage fails with invalid-landing-url (no throw), rolls back the campaign', async () => {
    // A scheme-less URL makes new URL() throw; the guard must convert that into
    // a clean {ok:false} so the throw never escapes and the campaign is rolled back.
    const badSpec = {
      ...CHAIN_SPEC,
      adSet: { ...CHAIN_SPEC.adSet, landingUrl: 'prahova-chalet.ro/book' },
    };
    const { db, addMock } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    const res = await createCampaignChain(PROPERTY, badSpec);
    expect(res).toEqual({ ok: false, error: 'invalid-landing-url', stage: 'adSet' });

    // campaign created, then adSet create SHORT-CIRCUITS before any Meta call,
    // so only the campaign create + its rollback delete hit fetch.
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const deletes = findDeleteCalls();
    expect(deletes).toHaveLength(1);
    expect(String(deletes[0][0])).toContain('meta-campaign-1');
    expect(addMock).not.toHaveBeenCalled();
  });

  it('page missing → creative stage fails with no-page, rolls back adSet then campaign (reverse order)', async () => {
    mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, token: 'tok' }); // no pageId
    const { db, addMock } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    const res = await createCampaignChain(PROPERTY, CHAIN_SPEC);
    expect(res).toEqual({ ok: false, error: 'no-page', stage: 'creative' });

    // campaign create + adset create + 2 rollback deletes
    expect(mockFetch).toHaveBeenCalledTimes(4);
    const deletes = findDeleteCalls();
    expect(deletes).toHaveLength(2);
    expect(String(deletes[0][0])).toContain('meta-adset-1'); // most-dependent-first
    expect(String(deletes[1][0])).toContain('meta-campaign-1');
    expect(addMock).not.toHaveBeenCalled();
  });

  it('no ad context → fails at the context stage before any Meta call', async () => {
    mockResolveAdContext.mockResolvedValue(null);
    const res = await createCampaignChain(PROPERTY, CHAIN_SPEC);
    expect(res).toEqual({ ok: false, error: 'no-ad-context', stage: 'context' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('ad stage failure rolls back creative, adSet, and campaign (reverse order)', async () => {
    mockFetch.mockImplementation(async (url: string, init: RequestInit) => {
      if ((init?.method ?? 'GET') === 'DELETE') return { ok: true, json: async () => ({ success: true }) };
      const node = nodeFromUrl(String(url));
      if (node === 'campaigns') return { ok: true, json: async () => ({ id: 'meta-campaign-1' }) };
      if (node === 'adsets') return { ok: true, json: async () => ({ id: 'meta-adset-1' }) };
      if (node === 'adcreatives') return { ok: true, json: async () => ({ id: 'meta-creative-1' }) };
      if (node === 'ads') return { ok: false, status: 400, text: async () => 'ad creation rejected' };
      return { ok: false, status: 404, text: async () => `unexpected node: ${node}` };
    });
    const { db, addMock } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    const res = await createCampaignChain(PROPERTY, CHAIN_SPEC);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.stage).toBe('ad');

    const deletes = findDeleteCalls();
    expect(deletes).toHaveLength(3);
    expect(String(deletes[0][0])).toContain('meta-creative-1');
    expect(String(deletes[1][0])).toContain('meta-adset-1');
    expect(String(deletes[2][0])).toContain('meta-campaign-1');
    expect(addMock).not.toHaveBeenCalled();
  });

  it('Firestore write failure rolls back the full chain (ad, creative, adSet, campaign)', async () => {
    mockGetAdminDb.mockRejectedValue(new Error('firestore unavailable'));

    const res = await createCampaignChain(PROPERTY, CHAIN_SPEC);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.stage).toBe('firestore');

    const deletes = findDeleteCalls();
    expect(deletes).toHaveLength(4);
    expect(String(deletes[0][0])).toContain('meta-ad-1');
    expect(String(deletes[1][0])).toContain('meta-creative-1');
    expect(String(deletes[2][0])).toContain('meta-adset-1');
    expect(String(deletes[3][0])).toContain('meta-campaign-1');
  });
});
