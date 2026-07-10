/** @jest-environment node */

// Mock the Admin SDK and the metaAds modules BEFORE importing the SUT.
jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'server-ts') },
}));
jest.mock('@/services/growth/metaAds/adContext', () => ({ resolveAdContext: jest.fn() }));
jest.mock('@/services/growth/metaAds/client', () => ({
  metaGraph: jest.fn(),
  activateResource: jest.fn(),
  pauseResource: jest.fn(),
}));

import { activateCampaign } from '../adExecutionGateway';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { resolveAdContext } from '@/services/growth/metaAds/adContext';
import { metaGraph, activateResource, pauseResource } from '@/services/growth/metaAds/client';

const mockGetAdminDb = getAdminDb as jest.Mock;
const mockResolveAdContext = resolveAdContext as jest.Mock;
const mockMetaGraph = metaGraph as jest.Mock;
const mockActivateResource = activateResource as jest.Mock;
const mockPauseResource = pauseResource as jest.Mock;

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

/**
 * `docs[0].ref.update` is a FRESH jest.fn() per call — callers that need to
 * assert on the Firestore status write grab it straight off the returned
 * snapshot object (`snap.docs[0].ref.update`), same reference the gateway
 * calls internally via `campaignDocSnap.ref.update(...)`.
 */
function approvedSnap(overrides: Record<string, unknown> = {}) {
  return {
    empty: false,
    docs: [
      {
        data: () => ({
          propertyId: 'prahova-mountain-chalet',
          metaCampaignId: 'camp-1',
          metaAdSetIds: ['adset-1'],
          metaAdIds: ['ad-1'],
          status: 'approved',
          spendCapMinor: 50000, // 500 RON
          ...overrides,
        }),
        ref: { update: jest.fn().mockResolvedValue(undefined) },
      },
    ],
  };
}

const PROPERTY = 'prahova-mountain-chalet';
const CAMPAIGN = 'camp-1';
const AD_ACCOUNT = 'act_543311232953437';

