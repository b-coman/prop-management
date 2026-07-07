/**
 * Growth Engine runtime configuration & dark-launch flags.
 *
 * Everything defaults to OFF / dry-run: the engine is inert in production until
 * `GROWTH_ENGINE_ENABLED=true` is set at deploy time, and NO real message is
 * ever delivered until `GROWTH_ENGINE_SEND_MODE=live` is ALSO set. This is the
 * safety model from plans/growth-engine.md §0.2 — a stray env var alone cannot
 * message a real guest.
 *
 * Plain module (not `'use server'`) so it can export constants and be imported
 * by both server services and (flag reads only) client code.
 */

export type SendMode = 'dry-run' | 'live';

/** Master kill switch. Default OFF — requires a deploy-time env var to enable. */
export function isGrowthEngineEnabled(): boolean {
  return process.env.GROWTH_ENGINE_ENABLED === 'true';
}

/**
 * Effective send mode. Defaults to 'dry-run'. Only resolves to 'live' when BOTH
 * the engine is enabled AND `GROWTH_ENGINE_SEND_MODE=live` — two independent
 * switches must be flipped before anything is delivered.
 */
export function getSendMode(): SendMode {
  if (!isGrowthEngineEnabled()) return 'dry-run';
  return process.env.GROWTH_ENGINE_SEND_MODE === 'live' ? 'live' : 'dry-run';
}

/** True only when a real message may be delivered. */
export function isLiveSendAllowed(): boolean {
  return getSendMode() === 'live';
}

/** Delivery guardrails used by campaign sends (all overridable via env). */
export const GROWTH_ENGINE_LIMITS = {
  /** Max messages delivered per campaign run. */
  perRunCap: Number(process.env.GROWTH_ENGINE_PER_RUN_CAP) || 50,
  /** Delay between deliveries (ms) to protect the WhatsApp sender number. */
  throttleMs: Number(process.env.GROWTH_ENGINE_THROTTLE_MS) || 1500,
  /** Quiet hours in property-local time (Europe/Bucharest) — no sends inside. */
  quietHoursStart: 21,
  quietHoursEnd: 9,
} as const;
