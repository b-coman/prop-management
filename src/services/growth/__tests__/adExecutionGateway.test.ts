/** @jest-environment node */

// Mock the Admin SDK and the metaAds modules BEFORE importing the SUT.
jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'server-ts') },
}));
jest.mock('@/services/growth/metaAds/adContext', () => ({ resolveAdContext: jest.fn() }));
jest.mock('@/services/growth/metaAds/client', () => ({ metaGraph: jest.fn(), activateResource: jest.fn() }));

import { activateCampaign } from '../adExecutionGateway';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { resolveAdContext } from '@/services/growth/metaAds/adContext';
import { metaGraph, activateResource } from '@/services/growth/metaAds/client';

const mockGetAdminDb = getAdminDb as jest.Mock;
const mockResolveAdContext = resolveAdContext as jest.Mock;
const mockMetaGraph = metaGraph as jest.Mock;
const mockActivateResource = activateResource as jest.Mock;

function chainableGet(result: unknown) {
  const q: Record<string, jest.Mock> = {};
  q.where = jest.fn(() => q);
  q.limit = jest.fn(() => q);
  q.get = jest.fn().mockResolvedValue(result);
  return q;
}

function makeDb(adCampaignsResult: unknown) {
  const addMock = jest.fn().mockResolvedValue({ id: 'audit-1' });
  const adCampaignsQuery = chainableGet(adCampaignsResult);
  const db = {
    collection: jest.fn((name: string) => {
      if (name === 'adCampaigns') return adCampaignsQuery;
      if (name === 'adAuditLog') return { add: addMock };
      throw new Error(`unexpected collection read in test: ${name}`);
    }),
  };
  return { db, addMock };
}

function approvedSnap(overrides: Record<string, unknown> = {}) {
  return {
    empty: false,
    docs: [
      {
        data: () => ({
          propertyId: 'prahova-mountain-chalet',
          metaCampaignId: 'camp-1',
          status: 'approved',
          spendCapMinor: 50000, // 500 RON
          ...overrides,
        }),
      },
    ],
  };
}

const PROPERTY = 'prahova-mountain-chalet';
const CAMPAIGN = 'camp-1';
const AD_ACCOUNT = 'act_543311232953437';

beforeEach(() => {
  jest.clearAllMocks();
  // Enforce DARK LAUNCH default (both switches off) unless a test overrides it.
  delete process.env.GROWTH_ADS_ENABLED;
  delete process.env.GROWTH_ADS_MODE;
});

describe('activateCampaign — dry-run gate (Fable H5, default OFF)', () => {
  it('is a no-op live-action by default: no context/Meta calls, status=dry-run, audited', async () => {
    const { db, addMock } = makeDb(approvedSnap());
    mockGetAdminDb.mockResolvedValue(db);

    const res = await activateCampaign(PROPERTY, CAMPAIGN);

    expect(res).toEqual({ status: 'dry-run' });
    expect(mockResolveAdContext).not.toHaveBeenCalled();
    expect(mockMetaGraph).not.toHaveBeenCalled();
    expect(mockActivateResource).not.toHaveBeenCalled();
    expect(addMock).toHaveBeenCalledTimes(1);
    expect(addMock.mock.calls[0][0]).toMatchObject({ result: 'dry-run' });
  });

  it('stays dry-run with only GROWTH_ADS_ENABLED set (mode not live)', async () => {
    process.env.GROWTH_ADS_ENABLED = 'true';
    const { db } = makeDb(approvedSnap());
    mockGetAdminDb.mockResolvedValue(db);

    const res = await activateCampaign(PROPERTY, CAMPAIGN);
    expect(res.status).toBe('dry-run');
    expect(mockActivateResource).not.toHaveBeenCalled();
  });
});

