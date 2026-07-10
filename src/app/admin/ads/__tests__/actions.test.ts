/** @jest-environment node */

// Mock everything the money-touch actions call BEFORE importing the SUT —
// same discipline as adExecutionGateway.test.ts / adComposer.test.ts.
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

jest.mock('@/lib/authorization', () => {
  const actual = jest.requireActual('@/lib/authorization');
  return { ...actual, requireSuperAdmin: jest.fn() };
});

jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'server-ts') },
}));

jest.mock('@/services/growth/adComposer', () => ({
  composeAndCreateAd: jest.fn(),
  validateApprovalCap: jest.fn(),
}));

jest.mock('@/services/growth/adExecutionGateway', () => ({ activateCampaign: jest.fn() }));

jest.mock('@/services/growth/metaAds/lifecycle', () => ({ pauseCampaign: jest.fn() }));

jest.mock('@/services/growth/metaAds/insights', () => ({
  getInsights: jest.fn(),
  getEffectiveStatus: jest.fn(),
}));

jest.mock('@/services/growth/metaAds/adContext', () => ({ resolveAdContext: jest.fn() }));

import {
  composeAdAction,
  approveAdAction,
  activateAdAction,
  pauseAdAction,
  refreshAdInsightsAction,
} from '../actions';
import { requireSuperAdmin, AuthorizationError } from '@/lib/authorization';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { composeAndCreateAd, validateApprovalCap } from '@/services/growth/adComposer';
import { activateCampaign } from '@/services/growth/adExecutionGateway';
import { pauseCampaign } from '@/services/growth/metaAds/lifecycle';
import { getInsights, getEffectiveStatus } from '@/services/growth/metaAds/insights';
import type { ComposeAndCreateAdInput } from '@/types';

const mockRequireSuperAdmin = requireSuperAdmin as jest.Mock;
const mockGetAdminDb = getAdminDb as jest.Mock;
const mockComposeAndCreateAd = composeAndCreateAd as jest.Mock;
const mockValidateApprovalCap = validateApprovalCap as jest.Mock;
const mockActivateCampaign = activateCampaign as jest.Mock;
const mockPauseCampaign = pauseCampaign as jest.Mock;
const mockGetInsights = getInsights as jest.Mock;
const mockGetEffectiveStatus = getEffectiveStatus as jest.Mock;

const ACTOR = { uid: 'uid-1', email: 'operator@rentalspot.test', role: 'super_admin', managedProperties: [] };
const ADCAMPAIGN_ID = 'campaign-doc-1';
const PROPERTY = 'prahova-mountain-chalet';
const META_CAMPAIGN_ID = 'meta-campaign-1';

/** A `db.collection('adCampaigns').doc(id)` stub whose `.get()`/`.update()` are inspectable. */
function makeDb(docData: unknown, exists = true) {
  const updateMock = jest.fn().mockResolvedValue(undefined);
  const getMock = jest.fn().mockResolvedValue({ exists, id: ADCAMPAIGN_ID, data: () => docData });
  const docMock = jest.fn(() => ({ get: getMock, update: updateMock }));
  const db = {
    collection: jest.fn((name: string) => {
      if (name === 'adCampaigns') return { doc: docMock };
      throw new Error(`unexpected collection read in test: ${name}`);
    }),
  };
  return { db, getMock, updateMock, docMock };
}

const DRAFT_DOC = {
  propertyId: PROPERTY,
  metaCampaignId: META_CAMPAIGN_ID,
  status: 'draft',
  dailyBudgetMinor: 5000,
  endTime: '2099-01-01T00:00:00Z',
  creativeRef: 'creative-1',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireSuperAdmin.mockResolvedValue(ACTOR);
});

// ---------------------------------------------------------------------------
// composeAdAction — super-admin gate
// ---------------------------------------------------------------------------

