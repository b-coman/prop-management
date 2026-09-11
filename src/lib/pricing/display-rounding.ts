/**
 * Make a price breakdown add up on screen.
 *
 * THE BUG. Every figure in the booking flow goes through `formatPrice`, which does `Math.round`.
 * Rounding each line on its own and the total on its own means `round(a) + round(b)` need not equal
 * `round(a + b)`. In RON, the base currency, this never showed: 2267.4 and 200 round to 2267 and
 * 200, and the total 2467.4 rounds to 2467, which is exactly their sum. Convert the same stay to
 * euros and the drawer read 455 + 40 with a total of 496 - a breakdown that does not add up, on the
 * one screen whose whole job is to make a price feel honest. The desktop panel is worse: it can
 * render one line PER NIGHT, so the error accumulates across every night of the stay.
 *
 * WHICH NUMBER WINS. The total. It is what the guest is asked to pay, so it is never adjusted to
 * suit the lines; the lines are adjusted to reconcile to it.
 *
 * HOW. The largest-remainder method: floor everything, then hand out the leftover units one at a
 * time to whichever lines were cut by the most. That puts the correction where it is least visible
 * and keeps every line within one unit of its true value, which "dump the residual on the biggest
 * line" does not guarantee.
 *
 * NOT A PRICING CHANGE. This is display only. Nothing here touches what is charged, and callers
 * pass amounts ALREADY converted to the display currency - conversion stays in CurrencyContext.
 */

/**
 * Round `amounts` to whole units so that they sum exactly to `Math.round(total)`.
 *
 * Returns integers in the same order. Handles negative entries (discounts) and tolerates a `total`
 * that is not the exact sum of `amounts` - a caller that omits a line from the display still gets
 * lines that reconcile, because the residual is absorbed rather than dropped.
 */
export function reconcileRoundedAmounts(amounts: number[], total: number): number[] {
  if (amounts.length === 0) return [];

  const target = Math.round(total);
  const floors = amounts.map((a) => Math.floor(a));
  const sumFloors = floors.reduce((acc, n) => acc + n, 0);

  // How many whole units are still unallocated. Positive in the normal case (flooring lost
  // fractions); negative only when `total` is not the sum of the lines.
  let residual = target - sumFloors;

  // Largest fractional part first — the lines that lost the most to flooring get the units back.
  // Ties resolve by original position, so the output is deterministic for a given input.
  const byRemainder = amounts
    .map((a, i) => ({ i, remainder: a - Math.floor(a) }))
    .sort((x, y) => y.remainder - x.remainder || x.i - y.i);

  const out = [...floors];
  let cursor = 0;
  while (residual > 0) {
    out[byRemainder[cursor % byRemainder.length].i] += 1;
    residual -= 1;
    cursor += 1;
  }
  // Negative residual: take units back from the lines that lost the least, i.e. walk the same
  // ordering from the other end.
  cursor = 0;
  while (residual < 0) {
    const idx = byRemainder[byRemainder.length - 1 - (cursor % byRemainder.length)].i;
    out[idx] -= 1;
    residual += 1;
    cursor += 1;
  }

  return out;
}
