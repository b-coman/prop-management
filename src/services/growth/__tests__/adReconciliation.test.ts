/** @jest-environment node */

import { detectDrift, LIVE_CAPABLE, parseUtmCampaign, utmCampaignsFromCreative } from '../adReconciliation';

describe('LIVE_CAPABLE', () => {
  it('includes `pushed` — the Meta chain exists from the push, so it can be activated in Ads Manager', () => {
    // Regression: a campaign pushed from /admin/ads and then switched on by hand on Meta stayed
    // `pushed` in Firestore. Excluding it here meant the doc was never reconciled, so the drift
    // detector below never ran on the one state where it matters most.
    expect(LIVE_CAPABLE).toContain('pushed');
  });

  it('still excludes states with no Meta chain', () => {
    expect(LIVE_CAPABLE).not.toContain('draft');
    expect(LIVE_CAPABLE).not.toContain('failed');
  });
});

describe('detectDrift', () => {
  it('returns no flags when Meta reports no effective_status', () => {
    expect(detectDrift('active', undefined)).toEqual([]);
  });

  it('is silent when our status and Meta agree (active/ACTIVE)', () => {
    expect(detectDrift('active', 'ACTIVE')).toEqual([]);
  });

  it('is silent when a paused doc is paused on Meta', () => {
    expect(detectDrift('paused', 'PAUSED')).toEqual([]);
  });

  it('flags a REJECTED / problem effective_status', () => {
    expect(detectDrift('active', 'REJECTED').some((f) => f.includes('will not deliver'))).toBe(true);
    expect(detectDrift('active', 'WITH_ISSUES').some((f) => f.includes('WITH_ISSUES'))).toBe(true);
  });

  it('flags the dangerous drift — DELIVERING when our record says it should not be', () => {
    const flags = detectDrift('paused', 'ACTIVE');
    expect(flags.some((f) => f.includes('DELIVERING when it should not be'))).toBe(true);
    // approved (not yet activated) delivering is also dangerous
    expect(detectDrift('approved', 'ACTIVE').some((f) => f.includes('DELIVERING'))).toBe(true);
    // pushed = on Meta but PAUSED as far as we know; ACTIVE means someone flipped it outside the app
    expect(detectDrift('pushed', 'ACTIVE').some((f) => f.includes('DELIVERING when it should not be'))).toBe(true);
  });

  it('flags the benign drift — we think active but Meta shows it paused (nothing running)', () => {
    expect(detectDrift('active', 'CAMPAIGN_PAUSED').some((f) => f.includes('not actually delivering'))).toBe(true);
  });
});

describe('parseUtmCampaign', () => {
  it('reads utm_campaign from a real ad link', () => {
    expect(parseUtmCampaign('https://prahova-chalet.ro/lp/toamna-lunga/ro?utm_source=facebook&utm_medium=paid&utm_campaign=OU3kBSXI2FkiJxxp7vkr'))
      .toBe('OU3kBSXI2FkiJxxp7vkr');
  });
  it('is null when the link carries no campaign', () => {
    expect(parseUtmCampaign('https://prahova-chalet.ro/lp/toamna-lunga/ro?utm_source=facebook')).toBeNull();
  });
  it('is null for missing/empty input rather than throwing', () => {
    expect(parseUtmCampaign(null)).toBeNull();
    expect(parseUtmCampaign(undefined)).toBeNull();
    expect(parseUtmCampaign('')).toBeNull();
  });
  it('still reads a relative or malformed link', () => {
    expect(parseUtmCampaign('/lp/toamna-lunga/ro?utm_campaign=abc123')).toBe('abc123');
  });
});

describe('utmCampaignsFromCreative', () => {
  it('reads the Dynamic Creative shape (asset_feed_spec.link_urls)', () => {
    // The shape the live Constanta retry actually returns.
    expect(utmCampaignsFromCreative({
      asset_feed_spec: { link_urls: [{ website_url: 'https://prahova-chalet.ro/lp/x/ro?utm_campaign=OU3kBSXI2FkiJxxp7vkr' }] },
    })).toEqual(['OU3kBSXI2FkiJxxp7vkr']);
  });

  it('reads the single-image shape (object_story_spec.link_data.link)', () => {
    expect(utmCampaignsFromCreative({
      object_story_spec: { link_data: { link: 'https://prahova-chalet.ro/lp/x/ro?utm_campaign=D8bMrAmnf1wnZTREMIhL' } },
    })).toEqual(['D8bMrAmnf1wnZTREMIhL']);
  });

  it('reads url_tags, which is a bare query fragment with no leading ?', () => {
    expect(utmCampaignsFromCreative({ url_tags: 'utm_source=facebook&utm_campaign=tagged123' })).toEqual(['tagged123']);
  });

  it('dedupes when every image in a dynamic creative points at the same link', () => {
    const one = { website_url: 'https://prahova-chalet.ro/lp/x/ro?utm_campaign=same' };
    expect(utmCampaignsFromCreative({ asset_feed_spec: { link_urls: [one, one, one] } })).toEqual(['same']);
  });

  it('is empty for a creative with no link at all', () => {
    expect(utmCampaignsFromCreative({})).toEqual([]);
    expect(utmCampaignsFromCreative(undefined)).toEqual([]);
  });
});
