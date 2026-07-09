/**
 * Growth Ad Engine (Meta Ads) runtime configuration & dark-launch flags —
 * Phase 0 (plans §9, §13 H5).
 *
 * Mirrors `src/config/growth-engine.ts`'s two-switch safety model EXACTLY, but
 * for the ads/spend path: everything defaults to OFF / dry-run. The ads engine
 * is inert until `GROWTH_ADS_ENABLED=true` is set at deploy time, and no Meta
 * campaign is ever un-paused until `GROWTH_ADS_MODE=live` is ALSO set. This is
 * the same discipline as the messaging path — a stray env var (or a UI click)
 * alone can never spend real money.
 *
 * Plain module (not `'use server'`) so it can export constants and be
 * imported by both server services and (flag reads only) client code.
 */

export type AdsMode = 'dry-run' | 'live';

/** Master kill switch for the ads engine. Default OFF — requires a deploy-time env var. */
export function isAdsEngineEnabled(): boolean {
  return process.env.GROWTH_ADS_ENABLED === 'true';
}

/**
 * Effective ads mode. Defaults to 'dry-run'. Only resolves to 'live' when BOTH
 * the ads engine is enabled AND `GROWTH_ADS_MODE=live` — two independent
 * switches must be flipped before any Meta campaign can be un-paused.
 */
export function getAdsMode(): AdsMode {
  if (!isAdsEngineEnabled()) return 'dry-run';
  return process.env.GROWTH_ADS_MODE === 'live' ? 'live' : 'dry-run';
}

/**
 * True only when a real (spend-affecting) Meta activation may be performed.
 * `adExecutionGateway.activateCampaign` is a no-op live-action whenever this
 * is false — the money-path gate (Fable H5).
 */
export function isAdsLiveAllowed(): boolean {
  return getAdsMode() === 'live';
}
