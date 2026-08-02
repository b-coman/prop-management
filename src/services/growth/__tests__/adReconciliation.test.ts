/** @jest-environment node */

import { detectDrift } from '../adReconciliation';

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
  });

  it('flags the benign drift — we think active but Meta shows it paused (nothing running)', () => {
    expect(detectDrift('active', 'CAMPAIGN_PAUSED').some((f) => f.includes('not actually delivering'))).toBe(true);
  });
});
