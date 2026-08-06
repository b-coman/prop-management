/** @jest-environment node */

import { detectDrift, LIVE_CAPABLE } from '../adReconciliation';

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