/** Ownership-fetch AND post-activation read-back both resolve from one mock, keyed by the `fields` requested. */
function mockMetaGraphReadBacks(opts?: { accountId?: string; effectiveStatus?: string | false }) {
  const accountId = opts?.accountId ?? '543311232953437';
  const effectiveStatus = opts?.effectiveStatus ?? 'ACTIVE';
  mockMetaGraph.mockImplementation(async (_id: string, callOpts: { params?: Record<string, unknown> }) => {
    const fields = callOpts.params?.fields;
    if (fields === 'id,account_id') {
      return { ok: true, data: { id: CAMPAIGN, account_id: accountId } };
    }
    if (fields === 'id,effective_status') {
      if (effectiveStatus === false) return { ok: false, error: 'read-back-failed' };
      return { ok: true, data: { id: CAMPAIGN, effective_status: effectiveStatus } };
    }
    throw new Error(`unexpected metaGraph call in test, fields=${String(fields)}`);
  });
}

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

  describe('B1 — activates ALL THREE hierarchy levels', () => {
    it('activates campaign, then every ad set, then every ad (top-down, in order)', async () => {
      const snap = approvedSnap();
      const { db, addMock } = makeDb(snap);
      mockGetAdminDb.mockResolvedValue(db);
      mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, token: 'tok' });
      mockMetaGraphReadBacks();
      mockActivateResource.mockResolvedValue({ ok: true, data: { success: true } });

      const res = await activateCampaign(PROPERTY, CAMPAIGN, { actor: 'operator-1' });

      expect(res).toEqual({ status: 'activated' });
      expect(mockActivateResource).toHaveBeenCalledTimes(3);
      expect(mockActivateResource).toHaveBeenNthCalledWith(1, 'camp-1', 'tok', PROPERTY);
      expect(mockActivateResource).toHaveBeenNthCalledWith(2, 'adset-1', 'tok', PROPERTY);
      expect(mockActivateResource).toHaveBeenNthCalledWith(3, 'ad-1', 'tok', PROPERTY);
      expect(mockPauseResource).not.toHaveBeenCalled(); // no rollback needed
      expect(addMock.mock.calls.at(-1)?.[0]).toMatchObject({ result: 'activated', actor: 'operator-1' });
    });

    it('activates every id across MULTIPLE ad sets/ads', async () => {
      const snap = approvedSnap({ metaAdSetIds: ['as-1', 'as-2'], metaAdIds: ['ad-1', 'ad-2'] });
      const { db } = makeDb(snap);
      mockGetAdminDb.mockResolvedValue(db);
      mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, token: 'tok' });
      mockMetaGraphReadBacks();
      mockActivateResource.mockResolvedValue({ ok: true, data: { success: true } });

      const res = await activateCampaign(PROPERTY, CAMPAIGN);
      expect(res).toEqual({ status: 'activated' });
      expect(mockActivateResource).toHaveBeenCalledTimes(5);
      const idsInOrder = mockActivateResource.mock.calls.map((c) => c[0]);
      expect(idsInOrder).toEqual(['camp-1', 'as-1', 'as-2', 'ad-1', 'ad-2']);
    });

    it('a failure at the AD-SET level rolls back (re-pauses) only the campaign, reverse order, then rejects', async () => {
      const snap = approvedSnap();
      const { db, addMock } = makeDb(snap);
      mockGetAdminDb.mockResolvedValue(db);
      mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, token: 'tok' });
      mockMetaGraphReadBacks();
      mockActivateResource.mockImplementation(async (id: string) => {
        if (id === 'camp-1') return { ok: true, data: { success: true } };
        return { ok: false, error: 'adset-rejected' }; // adset-1 fails
      });
      mockPauseResource.mockResolvedValue({ ok: true, data: { success: true } });

      const res = await activateCampaign(PROPERTY, CAMPAIGN);

      expect(res).toEqual({ status: 'rejected', reason: 'activate-failed:adSet:adset-1:adset-rejected' });
      expect(mockPauseResource).toHaveBeenCalledTimes(1);
      expect(mockPauseResource).toHaveBeenCalledWith('camp-1', 'tok', PROPERTY); // rolled back
      expect(mockActivateResource).toHaveBeenCalledTimes(2); // campaign (succeeded) + adset-1 (failed); ad-1 never attempted
      expect(snap.docs[0].ref.update).not.toHaveBeenCalled(); // never claims 'active'
      expect(addMock.mock.calls.at(-1)?.[0]).toMatchObject({
        result: 'rejected',
        reason: 'activate-failed:adSet:adset-1:adset-rejected',
      });
    });

    it('a failure at the AD level rolls back the ad set then the campaign (reverse order)', async () => {
      const snap = approvedSnap();
      const { db } = makeDb(snap);
      mockGetAdminDb.mockResolvedValue(db);
      mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, token: 'tok' });
      mockMetaGraphReadBacks();
      mockActivateResource.mockImplementation(async (id: string) => {
        if (id === 'ad-1') return { ok: false, error: 'ad-rejected' };
        return { ok: true, data: { success: true } };
      });
      mockPauseResource.mockResolvedValue({ ok: true, data: { success: true } });

      const res = await activateCampaign(PROPERTY, CAMPAIGN);

      expect(res).toEqual({ status: 'rejected', reason: 'activate-failed:ad:ad-1:ad-rejected' });
      expect(mockPauseResource).toHaveBeenCalledTimes(2);
      // reverse order: most-recently-activated (adset) first, then campaign
      expect(mockPauseResource).toHaveBeenNthCalledWith(1, 'adset-1', 'tok', PROPERTY);
      expect(mockPauseResource).toHaveBeenNthCalledWith(2, 'camp-1', 'tok', PROPERTY);
    });

    it('a rollback pause failure surfaces a louder ROLLBACK-INCOMPLETE reason (chain left partially active) but still resolves and rejects', async () => {
      const snap = approvedSnap();
      const { db } = makeDb(snap);
      mockGetAdminDb.mockResolvedValue(db);
      mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, token: 'tok' });
      mockMetaGraphReadBacks();
      mockActivateResource.mockImplementation(async (id: string) => {
        if (id === 'ad-1') return { ok: false, error: 'ad-rejected' };
        return { ok: true, data: { success: true } };
      });
      mockPauseResource.mockResolvedValue({ ok: false, error: 'pause-also-failed' });

      const res = await activateCampaign(PROPERTY, CAMPAIGN);
      // campaign + adset were flipped, ad failed, and BOTH re-pauses failed → 2 still active.
      expect(res).toEqual({
        status: 'rejected',
        reason: 'activate-failed-ROLLBACK-INCOMPLETE(2-still-active):ad:ad-1:ad-rejected',
      });
    });
  });

  describe('incomplete-chain guard — refuse to activate a campaign that cannot deliver', () => {
    it('rejects with incomplete-chain when the doc has no adSet ids (would activate only the campaign)', async () => {
      const snap = approvedSnap({ metaAdSetIds: [], metaAdIds: ['ad-1'] });
      const { db } = makeDb(snap);
      mockGetAdminDb.mockResolvedValue(db);

      const res = await activateCampaign(PROPERTY, CAMPAIGN);
      expect(res).toEqual({ status: 'rejected', reason: 'incomplete-chain:missing-adset-or-ad-ids' });
      // fails before touching Meta (no ownership fetch, no activate)
      expect(mockActivateResource).not.toHaveBeenCalled();
    });

    it('rejects with incomplete-chain when the doc has no ad ids', async () => {
      const snap = approvedSnap({ metaAdSetIds: ['adset-1'], metaAdIds: [] });
      const { db } = makeDb(snap);
      mockGetAdminDb.mockResolvedValue(db);

      const res = await activateCampaign(PROPERTY, CAMPAIGN);
      expect(res).toEqual({ status: 'rejected', reason: 'incomplete-chain:missing-adset-or-ad-ids' });
      expect(mockActivateResource).not.toHaveBeenCalled();
    });
  });

  describe('B1/S2 — status truth: activation writes adCampaigns.status + effectiveStatus', () => {
    it('on full success, reads back effective_status and writes status=active + effectiveStatus on the doc', async () => {
      const snap = approvedSnap();
      const { db } = makeDb(snap);
      mockGetAdminDb.mockResolvedValue(db);
      mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, token: 'tok' });
      mockMetaGraphReadBacks({ effectiveStatus: 'IN_PROCESS' });
      mockActivateResource.mockResolvedValue({ ok: true, data: { success: true } });

      const res = await activateCampaign(PROPERTY, CAMPAIGN);

      expect(res).toEqual({ status: 'activated' });
      expect(snap.docs[0].ref.update).toHaveBeenCalledWith({
        status: 'active',
        effectiveStatus: 'IN_PROCESS',
        updatedAt: 'server-ts',
      });
    });

    it('a failed effective_status read-back does NOT flip a successful activation to rejected (best-effort)', async () => {
      const snap = approvedSnap();
      const { db } = makeDb(snap);
      mockGetAdminDb.mockResolvedValue(db);
      mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, token: 'tok' });
      mockMetaGraphReadBacks({ effectiveStatus: false });
      mockActivateResource.mockResolvedValue({ ok: true, data: { success: true } });

      const res = await activateCampaign(PROPERTY, CAMPAIGN);

      expect(res).toEqual({ status: 'activated' });
      expect(snap.docs[0].ref.update).toHaveBeenCalledWith({ status: 'active', updatedAt: 'server-ts' });
    });

    it('a failed Firestore status update does NOT flip a successful activation to rejected (Meta already activated)', async () => {
      const snap = approvedSnap();
      snap.docs[0].ref.update = jest.fn().mockRejectedValue(new Error('firestore unavailable'));
      const { db, addMock } = makeDb(snap);
      mockGetAdminDb.mockResolvedValue(db);
      mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, token: 'tok' });
      mockMetaGraphReadBacks();
      mockActivateResource.mockResolvedValue({ ok: true, data: { success: true } });

      const res = await activateCampaign(PROPERTY, CAMPAIGN);

      expect(res).toEqual({ status: 'activated' });
      expect(addMock.mock.calls.at(-1)?.[0]).toMatchObject({ result: 'activated' });
    });
  });

  it('rejects (does not throw) when the very first un-pause call (the campaign) itself fails', async () => {
    const { db } = makeDb(approvedSnap());
    mockGetAdminDb.mockResolvedValue(db);
    mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, token: 'tok' });
    mockMetaGraphReadBacks();
    mockActivateResource.mockResolvedValue({ ok: false, error: 'meta-down' });

    const res = await activateCampaign(PROPERTY, CAMPAIGN);
    expect(res).toEqual({ status: 'rejected', reason: 'activate-failed:campaign:camp-1:meta-down' });
    expect(mockPauseResource).not.toHaveBeenCalled(); // nothing had been activated yet to roll back
  });
});