describe('composeAdAction', () => {
  const INPUT: ComposeAndCreateAdInput = {
    propertyId: PROPERTY,
    assetRef: { kind: 'gallery', storagePath: `properties/${PROPERTY}/images/a.jpg` },
    copy: [{ primary: 'Book your stay', cta: 'learn_more' }],
    objective: 'sales',
    landingBaseUrl: 'https://prahova-chalet.ro',
    dailyBudgetMinor: 5000,
    targeting: { countries: ['RO'], ageMin: 25, ageMax: 65 },
    endTime: '2099-01-01T00:00:00Z',
  };

  it('gates on super-admin — rejects BEFORE calling composeAndCreateAd when not authorized', async () => {
    mockRequireSuperAdmin.mockRejectedValue(new AuthorizationError('nope', 'NOT_SUPER_ADMIN'));

    const res = await composeAdAction(INPUT);

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.stage).toBe('gate');
    expect(mockComposeAndCreateAd).not.toHaveBeenCalled();
  });

  it('calls composeAndCreateAd with the input verbatim (no actor field grafted on) and returns its result', async () => {
    mockComposeAndCreateAd.mockResolvedValue({
      ok: true,
      adCampaignId: 'gen-1',
      metaCampaignId: 'm-1',
      metaAdSetId: 'as-1',
      metaAdId: 'ad-1',
      creativeId: 'cr-1',
    });

    const res = await composeAdAction(INPUT);

    expect(mockRequireSuperAdmin).toHaveBeenCalledTimes(1);
    expect(mockComposeAndCreateAd).toHaveBeenCalledWith(INPUT);
    expect(res).toEqual({
      ok: true,
      adCampaignId: 'gen-1',
      metaCampaignId: 'm-1',
      metaAdSetId: 'as-1',
      metaAdId: 'ad-1',
      creativeId: 'cr-1',
    });
  });

  it('surfaces a failure result from composeAndCreateAd verbatim', async () => {
    mockComposeAndCreateAd.mockResolvedValue({ ok: false, error: 'ads-engine-disabled', stage: 'gate' });
    const res = await composeAdAction(INPUT);
    expect(res).toEqual({ ok: false, error: 'ads-engine-disabled', stage: 'gate' });
  });
});

// ---------------------------------------------------------------------------
// approveAdAction — state machine + spend-cap gate (S3/B2)
// ---------------------------------------------------------------------------

