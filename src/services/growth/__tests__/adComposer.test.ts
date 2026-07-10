/** @jest-environment node */

jest.mock('@/lib/firebaseAdminSafe', () => ({ getAdminDb: jest.fn() }));
jest.mock('@/config/growth-ads', () => ({
  isAdsEngineEnabled: jest.fn(),
  getMaxDailyBudgetMinor: jest.fn(),
}));
jest.mock('../metaAds/adImages', () => ({ uploadImageToAccount: jest.fn() }));
jest.mock('../metaAds/campaignBuilder', () => ({ createCampaignChain: jest.fn() }));

import { composeAndCreateAd, validateDailyBudget, validateApprovalCap } from '../adComposer';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { isAdsEngineEnabled, getMaxDailyBudgetMinor } from '@/config/growth-ads';
import { uploadImageToAccount } from '../metaAds/adImages';
import { createCampaignChain } from '../metaAds/campaignBuilder';
import type { ComposeAndCreateAdInput } from '@/types';

const mockGetAdminDb = getAdminDb as jest.Mock;
const mockIsAdsEngineEnabled = isAdsEngineEnabled as jest.Mock;
const mockGetMaxDailyBudgetMinor = getMaxDailyBudgetMinor as jest.Mock;
const mockUploadImageToAccount = uploadImageToAccount as jest.Mock;
const mockCreateCampaignChain = createCampaignChain as jest.Mock;

const PROPERTY = 'prahova-mountain-chalet';

const BASE_INPUT: ComposeAndCreateAdInput = {
  propertyId: PROPERTY,
  assetRef: {
    kind: 'gallery',
    storagePath: `properties/${PROPERTY}/images/a.jpg`,
    contentHash: 'hash123',
  },
  copy: [{ primary: 'Book your stay', headline: 'Escape to the mountains', cta: 'learn_more' }],
  objective: 'sales',
  landingBaseUrl: 'https://prahova-chalet.ro/book',
  dailyBudgetMinor: 5000, // 50 RON
  targeting: { countries: ['RO'], ageMin: 30, ageMax: 45 },
  endTime: '2099-08-01T00:00:00Z',
};

function makeDb(generatedId = 'gen-id-1') {
  const idDoc = { id: generatedId };
  const docMock = jest.fn(() => idDoc);
  const db = { collection: jest.fn((name: string) => (name === 'adCampaigns' ? { doc: docMock } : (() => { throw new Error(`unexpected collection: ${name}`); })())) };
  return { db, docMock };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAdsEngineEnabled.mockReturnValue(true);
  mockGetMaxDailyBudgetMinor.mockReturnValue(20000); // 200 RON/day
  const { db } = makeDb();
  mockGetAdminDb.mockResolvedValue(db);
  mockUploadImageToAccount.mockResolvedValue({ ok: true, data: { imageHash: 'img-hash-1' } });
  mockCreateCampaignChain.mockResolvedValue({
    ok: true,
    campaignId: 'meta-campaign-1',
    adSetId: 'meta-adset-1',
    creativeId: 'meta-creative-1',
    adId: 'meta-ad-1',
    adCampaignId: 'gen-id-1',
  });
});

describe('composeAndCreateAd — master-switch gate', () => {
  it('refuses when the ads engine is disabled, before touching Storage/Meta/Firestore', async () => {
    mockIsAdsEngineEnabled.mockReturnValue(false);
    const res = await composeAndCreateAd(BASE_INPUT);
    expect(res).toEqual({ ok: false, error: 'ads-engine-disabled', stage: 'gate' });
    expect(mockGetAdminDb).not.toHaveBeenCalled();
    expect(mockUploadImageToAccount).not.toHaveBeenCalled();
    expect(mockCreateCampaignChain).not.toHaveBeenCalled();
  });
});

describe('composeAndCreateAd — MAX_DAILY_BUDGET_MINOR policy (B2)', () => {
  it('rejects a daily budget over the server-side max', async () => {
    mockGetMaxDailyBudgetMinor.mockReturnValue(20000);
    const res = await composeAndCreateAd({ ...BASE_INPUT, dailyBudgetMinor: 20001 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.stage).toBe('validation');
      expect(res.error).toContain('daily-budget-exceeds-max');
    }
    expect(mockUploadImageToAccount).not.toHaveBeenCalled();
  });

  it('accepts a daily budget exactly at the max', async () => {
    mockGetMaxDailyBudgetMinor.mockReturnValue(20000);
    const res = await composeAndCreateAd({ ...BASE_INPUT, dailyBudgetMinor: 20000 });
    expect(res.ok).toBe(true);
  });
});

