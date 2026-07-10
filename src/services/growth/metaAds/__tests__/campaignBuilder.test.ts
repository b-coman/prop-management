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
  const createMock = jest.fn().mockResolvedValue(undefined);
  const docMock = jest.fn((_id: string) => ({ create: createMock }));
  const db = {
    collection: jest.fn((name: string) => {
      if (name === 'adCampaigns') return { add: addMock, doc: docMock };
      throw new Error(`unexpected collection read in test: ${name}`);
    }),
  };
  return { db, addMock, createMock, docMock };
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
    imageHashes: ['abc123hash'],
    copy: [{ primary: 'Book your stay' }],
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
        message: CHAIN_SPEC.creative.copy[0].primary,
        image_hash: 'abc123hash',
        call_to_action: { type: 'LEARN_MORE' },
        use_flexible_image_aspect_ratio: true,
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
      assetHashes: ['abc123hash'],
      imageCount: 1,
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

  it('threads instagram_user_id + headline (link_data.name) when the context/spec provide them (§9d)', async () => {
    mockResolveAdContext.mockResolvedValue({
      adAccountId: AD_ACCOUNT,
      pageId: PAGE_ID,
      instagramActorId: '17841435421272996',
      token: 'tok',
    });
    const { db } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    const specWithHeadline = {
      ...CHAIN_SPEC,
      creative: { ...CHAIN_SPEC.creative, copy: [{ primary: CHAIN_SPEC.creative.copy[0].primary, headline: 'Book your escape' }] },
    };
    await createCampaignChain(PROPERTY, specWithHeadline);

    const [, creativeInit] = findCall('adcreatives');
    const creativeBody = new URLSearchParams(creativeInit.body as string);
    expect(JSON.parse(creativeBody.get('object_story_spec') as string)).toEqual({
      page_id: PAGE_ID,
      instagram_user_id: '17841435421272996',
      link_data: {
        link: CHAIN_SPEC.creative.link,
        message: CHAIN_SPEC.creative.copy[0].primary,
        image_hash: 'abc123hash',
        call_to_action: { type: 'LEARN_MORE' },
        use_flexible_image_aspect_ratio: true,
        name: 'Book your escape',
      },
    });
  });

  it('threads adSet end_time/start_time when supplied (§9d — the 2a spend bound, B2)', async () => {
    const { db } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    const specWithEndTime = {
      ...CHAIN_SPEC,
      adSet: { ...CHAIN_SPEC.adSet, startTime: '2026-07-10T00:00:00Z', endTime: '2026-07-17T00:00:00Z' },
    };
    await createCampaignChain(PROPERTY, specWithEndTime);

    const [, adSetInit] = findCall('adsets');
    const adSetBody = new URLSearchParams(adSetInit.body as string);
    expect(adSetBody.get('start_time')).toBe('2026-07-10T00:00:00Z');
    expect(adSetBody.get('end_time')).toBe('2026-07-17T00:00:00Z');
  });

  it('omits end_time/start_time entirely when not supplied (backward compatible)', async () => {
    const { db } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    await createCampaignChain(PROPERTY, CHAIN_SPEC);

    const [, adSetInit] = findCall('adsets');
    const adSetBody = new URLSearchParams(adSetInit.body as string);
    expect(adSetBody.has('start_time')).toBe(false);
    expect(adSetBody.has('end_time')).toBe(false);
  });

  it('threads a caller-supplied campaign objective (defaults to OUTCOME_SALES otherwise)', async () => {
    const { db } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    const specWithObjective = { ...CHAIN_SPEC, campaign: { ...CHAIN_SPEC.campaign, objective: 'OUTCOME_TRAFFIC' } };
    await createCampaignChain(PROPERTY, specWithObjective);

    const [, campaignInit] = findCall('campaigns');
    const campaignBody = new URLSearchParams(campaignInit.body as string);
    expect(campaignBody.get('objective')).toBe('OUTCOME_TRAFFIC');
  });
});

