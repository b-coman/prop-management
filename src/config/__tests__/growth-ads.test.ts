/** @jest-environment node */
import { isAdsEngineEnabled, getAdsMode, isAdsLiveAllowed } from '../growth-ads';

/**
 * The two-switch safety matrix for the ads/spend path: NOTHING is live unless
 * BOTH GROWTH_ADS_ENABLED=true and GROWTH_ADS_MODE=live are set, with strict
 * string equality so any fuzzy value fails toward dry-run. Mirrors
 * growth-engine.test.ts exactly, for the money path (Fable H5).
 */
describe('growth-ads flags — two-switch safety matrix', () => {
  const orig = { ...process.env };
  afterEach(() => {
    process.env = { ...orig };
  });

  it('defaults to dry-run when nothing is set', () => {
    delete process.env.GROWTH_ADS_ENABLED;
    delete process.env.GROWTH_ADS_MODE;
    expect(isAdsEngineEnabled()).toBe(false);
    expect(getAdsMode()).toBe('dry-run');
    expect(isAdsLiveAllowed()).toBe(false);
  });

  it('ENABLED alone stays dry-run', () => {
    process.env.GROWTH_ADS_ENABLED = 'true';
    delete process.env.GROWTH_ADS_MODE;
    expect(isAdsEngineEnabled()).toBe(true);
    expect(getAdsMode()).toBe('dry-run');
    expect(isAdsLiveAllowed()).toBe(false);
  });

  it('MODE=live alone (engine off) stays dry-run', () => {
    delete process.env.GROWTH_ADS_ENABLED;
    process.env.GROWTH_ADS_MODE = 'live';
    expect(getAdsMode()).toBe('dry-run');
    expect(isAdsLiveAllowed()).toBe(false);
  });

  it('both switches on → live', () => {
    process.env.GROWTH_ADS_ENABLED = 'true';
    process.env.GROWTH_ADS_MODE = 'live';
    expect(getAdsMode()).toBe('live');
    expect(isAdsLiveAllowed()).toBe(true);
  });

  it('fuzzy values fail safe (strict equality)', () => {
    process.env.GROWTH_ADS_ENABLED = 'TRUE';
    process.env.GROWTH_ADS_MODE = 'live';
    expect(getAdsMode()).toBe('dry-run');

    process.env.GROWTH_ADS_ENABLED = 'true';
    process.env.GROWTH_ADS_MODE = 'LIVE ';
    expect(getAdsMode()).toBe('dry-run');

    process.env.GROWTH_ADS_ENABLED = '1';
    process.env.GROWTH_ADS_MODE = 'live';
    expect(getAdsMode()).toBe('dry-run');
  });
});