describe('approveAdAction', () => {
  it('gates on super-admin — rejects before touching Firestore', async () => {
    mockRequireSuperAdmin.mockRejectedValue(new AuthorizationError('nope', 'NOT_SUPER_ADMIN'));

    const res = await approveAdAction(ADCAMPAIGN_ID, 10000);

    expect(res.ok).toBe(false);
    expect(mockGetAdminDb).not.toHaveBeenCalled();
  });

  it('rejects with not-found when the doc does not exist', async () => {
    const { db } = makeDb(undefined, false);
    mockGetAdminDb.mockResolvedValue(db);

    const res = await approveAdAction(ADCAMPAIGN_ID, 10000);
    expect(res).toEqual({ ok: false, error: 'not-found' });
    expect(mockValidateApprovalCap).not.toHaveBeenCalled();
  });

  it('rejects a non-draft campaign with not-draft:<status> and never calls validateApprovalCap', async () => {
    const { db, updateMock } = makeDb({ ...DRAFT_DOC, status: 'active' });
    mockGetAdminDb.mockResolvedValue(db);

    const res = await approveAdAction(ADCAMPAIGN_ID, 10000);

    expect(res).toEqual({ ok: false, error: 'not-draft:active' });
    expect(mockValidateApprovalCap).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects when validateApprovalCap fails, surfacing its reason, and never writes the doc', async () => {
    const { db, updateMock } = makeDb(DRAFT_DOC);
    mockGetAdminDb.mockResolvedValue(db);
    mockValidateApprovalCap.mockReturnValue({ ok: false, reason: 'spend-cap-too-low:projected=6250>cap=1000' });

    const res = await approveAdAction(ADCAMPAIGN_ID, 1000);

    expect(mockValidateApprovalCap).toHaveBeenCalledWith({
      dailyBudgetMinor: DRAFT_DOC.dailyBudgetMinor,
      spendCapMinor: 1000,
      endTime: DRAFT_DOC.endTime,
    });
    expect(res).toEqual({ ok: false, error: 'spend-cap-too-low:projected=6250>cap=1000' });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('on success, writes status=approved + spendCapMinor + approvalSnapshot(with creativeRef) + approvedBy=session-actor', async () => {
    const { db, updateMock } = makeDb(DRAFT_DOC);
    mockGetAdminDb.mockResolvedValue(db);
    mockValidateApprovalCap.mockReturnValue({ ok: true });

    const res = await approveAdAction(ADCAMPAIGN_ID, 10000);

    expect(res).toEqual({ ok: true });
    expect(updateMock).toHaveBeenCalledWith({
      status: 'approved',
      spendCapMinor: 10000,
      approvalSnapshot: {
        dailyBudgetMinor: DRAFT_DOC.dailyBudgetMinor,
        spendCapMinor: 10000,
        creativeRef: DRAFT_DOC.creativeRef,
        at: 'server-ts',
      },
      approvedBy: ACTOR.email, // session actor, not a client-supplied value (S4)
      updatedAt: 'server-ts',
    });
  });
});

// ---------------------------------------------------------------------------
// activateAdAction — thin wrapper; actor derived from session (S4)
// ---------------------------------------------------------------------------

describe('activateAdAction', () => {
  it('gates on super-admin — rejects before touching Firestore or the gateway', async () => {
    mockRequireSuperAdmin.mockRejectedValue(new AuthorizationError('nope', 'NOT_SUPER_ADMIN'));

    const res = await activateAdAction(ADCAMPAIGN_ID);

    expect(res.status).toBe('rejected');
    expect(mockGetAdminDb).not.toHaveBeenCalled();
    expect(mockActivateCampaign).not.toHaveBeenCalled();
  });

  it('rejects with not-found when the doc does not exist, without calling the gateway', async () => {
    const { db } = makeDb(undefined, false);
    mockGetAdminDb.mockResolvedValue(db);

    const res = await activateAdAction(ADCAMPAIGN_ID);
    expect(res).toEqual({ status: 'rejected', reason: 'not-found' });
    expect(mockActivateCampaign).not.toHaveBeenCalled();
  });

  it('derives actor from the SESSION (requireSuperAdmin), never from the input, and passes it to the gateway', async () => {
    const { db } = makeDb({ propertyId: PROPERTY, metaCampaignId: META_CAMPAIGN_ID });
    mockGetAdminDb.mockResolvedValue(db);
    mockActivateCampaign.mockResolvedValue({ status: 'activated' });

    // activateAdAction takes ONLY an adCampaignId — there is no way for a
    // caller to inject an actor; this test locks that contract in.
    const res = await activateAdAction(ADCAMPAIGN_ID);

    expect(mockActivateCampaign).toHaveBeenCalledWith(PROPERTY, META_CAMPAIGN_ID, { actor: ACTOR.email });
    expect(res).toEqual({ status: 'activated' });
  });

  it('returns the gateway result verbatim (dry-run) and adds no money logic of its own', async () => {
    const { db } = makeDb({ propertyId: PROPERTY, metaCampaignId: META_CAMPAIGN_ID });
    mockGetAdminDb.mockResolvedValue(db);
    mockActivateCampaign.mockResolvedValue({ status: 'dry-run' });

    const res = await activateAdAction(ADCAMPAIGN_ID);
    expect(res).toEqual({ status: 'dry-run' });
  });

  it('returns the gateway rejection verbatim', async () => {
    const { db } = makeDb({ propertyId: PROPERTY, metaCampaignId: META_CAMPAIGN_ID });
    mockGetAdminDb.mockResolvedValue(db);
    mockActivateCampaign.mockResolvedValue({ status: 'rejected', reason: 'ownership-mismatch' });

    const res = await activateAdAction(ADCAMPAIGN_ID);
    expect(res).toEqual({ status: 'rejected', reason: 'ownership-mismatch' });
  });

  it('rejects (does not call the gateway) when the doc is missing propertyId/metaCampaignId', async () => {
    const { db } = makeDb({ propertyId: PROPERTY }); // no metaCampaignId
    mockGetAdminDb.mockResolvedValue(db);

    const res = await activateAdAction(ADCAMPAIGN_ID);
    expect(res).toEqual({ status: 'rejected', reason: 'doc-missing-propertyId-or-metaCampaignId' });
    expect(mockActivateCampaign).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// pauseAdAction — lighter coverage (never spends; STOP primitive)
// ---------------------------------------------------------------------------

describe('pauseAdAction', () => {
  it('gates on super-admin', async () => {
    mockRequireSuperAdmin.mockRejectedValue(new AuthorizationError('nope', 'NOT_SUPER_ADMIN'));
    const res = await pauseAdAction(ADCAMPAIGN_ID);
    expect(res.success).toBe(false);
    expect(mockPauseCampaign).not.toHaveBeenCalled();
  });

  it('on success, calls pauseCampaign and flips adCampaigns.status to paused', async () => {
    const { db, updateMock } = makeDb({ propertyId: PROPERTY, metaCampaignId: META_CAMPAIGN_ID });
    mockGetAdminDb.mockResolvedValue(db);
    mockPauseCampaign.mockResolvedValue({ success: true, campaignId: META_CAMPAIGN_ID });

    const res = await pauseAdAction(ADCAMPAIGN_ID);

    expect(mockPauseCampaign).toHaveBeenCalledWith(PROPERTY, META_CAMPAIGN_ID);
    expect(res).toEqual({ success: true, campaignId: META_CAMPAIGN_ID });
    expect(updateMock).toHaveBeenCalledWith({ status: 'paused', updatedAt: 'server-ts' });
  });

  it('does NOT flip status when pauseCampaign fails', async () => {
    const { db, updateMock } = makeDb({ propertyId: PROPERTY, metaCampaignId: META_CAMPAIGN_ID });
    mockGetAdminDb.mockResolvedValue(db);
    mockPauseCampaign.mockResolvedValue({ success: false, campaignId: META_CAMPAIGN_ID, error: 'no-ad-context' });

    const res = await pauseAdAction(ADCAMPAIGN_ID);
    expect(res).toEqual({ success: false, campaignId: META_CAMPAIGN_ID, error: 'no-ad-context' });
    expect(updateMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// refreshAdInsightsAction — read-only, lighter coverage
// ---------------------------------------------------------------------------

describe('refreshAdInsightsAction', () => {
  it('gates on super-admin', async () => {
    mockRequireSuperAdmin.mockRejectedValue(new AuthorizationError('nope', 'NOT_SUPER_ADMIN'));
    const res = await refreshAdInsightsAction(ADCAMPAIGN_ID);
    expect(res.ok).toBe(false);
    expect(mockGetInsights).not.toHaveBeenCalled();
  });

  it('writes insights + effectiveStatus + lastSyncedAt on success', async () => {
    const { db, updateMock } = makeDb({ propertyId: PROPERTY, metaCampaignId: META_CAMPAIGN_ID });
    mockGetAdminDb.mockResolvedValue(db);
    mockGetInsights.mockResolvedValue({
      ok: true,
      data: { spend: 12.5, impressions: 100, clicks: 4, purchases: 1, purchaseValue: 50, roas: 4 },
    });
    mockGetEffectiveStatus.mockResolvedValue({ ok: true, data: { effectiveStatus: 'ACTIVE' } });

    const res = await refreshAdInsightsAction(ADCAMPAIGN_ID);

    expect(res).toEqual({
      ok: true,
      insights: { spend: 12.5, impressions: 100, clicks: 4, bookings: 1, roas: 4 },
      effectiveStatus: 'ACTIVE',
    });
    expect(updateMock).toHaveBeenCalledWith({
      insights: { spend: 12.5, impressions: 100, clicks: 4, bookings: 1, roas: 4 },
      lastSyncedAt: 'server-ts',
      effectiveStatus: 'ACTIVE',
    });
  });

  it('a failed effective_status read-back does not block a successful insights write (best-effort)', async () => {
    const { db, updateMock } = makeDb({ propertyId: PROPERTY, metaCampaignId: META_CAMPAIGN_ID });
    mockGetAdminDb.mockResolvedValue(db);
    mockGetInsights.mockResolvedValue({
      ok: true,
      data: { spend: 0, impressions: 0, clicks: 0, purchases: 0, purchaseValue: 0, roas: 0 },
    });
    mockGetEffectiveStatus.mockResolvedValue({ ok: false, error: 'no-ad-context' });

    const res = await refreshAdInsightsAction(ADCAMPAIGN_ID);
    expect(res.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({
      insights: { spend: 0, impressions: 0, clicks: 0, bookings: 0, roas: 0 },
      lastSyncedAt: 'server-ts',
    });
  });
});
