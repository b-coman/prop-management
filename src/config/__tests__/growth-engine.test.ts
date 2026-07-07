/** @jest-environment node */
import { isGrowthEngineEnabled, getSendMode, isLiveSendAllowed } from '../growth-engine';

/**
 * The two-switch safety matrix: NOTHING is live unless BOTH
 * GROWTH_ENGINE_ENABLED=true and GROWTH_ENGINE_SEND_MODE=live are set, with
 * strict string equality so any fuzzy value fails toward dry-run.
 */
describe('growth-engine flags — two-switch safety matrix', () => {
  const orig = { ...process.env };
  afterEach(() => {
    process.env = { ...orig };
  });

  it('defaults to dry-run when nothing is set', () => {
    delete process.env.GROWTH_ENGINE_ENABLED;
    delete process.env.GROWTH_ENGINE_SEND_MODE;
    expect(isGrowthEngineEnabled()).toBe(false);
    expect(getSendMode()).toBe('dry-run');
    expect(isLiveSendAllowed()).toBe(false);
  });

  it('ENABLED alone stays dry-run', () => {
    process.env.GROWTH_ENGINE_ENABLED = 'true';
    delete process.env.GROWTH_ENGINE_SEND_MODE;
    expect(isGrowthEngineEnabled()).toBe(true);
    expect(getSendMode()).toBe('dry-run');
  });

  it('SEND_MODE=live alone (engine off) stays dry-run', () => {
    delete process.env.GROWTH_ENGINE_ENABLED;
    process.env.GROWTH_ENGINE_SEND_MODE = 'live';
    expect(getSendMode()).toBe('dry-run');
  });

  it('both switches on → live', () => {
    process.env.GROWTH_ENGINE_ENABLED = 'true';
    process.env.GROWTH_ENGINE_SEND_MODE = 'live';
    expect(getSendMode()).toBe('live');
    expect(isLiveSendAllowed()).toBe(true);
  });

  it('fuzzy values fail safe (strict equality)', () => {
    process.env.GROWTH_ENGINE_ENABLED = 'TRUE';
    process.env.GROWTH_ENGINE_SEND_MODE = 'live';
    expect(getSendMode()).toBe('dry-run');

    process.env.GROWTH_ENGINE_ENABLED = 'true';
    process.env.GROWTH_ENGINE_SEND_MODE = 'LIVE ';
    expect(getSendMode()).toBe('dry-run');

    process.env.GROWTH_ENGINE_ENABLED = '1';
    process.env.GROWTH_ENGINE_SEND_MODE = 'live';
    expect(getSendMode()).toBe('dry-run');
  });
});