describe('createCampaignChain — optional pre-allocated adCampaignId (plan REVISIONS B5)', () => {
  beforeEach(() => {
    process.env.GROWTH_ADS_ENABLED = 'true';
    mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, pageId: PAGE_ID, token: 'tok' });
    mockGetPixelIdForProperty.mockResolvedValue('pixel-123');
    mockMetaResponses();
  });

  it('writes via db.collection("adCampaigns").doc(id).create() — NOT .add() — when an id is supplied', async () => {
    const { db, addMock, createMock, docMock } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    const res = await createCampaignChain(PROPERTY, CHAIN_SPEC, 'pre-allocated-id-1');

    expect(res).toMatchObject({ ok: true, adCampaignId: 'pre-allocated-id-1' });
    expect(docMock).toHaveBeenCalledWith('pre-allocated-id-1');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0]).toMatchObject({
      propertyId: PROPERTY,
      metaCampaignId: 'meta-campaign-1',
      status: 'draft',
    });
    expect(addMock).not.toHaveBeenCalled(); // never falls back to .add() when an id is given
  });

  it('keeps the exact .add() behavior when NO id is supplied (backward-compatible, Phase-1 harness)', async () => {
    const { db, addMock, createMock } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    const res = await createCampaignChain(PROPERTY, CHAIN_SPEC);

    expect(res).toMatchObject({ ok: true, adCampaignId: 'adcamp-doc-1' });
    expect(addMock).toHaveBeenCalledTimes(1);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('a double-submit (.create() rejects with already-exists) rolls back the full Meta chain like any other Firestore-stage failure', async () => {
    const addMock = jest.fn();
    const createMock = jest.fn().mockRejectedValue(new Error('ALREADY_EXISTS: document already exists'));
    const docMock = jest.fn(() => ({ create: createMock }));
    const db = {
      collection: jest.fn((name: string) => {
        if (name === 'adCampaigns') return { add: addMock, doc: docMock };
        throw new Error(`unexpected collection read in test: ${name}`);
      }),
    };
    mockGetAdminDb.mockResolvedValue(db);

    const res = await createCampaignChain(PROPERTY, CHAIN_SPEC, 'retried-id');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.stage).toBe('firestore');
      expect(res.error).toContain('ALREADY_EXISTS');
    }

    const deletes = findDeleteCalls();
    expect(deletes).toHaveLength(4); // full chain rolled back, same as any other Firestore-stage failure
  });
});