describe('composeAndCreateAd — asset ownership assert (S7)', () => {
  it('rejects a storagePath that does not belong to propertyId', async () => {
    const res = await composeAndCreateAd({
      ...BASE_INPUT,
      assetRef: { ...BASE_INPUT.assetRef, storagePath: 'properties/some-other-property/images/a.jpg' },
    });
    expect(res).toEqual({ ok: false, error: 'asset-ownership-mismatch', stage: 'validation' });
    expect(mockUploadImageToAccount).not.toHaveBeenCalled();
  });

  it('rejects an unsupported assetRef.kind', async () => {
    const res = await composeAndCreateAd({
      ...BASE_INPUT,
      assetRef: { ...BASE_INPUT.assetRef, kind: 'catalog' as 'gallery' },
    });
    expect(res).toEqual({ ok: false, error: 'unsupported-asset-kind:catalog', stage: 'validation' });
  });
});

describe('composeAndCreateAd — required-field runtime guards', () => {
  it('rejects a missing/invalid endTime', async () => {
    const res = await composeAndCreateAd({ ...BASE_INPUT, endTime: 'not-a-date' });
    expect(res).toEqual({ ok: false, error: 'invalid-end-time', stage: 'validation' });
  });

  it('rejects an empty copy array', async () => {
    const res = await composeAndCreateAd({ ...BASE_INPUT, copy: [] });
    expect(res).toEqual({ ok: false, error: 'no-copy-variant', stage: 'validation' });
  });

  it('rejects an unknown CTA', async () => {
    const res = await composeAndCreateAd({
      ...BASE_INPUT,
      copy: [{ primary: 'x', cta: 'nonsense' as 'learn_more' }],
    });
    expect(res).toEqual({ ok: false, error: 'unknown-cta:nonsense', stage: 'validation' });
  });
});

describe('composeAndCreateAd — landing URL / UTM link building', () => {
  it('appends UTM params safely when the landing URL already carries a query string (no double "?")', async () => {
    const { db } = makeDb('gen-id-1');
    mockGetAdminDb.mockResolvedValue(db);
    await composeAndCreateAd({ ...BASE_INPUT, landingBaseUrl: 'https://prahova-chalet.ro/book?ref=hero' });
    const [, chainSpec] = mockCreateCampaignChain.mock.calls[0];
    expect(chainSpec.creative.link).toBe(
      'https://prahova-chalet.ro/book?ref=hero&utm_source=facebook&utm_medium=paid&utm_campaign=gen-id-1'
    );
  });

  it('rejects an unparseable landing URL with invalid-landing-url, before any upload', async () => {
    const { db } = makeDb('gen-id-1');
    mockGetAdminDb.mockResolvedValue(db);
    const res = await composeAndCreateAd({ ...BASE_INPUT, landingBaseUrl: 'not a url' });
    expect(res).toEqual({ ok: false, error: 'invalid-landing-url', stage: 'validation' });
    expect(mockUploadImageToAccount).not.toHaveBeenCalled();
  });
});

describe('composeAndCreateAd — happy path: neutral → Meta mapping stays out of the public surface', () => {
  it('allocates the id with NO Firestore write, threads utm_campaign into the link, uploads, and maps neutral→Meta before calling createCampaignChain', async () => {
    const { db, docMock } = makeDb('gen-id-1');
    mockGetAdminDb.mockResolvedValue(db);

    const res = await composeAndCreateAd(BASE_INPUT);

    expect(res).toEqual({
      ok: true,
      adCampaignId: 'gen-id-1',
      metaCampaignId: 'meta-campaign-1',
      metaAdSetId: 'meta-adset-1',
      metaAdId: 'meta-ad-1',
      creativeId: 'meta-creative-1',
    });

    // id allocation is pure — .doc() with NO argument, no .set()/.add()/.create() called by adComposer itself.
    expect(docMock).toHaveBeenCalledWith();

    expect(mockUploadImageToAccount).toHaveBeenCalledWith(PROPERTY, {
      storagePath: BASE_INPUT.assetRef.storagePath,
      contentHash: BASE_INPUT.assetRef.contentHash,
    });

    expect(mockCreateCampaignChain).toHaveBeenCalledTimes(1);
    const [calledPropertyId, chainSpec, calledAdCampaignId] = mockCreateCampaignChain.mock.calls[0];
    expect(calledPropertyId).toBe(PROPERTY);
    expect(calledAdCampaignId).toBe('gen-id-1');

    // NO cities anywhere in the spec (S1).
    expect(JSON.stringify(chainSpec)).not.toContain('cities');

    expect(chainSpec.campaign.objective).toBe('OUTCOME_SALES'); // neutral 'sales' -> Meta
    expect(chainSpec.adSet.dailyBudgetMinor).toBe(BASE_INPUT.dailyBudgetMinor);
    expect(chainSpec.adSet.endTime).toBe(BASE_INPUT.endTime);
    expect(chainSpec.adSet.targeting).toEqual({
      geo_locations: { countries: ['RO'] },
      age_min: 30,
      age_max: 45,
    });
    expect(chainSpec.creative.imageHash).toBe('img-hash-1');
    expect(chainSpec.creative.message).toBe('Book your stay');
    expect(chainSpec.creative.headline).toBe('Escape to the mountains');
    expect(chainSpec.creative.callToActionType).toBe('LEARN_MORE'); // neutral 'learn_more' -> Meta
    expect(chainSpec.creative.link).toBe(
      'https://prahova-chalet.ro/book?utm_source=facebook&utm_medium=paid&utm_campaign=gen-id-1'
    );
  });

  it('maps every declared neutral CTA to a Meta CTA string', async () => {
    for (const [neutral, meta] of [
      ['learn_more', 'LEARN_MORE'],
      ['book_now', 'BOOK_TRAVEL'],
      ['contact_us', 'CONTACT_US'],
    ] as const) {
      mockCreateCampaignChain.mockClear();
      await composeAndCreateAd({ ...BASE_INPUT, copy: [{ primary: 'x', cta: neutral }] });
      const [, chainSpec] = mockCreateCampaignChain.mock.calls[0];
      expect(chainSpec.creative.callToActionType).toBe(meta);
    }
  });
});

