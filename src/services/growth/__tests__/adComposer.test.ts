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

// Phase 2b (§9f): `assetRef` (singular) -> `assetRefs` (array); `targeting`
// dropped ageMin/ageMax and gained `cities` as the primary control, with
// `countries` kept only as a fallback (S1).
const BASE_INPUT: ComposeAndCreateAdInput = {
  propertyId: PROPERTY,
  assetRefs: [
    {
      kind: 'gallery',
      storagePath: `properties/${PROPERTY}/images/a.jpg`,
      contentHash: 'hash123',
    },
  ],
  copy: [{ primary: 'Book your stay', headline: 'Escape to the mountains', cta: 'learn_more' }],
  objective: 'sales',
  landingBaseUrl: 'https://prahova-chalet.ro/book',
  dailyBudgetMinor: 5000, // 50 RON
  targeting: { cities: [], countries: ['RO'] },
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

describe('composeAndCreateAd — asset presence/ownership assert (S7, 2b: multiple assetRefs)', () => {
  it('rejects an empty assetRefs array', async () => {
    const res = await composeAndCreateAd({ ...BASE_INPUT, assetRefs: [] });
    expect(res).toEqual({ ok: false, error: 'no-asset-ref', stage: 'validation' });
    expect(mockUploadImageToAccount).not.toHaveBeenCalled();
  });

  it('rejects more than MAX_IMAGES (10) assetRefs', async () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => ({
      kind: 'gallery' as const,
      storagePath: `properties/${PROPERTY}/images/${i}.jpg`,
    }));
    const res = await composeAndCreateAd({ ...BASE_INPUT, assetRefs: tooMany });
    expect(res).toEqual({ ok: false, error: 'too-many-assets:11>10', stage: 'validation' });
    expect(mockUploadImageToAccount).not.toHaveBeenCalled();
  });

  it('rejects a storagePath that does not belong to propertyId', async () => {
    const res = await composeAndCreateAd({
      ...BASE_INPUT,
      assetRefs: [{ ...BASE_INPUT.assetRefs[0], storagePath: 'properties/some-other-property/images/a.jpg' }],
    });
    expect(res).toEqual({ ok: false, error: 'asset-ownership-mismatch', stage: 'validation' });
    expect(mockUploadImageToAccount).not.toHaveBeenCalled();
  });

  it('rejects when a SECOND assetRef fails ownership, even if the first is fine', async () => {
    const res = await composeAndCreateAd({
      ...BASE_INPUT,
      assetRefs: [
        BASE_INPUT.assetRefs[0],
        { kind: 'gallery', storagePath: 'properties/some-other-property/images/b.jpg' },
      ],
    });
    expect(res).toEqual({ ok: false, error: 'asset-ownership-mismatch', stage: 'validation' });
    expect(mockUploadImageToAccount).not.toHaveBeenCalled();
  });

  it('rejects an unsupported assetRefs[].kind', async () => {
    const res = await composeAndCreateAd({
      ...BASE_INPUT,
      assetRefs: [{ ...BASE_INPUT.assetRefs[0], kind: 'catalog' as 'gallery' }],
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

  it('rejects more than MAX_COPY_VARIANTS (5) copy variants', async () => {
    const tooMany = Array.from({ length: 6 }, (_, i) => ({ primary: `Variant ${i}`, cta: 'learn_more' as const }));
    const res = await composeAndCreateAd({ ...BASE_INPUT, copy: tooMany });
    expect(res).toEqual({ ok: false, error: 'too-many-copy-variants:6>5', stage: 'validation' });
  });

  it('rejects an unknown CTA on the first variant', async () => {
    const res = await composeAndCreateAd({
      ...BASE_INPUT,
      copy: [{ primary: 'x', cta: 'nonsense' as 'learn_more' }],
    });
    expect(res).toEqual({ ok: false, error: 'unknown-cta:nonsense', stage: 'validation' });
  });

  it('rejects an unknown CTA on a LATER variant too, not just the first', async () => {
    const res = await composeAndCreateAd({
      ...BASE_INPUT,
      copy: [
        { primary: 'Variant A', cta: 'learn_more' },
        { primary: 'Variant B', cta: 'nonsense' as 'learn_more' },
      ],
    });
    expect(res).toEqual({ ok: false, error: 'unknown-cta:nonsense', stage: 'validation' });
  });
});

describe('composeAndCreateAd — geo targeting (2b, §9f): cities primary, countries fallback', () => {
  it('rejects when neither cities nor countries are supplied', async () => {
    const res = await composeAndCreateAd({ ...BASE_INPUT, targeting: { cities: [] } });
    expect(res).toEqual({ ok: false, error: 'no-geo-targeting', stage: 'validation' });
    expect(mockUploadImageToAccount).not.toHaveBeenCalled();
  });

  it('falls back to geo_locations.countries (no location_types) when cities is empty', async () => {
    await composeAndCreateAd({ ...BASE_INPUT, targeting: { cities: [], countries: ['RO', 'GB'] } });
    const [, chainSpec] = mockCreateCampaignChain.mock.calls[0];
    expect(chainSpec.adSet.targeting).toEqual({ geo_locations: { countries: ['RO', 'GB'] } });
  });

  it('maps cities to geo_locations.cities (key+radius, distance_unit:kilometer) + location_types:[home,recent], IGNORING countries when cities is non-empty', async () => {
    await composeAndCreateAd({
      ...BASE_INPUT,
      targeting: {
        cities: [
          { key: '1910415', name: 'București', radius: 25 },
          { key: '1925836', name: 'Ploiești', radius: 15 },
        ],
        countries: ['RO'], // present but must be ignored once cities is non-empty
      },
    });
    const [, chainSpec] = mockCreateCampaignChain.mock.calls[0];
    expect(chainSpec.adSet.targeting).toEqual({
      geo_locations: {
        cities: [
          { key: '1910415', radius: 25, distance_unit: 'kilometer' },
          { key: '1925836', radius: 15, distance_unit: 'kilometer' },
        ],
        location_types: ['home', 'recent'],
      },
    });
  });

  it('NEVER sends age_min/age_max — advantage_audience:1 owns demographics (§9f), that default lives in campaignBuilder', async () => {
    await composeAndCreateAd(BASE_INPUT);
    const [, chainSpec] = mockCreateCampaignChain.mock.calls[0];
    expect(chainSpec.adSet.targeting).not.toHaveProperty('age_min');
    expect(chainSpec.adSet.targeting).not.toHaveProperty('age_max');
    expect(JSON.stringify(chainSpec.adSet.targeting)).not.toContain('advantage_audience'); // that default is campaignBuilder's job, not adComposer's
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

describe('composeAndCreateAd — happy path (single image, single copy): neutral → Meta mapping stays out of the public surface', () => {
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

    expect(mockUploadImageToAccount).toHaveBeenCalledTimes(1);
    expect(mockUploadImageToAccount).toHaveBeenCalledWith(PROPERTY, {
      storagePath: BASE_INPUT.assetRefs[0].storagePath,
      contentHash: BASE_INPUT.assetRefs[0].contentHash,
    });

    expect(mockCreateCampaignChain).toHaveBeenCalledTimes(1);
    const [calledPropertyId, chainSpec, calledAdCampaignId] = mockCreateCampaignChain.mock.calls[0];
    expect(calledPropertyId).toBe(PROPERTY);
    expect(calledAdCampaignId).toBe('gen-id-1');

    expect(chainSpec.campaign.objective).toBe('OUTCOME_SALES'); // neutral 'sales' -> Meta
    expect(chainSpec.adSet.dailyBudgetMinor).toBe(BASE_INPUT.dailyBudgetMinor);
    expect(chainSpec.adSet.endTime).toBe(BASE_INPUT.endTime);
    expect(chainSpec.adSet.targeting).toEqual({ geo_locations: { countries: ['RO'] } });

    // campaignBuilder (not adComposer) decides single-vs-dynamic from these lengths.
    expect(chainSpec.creative.imageHashes).toEqual(['img-hash-1']);
    expect(chainSpec.creative.copy).toEqual([{ primary: 'Book your stay', headline: 'Escape to the mountains' }]);
    expect(chainSpec.creative.callToActionType).toBe('LEARN_MORE'); // neutral 'learn_more' -> Meta
    expect(chainSpec.creative.link).toBe(
      'https://prahova-chalet.ro/book?utm_source=facebook&utm_medium=paid&utm_campaign=gen-id-1'
    );
  });

  it('maps every declared neutral CTA (of the FIRST copy variant) to a Meta CTA string', async () => {
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

describe('composeAndCreateAd — multi-image (Dynamic Creative path, §9f)', () => {
  it('uploads EVERY assetRef in order and collects all image hashes onto chainSpec.creative.imageHashes', async () => {
    mockUploadImageToAccount
      .mockResolvedValueOnce({ ok: true, data: { imageHash: 'hash-1' } })
      .mockResolvedValueOnce({ ok: true, data: { imageHash: 'hash-2' } })
      .mockResolvedValueOnce({ ok: true, data: { imageHash: 'hash-3' } });

    const input: ComposeAndCreateAdInput = {
      ...BASE_INPUT,
      assetRefs: [
        { kind: 'gallery', storagePath: `properties/${PROPERTY}/images/1.jpg` },
        { kind: 'gallery', storagePath: `properties/${PROPERTY}/images/2.jpg` },
        { kind: 'gallery', storagePath: `properties/${PROPERTY}/images/3.jpg` },
      ],
    };
    const res = await composeAndCreateAd(input);

    expect(res.ok).toBe(true);
    expect(mockUploadImageToAccount).toHaveBeenCalledTimes(3);
    expect(mockUploadImageToAccount).toHaveBeenNthCalledWith(1, PROPERTY, {
      storagePath: `properties/${PROPERTY}/images/1.jpg`,
      contentHash: undefined,
    });
    expect(mockUploadImageToAccount).toHaveBeenNthCalledWith(3, PROPERTY, {
      storagePath: `properties/${PROPERTY}/images/3.jpg`,
      contentHash: undefined,
    });

    const [, chainSpec] = mockCreateCampaignChain.mock.calls[0];
    expect(chainSpec.creative.imageHashes).toEqual(['hash-1', 'hash-2', 'hash-3']);
  });

  it('fails fast (upload stage) on the SECOND image and never calls createCampaignChain', async () => {
    mockUploadImageToAccount
      .mockResolvedValueOnce({ ok: true, data: { imageHash: 'hash-1' } })
      .mockResolvedValueOnce({ ok: false, error: 'image-too-narrow' });

    const input: ComposeAndCreateAdInput = {
      ...BASE_INPUT,
      assetRefs: [
        { kind: 'gallery', storagePath: `properties/${PROPERTY}/images/1.jpg` },
        { kind: 'gallery', storagePath: `properties/${PROPERTY}/images/2.jpg` },
      ],
    };
    const res = await composeAndCreateAd(input);

    expect(res).toEqual({ ok: false, error: 'upload-failed:image-too-narrow', stage: 'upload' });
    expect(mockUploadImageToAccount).toHaveBeenCalledTimes(2);
    expect(mockCreateCampaignChain).not.toHaveBeenCalled();
  });

  it('threads multiple copy variants through to chainSpec.creative.copy (primary/headline only, cta is NOT carried per-variant)', async () => {
    const input: ComposeAndCreateAdInput = {
      ...BASE_INPUT,
      copy: [
        { primary: 'Variant A', cta: 'learn_more' },
        { primary: 'Variant B', headline: 'B headline', cta: 'book_now' },
      ],
    };
    await composeAndCreateAd(input);
    const [, chainSpec] = mockCreateCampaignChain.mock.calls[0];
    expect(chainSpec.creative.copy).toEqual([
      { primary: 'Variant A', headline: undefined },
      { primary: 'Variant B', headline: 'B headline' },
    ]);
    // Only the FIRST variant's CTA becomes the ad's CTA (§9f's verified spike
    // only exercised a one-element call_to_action_types array).
    expect(chainSpec.creative.callToActionType).toBe('LEARN_MORE');
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
