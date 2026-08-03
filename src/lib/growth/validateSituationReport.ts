/**
 * validateSituationReport — enforces IN CODE what the analyst skill enforces in prose (arch §7 M2).
 * The LLM owns the judgement; this is the guard that its output cannot lie about structure:
 *
 *   HARD (reject → bounded repair):
 *     - every opportunity.action is on the menu;
 *     - a window-targeting action (whatsapp/ads/page) carries a window that sits INSIDE a real
 *       inventory.freeRuns entry — narrows-never-widens (the analyst cannot invent a free window).
 *   SOFT (surfaced as warnings, not blocking — grounding review during calibration):
 *     - each flag cites a pack path that resolves, and the cited value matches the pack.
 *
 * Value-match is soft on purpose: citation formats vary, and one mismatched digit should flag for
 * review, not block the whole report. The structural guarantees are the hard gate. Pure — no I/O.
 */
import type { AnalystOutput, AnalystOpportunity, Flag, RecommendedAction } from '@/lib/growth/contracts';

const MENU: RecommendedAction[] = ['whatsapp', 'ads', 'page', 'price', 'minstay', 'los', 'ota', 'none'];
const WINDOW_ACTIONS = new Set<RecommendedAction>(['whatsapp', 'ads', 'page']);

export interface SituationValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Resolve a dot/bracket path (e.g. "performance.byYear[0].revpar") into a value; undefined if absent. */
export function resolvePath(root: unknown, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let cur: unknown = root;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/** Whole days from a→b for two YYYY-MM-DD dates (UTC). */
const dayspan = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function validateSituationReport(pack: unknown, out: AnalystOutput): SituationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Free runs are present only when inventory is valid (withheld on a backtest). Each: {start,end,nights}.
  const inv = (pack as { inventory?: { valid?: boolean; freeRuns?: Array<{ start: string; end: string; nights: number }> } })?.inventory;
  const freeRuns = inv && inv.valid !== false && Array.isArray(inv.freeRuns) ? inv.freeRuns : [];

  // ── report shape ──
  const report = out?.report;
  if (!report || typeof report.headline !== 'string' || !report.headline.trim()) {
    errors.push('report.headline is missing or empty');
  }
  if (report && !Array.isArray(report.flags)) {
    errors.push('report.flags must be an array');
  }

  // ── flag grounding (SOFT) — every flag should cite a pack path that resolves to the value shown ──
  (report?.flags ?? []).forEach((f: Flag, i: number) => {
    if (!f?.evidence || typeof f.evidence.path !== 'string' || !f.evidence.path.trim()) {
      warnings.push(`flag[${i}] has no evidence.path (grounding)`);
      return;
    }
    const resolved = resolvePath(pack, f.evidence.path);
    if (resolved === undefined) {
      warnings.push(`flag[${i}] evidence.path "${f.evidence.path}" does not resolve in the pack`);
    } else if (f.evidence.value != null && String(resolved) !== String(f.evidence.value)) {
      warnings.push(`flag[${i}] evidence.value "${f.evidence.value}" != pack value "${String(resolved)}" at ${f.evidence.path}`);
    }
  });

  // ── opportunities (HARD) — on-menu + window ⊆ a real free run ──
  (out?.opportunities ?? []).forEach((o: AnalystOpportunity, i: number) => {
    if (!MENU.includes(o.action)) {
      errors.push(`opportunity[${i}] action "${o.action}" is off-menu (allowed: ${MENU.join(', ')})`);
      return;
    }
    if (WINDOW_ACTIONS.has(o.action)) {
      const w = o.window;
      if (!w || !w.start || !w.end) {
        errors.push(`opportunity[${i}] action "${o.action}" needs a window {start,end,nights} — a campaign targets a dated window`);
        return;
      }
      if (w.start > w.end) {
        errors.push(`opportunity[${i}] window start ${w.start} is after end ${w.end}`);
      }
      if (freeRuns.length) {
        // Nights-based fit: the window must sit inside ONE free run. Using nights (not the raw end
        // date) is robust to the checkout-vs-last-night convention: a run of N free nights from
        // r.start covers a booking of up to N nights starting on any date within [r.start, r.end].
        const nights = w.nights ?? Math.max(1, dayspan(w.start, w.end));
        const fits = freeRuns.some(r => w.start >= r.start && w.start <= r.end && dayspan(w.start, r.end) + 1 >= nights);
        if (!fits) {
          errors.push(`opportunity[${i}] window ${w.start}..${w.end} (${nights}n) is not inside any inventory.freeRuns entry — narrows-never-widens`);
        }
      } else {
        warnings.push(`opportunity[${i}] window not checked against free runs (inventory withheld — e.g. a backtest)`);
      }
    }
    if (!o.rationale || !o.rationale.trim()) {
      warnings.push(`opportunity[${i}] has no rationale`);
    }
  });

  return { ok: errors.length === 0, errors, warnings };
}
