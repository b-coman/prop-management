/**
 * staysSummary — what a list of stays has in COMMON, so a page can say it once.
 *
 * WHY. Auto-weekend cards differ in exactly one field. Rendering them as a card grid repeats
 * "Vineri → duminică · 2 nopți", "de la 1.253 RON", "pentru 3 persoane, curățenia inclusă" and a
 * button five times to communicate five dates — five screens of scrolling on a phone to read the
 * same sentence five times. The compact layout states the shared part once and shows only the
 * choice.
 *
 * THE HONESTY PROBLEM this solves. A single "1.253 RON" line above a row of dates is true only
 * while every date really costs that. Reprice one weekend and the summary silently starts lying
 * about four others. So nothing is hoisted into the summary unless it is identical across EVERY
 * stay; whatever differs stays on its own chip, where it can only describe itself. The page then
 * degrades gracefully instead of misquoting — the same discipline as quoting the engine per render
 * rather than storing a price.
 *
 * Pure, so the judgement is unit-testable without a renderer.
 */

/** The subset of a rendered stay this needs. Deliberately structural — it takes the model's stays. */
export interface SummarisableStay {
  nights: number;
  priceHint?: number | null;
  label?: string | null;
  note?: string | null;
  guests?: number | null;
}

export interface SharedStayFacts {
  /** Present only when every stay agrees. `null` means "differs — leave it on the chip". */
  nights: number | null;
  price: number | null;
  label: string | null;
  note: string | null;
  guests: number | null;
}

/** The one value every item shares, or null if they disagree (or there is nothing to compare). */
function common<T>(values: Array<T | null | undefined>): T | null {
  if (!values.length) return null;
  const first = values[0];
  if (first === null || first === undefined) return null;
  return values.every((v) => v === first) ? (first as T) : null;
}

/**
 * What these stays have in common. An empty list, or a single stay, still answers honestly: with one
 * stay everything is "shared", which is correct — there is nothing it could contradict.
 */
export function sharedStayFacts(stays: SummarisableStay[]): SharedStayFacts {
  return {
    nights: common(stays.map((s) => s.nights)),
    price: common(stays.map((s) => s.priceHint)),
    label: common(stays.map((s) => s.label)),
    note: common(stays.map((s) => s.note)),
    guests: common(stays.map((s) => s.guests)),
  };
}