describe('activateCampaign — live mode (both switches on)', () => {
  beforeEach(() => {
    process.env.GROWTH_ADS_ENABLED = 'true';
    process.env.GROWTH_ADS_MODE = 'live';
  });

  it('rejects when no adCampaigns doc exists for property+campaign', async () => {
    const { db, addMock } = makeDb({ empty: true, docs: [] });
    mockGetAdminDb.mockResolvedValue(db);

    const res = await activateCampaign(PROPERTY, CAMPAIGN);
    expect(res).toEqual({ status: 'rejected', reason: 'no-adCampaigns-doc' });
    expect(mockResolveAdContext).not.toHaveBeenCalled();
    expect(addMock.mock.calls[0][0]).toMatchObject({ result: 'rejected', reason: 'no-adCampaigns-doc' });
  });

  it('rejects an unapproved campaign (e.g. pending_approval)', async () => {
    const { db } = makeDb(approvedSnap({ status: 'pending_approval' }));
    mockGetAdminDb.mockResolvedValue(db);

    const res = await activateCampaign(PROPERTY, CAMPAIGN);
    expect(res).toEqual({ status: 'rejected', reason: 'not-approved:pending_approval' });
    expect(mockActivateResource).not.toHaveBeenCalled();
  });

  it('rejects an approved campaign with NO spend cap snapshotted (M3/M4)', async () => {
    const { db } = makeDb(approvedSnap({ spendCapMinor: undefined }));
    mockGetAdminDb.mockResolvedValue(db);

    const res = await activateCampaign(PROPERTY, CAMPAIGN);
    expect(res).toEqual({ status: 'rejected', reason: 'no-spend-cap' });
    expect(mockActivateResource).not.toHaveBeenCalled();
  });

  it('rejects an approved campaign with spendCapMinor <= 0', async () => {
    const { db } = makeDb(approvedSnap({ spendCapMinor: 0 }));
    mockGetAdminDb.mockResolvedValue(db);

    const res = await activateCampaign(PROPERTY, CAMPAIGN);
    expect(res).toEqual({ status: 'rejected', reason: 'no-spend-cap' });
  });

  it('rejects when the property has no ad context (unconfigured)', async () => {
    const { db } = makeDb(approvedSnap());
    mockGetAdminDb.mockResolvedValue(db);
    mockResolveAdContext.mockResolvedValue(null);

    const res = await activateCampaign(PROPERTY, CAMPAIGN);
    expect(res).toEqual({ status: 'rejected', reason: 'no-ad-context' });
    expect(mockMetaGraph).not.toHaveBeenCalled();
  });

  it('rejects on OWNERSHIP MISMATCH — the shared-token adversary (Fable H2)', async () => {
    const { db, addMock } = makeDb(approvedSnap());
    mockGetAdminDb.mockResolvedValue(db);
    mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, token: 'shared-agency-token' });
    // The Meta campaign fetched back belongs to a DIFFERENT ad account —
    // simulates activate(propertyA, campaignOfPropertyB) under a shared token.
    mockMetaGraph.mockResolvedValue({ ok: true, data: { id: CAMPAIGN, account_id: '999999999999999' } });

    const res = await activateCampaign(PROPERTY, CAMPAIGN);
    expect(res).toEqual({ status: 'rejected', reason: 'ownership-mismatch' });
    expect(mockActivateResource).not.toHaveBeenCalled();
    expect(addMock.mock.calls.at(-1)?.[0]).toMatchObject({ result: 'rejected', reason: 'ownership-mismatch' });
  });

  it('rejects when the Meta campaign fetch itself fails', async () => {
    const { db } = makeDb(approvedSnap());
    mockGetAdminDb.mockResolvedValue(db);
    mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, token: 'tok' });
    mockMetaGraph.mockResolvedValue({ ok: false, error: 'timeout' });

    const res = await activateCampaign(PROPERTY, CAMPAIGN);
    expect(res).toEqual({ status: 'rejected', reason: 'campaign-fetch-failed:timeout' });
    expect(mockActivateResource).not.toHaveBeenCalled();
  });

  it('activates when every gate passes, normalizing the act_ prefix for the ownership check', async () => {
    const { db, addMock } = makeDb(approvedSnap());
    mockGetAdminDb.mockResolvedValue(db);
    mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, token: 'tok' });
    // Meta's read-back omits the "act_" prefix on account_id — must still match.
    mockMetaGraph.mockResolvedValue({ ok: true, data: { id: CAMPAIGN, account_id: '543311232953437' } });
    mockActivateResource.mockResolvedValue({ ok: true, data: { success: true } });

    const res = await activateCampaign(PROPERTY, CAMPAIGN, { actor: 'operator-1' });
    expect(res).toEqual({ status: 'activated' });
    expect(mockActivateResource).toHaveBeenCalledWith(CAMPAIGN, 'tok', PROPERTY);
    expect(addMock.mock.calls.at(-1)?.[0]).toMatchObject({ result: 'activated', actor: 'operator-1' });
  });

  it('rejects (does not throw) when the un-pause call itself fails', async () => {
    const { db } = makeDb(approvedSnap());
    mockGetAdminDb.mockResolvedValue(db);
    mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, token: 'tok' });
    mockMetaGraph.mockResolvedValue({ ok: true, data: { id: CAMPAIGN, account_id: '543311232953437' } });
    mockActivateResource.mockResolvedValue({ ok: false, error: 'meta-down' });

    const res = await activateCampaign(PROPERTY, CAMPAIGN);
    expect(res).toEqual({ status: 'rejected', reason: 'activate-failed:meta-down' });
  });
});