describe('createCampaignChain — Phase 2b: advantage_audience default + single-vs-dynamic branch (§9f)', () => {
  beforeEach(() => {
    process.env.GROWTH_ADS_ENABLED = 'true';
    mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, pageId: PAGE_ID, token: 'tok' });
    mockGetPixelIdForProperty.mockResolvedValue('pixel-123');
    mockMetaResponses();
  });

  it('defaults targeting_automation.advantage_audience to 1 (flipped from 0) and sends NO age fields', async () => {
    const { db } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    await createCampaignChain(PROPERTY, CHAIN_SPEC);

    const [, adSetInit] = findCall('adsets');
    const adSetBody = new URLSearchParams(adSetInit.body as string);
    const targeting = JSON.parse(adSetBody.get('targeting') as string);
    expect(targeting.targeting_automation).toEqual({ advantage_audience: 1 });
    expect(targeting).not.toHaveProperty('age_min');
    expect(targeting).not.toHaveProperty('age_max');
  });

  it('a caller-supplied targeting_automation overrides the advantage_audience default', async () => {
    const { db } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    const specWithOverride = {
      ...CHAIN_SPEC,
      adSet: {
        ...CHAIN_SPEC.adSet,
        targeting: {
          geo_locations: { countries: ['RO'] },
          targeting_automation: { advantage_audience: 0 },
          age_min: 30,
          age_max: 45,
        },
      },
    };
    await createCampaignChain(PROPERTY, specWithOverride);

    const [, adSetInit] = findCall('adsets');
    const adSetBody = new URLSearchParams(adSetInit.body as string);
    const targeting = JSON.parse(adSetBody.get('targeting') as string);
    expect(targeting.targeting_automation).toEqual({ advantage_audience: 0 });
    expect(targeting.age_min).toBe(30);
    expect(targeting.age_max).toBe(45);
  });

  it('passes a caller-built geo_locations.cities + location_types through unchanged (§9f — campaignBuilder is opaque passthrough)', async () => {
    const { db } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    const specWithCities = {
      ...CHAIN_SPEC,
      adSet: {
        ...CHAIN_SPEC.adSet,
        targeting: {
          geo_locations: {
            cities: [{ key: '1910415', radius: 25, distance_unit: 'kilometer' }],
            location_types: ['home', 'recent'],
          },
        },
      },
    };
    await createCampaignChain(PROPERTY, specWithCities);

    const [, adSetInit] = findCall('adsets');
    const adSetBody = new URLSearchParams(adSetInit.body as string);
    const targeting = JSON.parse(adSetBody.get('targeting') as string);
    expect(targeting.geo_locations).toEqual({
      cities: [{ key: '1910415', radius: 25, distance_unit: 'kilometer' }],
      location_types: ['home', 'recent'],
    });
  });

  it('single image + single copy variant: NO is_dynamic_creative on the ad set, object_story_spec/link_data on the creative (byte-for-byte pre-2b shape)', async () => {
    const { db } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    await createCampaignChain(PROPERTY, CHAIN_SPEC);

    const [, adSetInit] = findCall('adsets');
    const adSetBody = new URLSearchParams(adSetInit.body as string);
    expect(adSetBody.has('is_dynamic_creative')).toBe(false);

    const [, creativeInit] = findCall('adcreatives');
    const creativeBody = new URLSearchParams(creativeInit.body as string);
    expect(creativeBody.has('asset_feed_spec')).toBe(false);
    const objectStorySpec = JSON.parse(creativeBody.get('object_story_spec') as string);
    expect(objectStorySpec.link_data).toBeDefined();
  });

  it('2+ images: is_dynamic_creative:true on the ad set, asset_feed_spec (NO link_data) on the creative, ALL image hashes present, Firestore doc records them', async () => {
    const { db, addMock } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    const dynamicSpec = {
      ...CHAIN_SPEC,
      creative: {
        ...CHAIN_SPEC.creative,
        imageHashes: ['hash-1', 'hash-2', 'hash-3'],
        copy: [{ primary: 'Escape to the mountains', headline: 'Mountain Chalet' }],
      },
    };
    await createCampaignChain(PROPERTY, dynamicSpec);

    const [, adSetInit] = findCall('adsets');
    const adSetBody = new URLSearchParams(adSetInit.body as string);
    expect(adSetBody.get('is_dynamic_creative')).toBe('true');

    const [, creativeInit] = findCall('adcreatives');
    const creativeBody = new URLSearchParams(creativeInit.body as string);
    const objectStorySpec = JSON.parse(creativeBody.get('object_story_spec') as string);
    expect(objectStorySpec).not.toHaveProperty('link_data');
    const assetFeedSpec = JSON.parse(creativeBody.get('asset_feed_spec') as string);
    expect(assetFeedSpec.images).toEqual([{ hash: 'hash-1' }, { hash: 'hash-2' }, { hash: 'hash-3' }]);
    expect(assetFeedSpec.bodies).toEqual([{ text: 'Escape to the mountains' }]);
    expect(assetFeedSpec.titles).toEqual([{ text: 'Mountain Chalet' }]);
    expect(assetFeedSpec.link_urls).toEqual([{ website_url: CHAIN_SPEC.creative.link }]);
    expect(assetFeedSpec.call_to_action_types).toEqual(['LEARN_MORE']);
    expect(assetFeedSpec.ad_formats).toEqual(['AUTOMATIC_FORMAT']);

    const doc = addMock.mock.calls[0][0];
    expect(doc.assetHashes).toEqual(['hash-1', 'hash-2', 'hash-3']);
    expect(doc.imageCount).toBe(3);
  });

  it('2+ copy variants (single image) also triggers the dynamic path, with titles[] falling back to body text when no headline is given', async () => {
    const { db, addMock } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    const dynamicCopySpec = {
      ...CHAIN_SPEC,
      creative: {
        ...CHAIN_SPEC.creative,
        imageHashes: ['abc123hash'],
        copy: [{ primary: 'Variant A' }, { primary: 'Variant B', headline: 'B headline' }],
      },
    };
    await createCampaignChain(PROPERTY, dynamicCopySpec);

    const [, adSetInit] = findCall('adsets');
    expect(new URLSearchParams(adSetInit.body as string).get('is_dynamic_creative')).toBe('true');

    const [, creativeInit] = findCall('adcreatives');
    const assetFeedSpec = JSON.parse(new URLSearchParams(creativeInit.body as string).get('asset_feed_spec') as string);
    expect(assetFeedSpec.bodies).toEqual([{ text: 'Variant A' }, { text: 'Variant B' }]);
    expect(assetFeedSpec.titles).toEqual([{ text: 'Variant A' }, { text: 'B headline' }]); // no-headline variant falls back to its own body text

    const doc = addMock.mock.calls[0][0];
    expect(doc.assetHashes).toEqual(['abc123hash']);
    expect(doc.imageCount).toBe(1);
  });

  it('dedups duplicate asset values (shared headline / repeated image) so Meta does not reject with err 1815809', async () => {
    const { db } = makeAdminDb();
    mockGetAdminDb.mockResolvedValue(db);

    const dupSpec = {
      ...CHAIN_SPEC,
      creative: {
        ...CHAIN_SPEC.creative,
        imageHashes: ['hash-1', 'hash-2', 'hash-1'], // duplicate image
        copy: [
          { primary: 'Body A', headline: 'Same headline' },
          { primary: 'Body B', headline: 'Same headline' }, // shared headline
        ],
      },
    };
    await createCampaignChain(PROPERTY, dupSpec);

    const [, creativeInit] = findCall('adcreatives');
    const assetFeedSpec = JSON.parse(new URLSearchParams(creativeInit.body as string).get('asset_feed_spec') as string);
    expect(assetFeedSpec.images).toEqual([{ hash: 'hash-1' }, { hash: 'hash-2' }]); // dup hash collapsed
    expect(assetFeedSpec.bodies).toEqual([{ text: 'Body A' }, { text: 'Body B' }]); // distinct bodies kept
    expect(assetFeedSpec.titles).toEqual([{ text: 'Same headline' }]); // shared headline collapsed to ONE title
  });
});
