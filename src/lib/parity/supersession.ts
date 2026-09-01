/**
 * Is a stored reading still describing something real?
 *
 * A capture is a photograph of a price under the settings that were live at that moment. Change a
 * discount, a rate plan or a minimum stay and some of those photographs stop describing anything —
 * while still looking exactly like evidence, and while still being recent.
 *
 * This rule existed three times, in three different states, which is the failure this module removes:
 *
 *  - `parity-audit` had it right: captured before the change, and long enough to be affected.
 *  - `parityView` — the board the owner actually reads — did not have it at all. It judged freshness
 *    purely by age, so six readings taken the afternoon before a change scored as current.
 *  - `parity-recheck` had only half of it: it matched on stay length and never looked at the capture
 *    date, so it re-queued cells that had been captured after the change and were already correct.
 *
 * Three views of one store, disagreeing about which of its rows were true. So the rule lives here, and
 * all three ask it.
 *
 * Pure. No I/O.
 */

/** A recorded change to a channel's own settings, as stored on the channel doc. */
export interface SettingsChange {
  /** YYYY-MM-DD, the day the owner made the change. */
  date: string;
  /** The stay length from which the change bites. A weekly discount does not touch a 2-night stay. */
  fromNights: number;
  note?: string;
}

/** Firestore hands timestamps back in three shapes; a capture date must survive all of them. */
export function captureDay(v: unknown): string {
  if (typeof v === 'string') return v.slice(0, 10);
  const o = v as { _seconds?: number; toDate?: () => Date } | null;
  if (o?._seconds) return new Date(o._seconds * 1000).toISOString().slice(0, 10);
  if (o?.toDate) return o.toDate().toISOString().slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return '';
}

/**
 * True when this reading was taken before a change that would have moved it.
 *
 * Same-day captures count as current. The change is recorded by DAY, not by time, so a same-day
 * reading is genuinely ambiguous — and the two errors are not symmetric: wrongly keeping a reading
 * risks one stale comparison, while wrongly discarding every same-day capture would throw away the
 * entire run that follows a change, which is exactly the run made to measure it.
 */
export function isSuperseded(
  capturedAt: unknown,
  nights: number,
  change: SettingsChange | undefined,
): boolean {
  if (!change) return false;
  if (nights < change.fromNights) return false;
  const day = captureDay(capturedAt);
  if (!day) return false;               // undated: not provably stale, and refusing to guess
  return day < change.date;
}

/** The reason, in the owner's terms, for a reading this rule has set aside. */
export function supersessionReason(change: SettingsChange): string {
  return `predates your own change of ${change.date} (${change.note ?? 'settings changed'})`;
}