describe('composeAndCreateAd — id allocation failure', () => {
  it('returns a typed failure (never throws) when getAdminDb itself fails', async () => {
    mockGetAdminDb.mockRejectedValue(new Error('admin sdk unavailable'));
    const res = await composeAndCreateAd(BASE_INPUT);
    expect(res).toEqual({ ok: false, error: 'id-allocation-failed', stage: 'chain' });
    expect(mockUploadImageToAccount).not.toHaveBeenCalled();
  });
});

describe('composeAndCreateAd — upload failure', () => {
  it('surfaces the upload error and never calls createCampaignChain', async () => {
    mockUploadImageToAccount.mockResolvedValue({ ok: false, error: 'image-too-narrow' });
    const res = await composeAndCreateAd(BASE_INPUT);
    expect(res).toEqual({ ok: false, error: 'upload-failed:image-too-narrow', stage: 'upload' });
    expect(mockCreateCampaignChain).not.toHaveBeenCalled();
  });
});

describe('composeAndCreateAd — chain failure', () => {
  it('surfaces the chain stage+error', async () => {
    mockCreateCampaignChain.mockResolvedValue({ ok: false, error: 'no-pixel', stage: 'adSet' });
    const res = await composeAndCreateAd(BASE_INPUT);
    expect(res).toEqual({ ok: false, error: 'adSet:no-pixel', stage: 'chain' });
  });
});

describe('validateDailyBudget — neutral policy helper', () => {
  beforeEach(() => mockGetMaxDailyBudgetMinor.mockReturnValue(20000));

  it('accepts a positive budget within the max', () => {
    expect(validateDailyBudget(5000)).toEqual({ ok: true });
  });
  it('rejects zero/negative budgets', () => {
    expect(validateDailyBudget(0).ok).toBe(false);
    expect(validateDailyBudget(-1).ok).toBe(false);
  });
  it('rejects a budget over the max', () => {
    expect(validateDailyBudget(20001).ok).toBe(false);
  });
});

describe('validateApprovalCap — B2 spend-bound arithmetic (Fable OD6, neutral policy)', () => {
  it('passes when dailyBudget × days × 1.25 <= spendCap', () => {
    const endTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // ~3 days out
    // 5000 * 3 * 1.25 = 18750 <= 20000
    const res = validateApprovalCap({ dailyBudgetMinor: 5000, spendCapMinor: 20000, endTime });
    expect(res).toEqual({ ok: true });
  });

  it('rejects when the spend cap is too low for the daily budget and duration', () => {
    const endTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    // 5000 * 3 * 1.25 = 18750 > 10000
    const res = validateApprovalCap({ dailyBudgetMinor: 5000, spendCapMinor: 10000, endTime });
    expect(res.ok).toBe(false);
  });

  it('rejects a non-positive spend cap', () => {
    const endTime = new Date(Date.now() + 86400000).toISOString();
    expect(validateApprovalCap({ dailyBudgetMinor: 5000, spendCapMinor: 0, endTime }).ok).toBe(false);
  });

  it('rejects an end time in the past', () => {
    const endTime = new Date(Date.now() - 86400000).toISOString();
    const res = validateApprovalCap({ dailyBudgetMinor: 5000, spendCapMinor: 999999, endTime });
    expect(res).toEqual({ ok: false, reason: 'end-time-not-in-future' });
  });

  it('rejects an unparseable end time', () => {
    const res = validateApprovalCap({ dailyBudgetMinor: 5000, spendCapMinor: 999999, endTime: 'garbage' });
    expect(res).toEqual({ ok: false, reason: 'invalid-end-time' });
  });
});
