/** @jest-environment node */

/**
 * C2, enforced rather than intended: **a competitor observation never moves a price.**
 *
 * The rule is easy to state and easy to erode. Someone adds a "market context" line to the band
 * report, then a threshold that reads it, and a competitor's price is deciding the owner's rate with
 * nobody having decided that it should. By then it is not a line to delete, it is a dependency.
 *
 * So the boundary is a test, and it exists BEFORE `src/lib/competitive/` does. It passes trivially
 * today and starts biting the moment Phase 1 lands, which is the only time such a test is cheap to
 * write and the only time it is worth writing.
 *
 * If a future change genuinely needs to cross this line, the fix is to argue it with the owner and
 * amend C2 in `docs/competitive-position-engine.md` — not to add a path to the allowlist.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..', '..');

/** Everything that decides, proposes or writes a price. None of these may read competitor data. */
const PRICE_DECIDING_PATHS = [
  'scripts/apply-band-pricing.ts',
  'scripts/set-holiday-window.ts',
  'scripts/analysis/band-verify.ts',
  'scripts/refresh-direct-quotes.ts',
  'src/lib/pricing/priceProjection.ts',
  'src/lib/pricing/anchorPricing.ts',
  'src/lib/pricing/rateSheet.ts',
  'src/lib/pricing/periods.ts',
  'src/lib/pricing/price-calculation.ts',
  'src/app/admin/pricing/actions.ts',
  'src/app/admin/pricing/server-actions-hybrid.ts',
  'src/app/admin/pricing/year-actions.ts',
];

const FORBIDDEN = /from\s+['"](?:@\/lib\/competitive|.*\.\.\/competitive)[^'"]*['"]|require\(\s*['"][^'"]*competitive[^'"]*['"]\s*\)/;

describe('the pricing solver cannot read competitor data (C2)', () => {
  it.each(PRICE_DECIDING_PATHS)('%s does not import from lib/competitive', (rel) => {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) return; // a path that has moved is not a violation
    expect(readFileSync(abs, 'utf8')).not.toMatch(FORBIDDEN);
  });

  it('lists paths that actually exist, so the guard cannot rot into a no-op', () => {
    // If every entry disappeared (renamed, moved), the suite above would pass while guarding nothing.
    const present = PRICE_DECIDING_PATHS.filter((p) => existsSync(join(ROOT, p)));
    expect(present.length).toBeGreaterThanOrEqual(PRICE_DECIDING_PATHS.length - 2);
  });
});

describe('competitive modules stay pure and one-directional', () => {
  const dir = join(ROOT, 'src', 'lib', 'competitive');

  it('does not import the pricing solver back (no cycle through the boundary)', () => {
    if (!existsSync(dir)) return; // Phase 1 has not landed yet
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8');
      expect(src).not.toMatch(/from\s+['"]@\/lib\/pricing\/(priceProjection|anchorPricing|rateSheet)['"]/);
    }
  });

  it('contains no I/O — these modules must stay unit-testable', () => {
    if (!existsSync(dir)) return;
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => {
      const p = join(d, f);
      return statSync(p).isDirectory() ? walk(p) : (f.endsWith('.ts') && !f.includes('.test.') ? [p] : []);
    });
    for (const p of walk(dir)) {
      const src = readFileSync(p, 'utf8');
      expect(src).not.toMatch(/firebaseAdminSafe|getAdminDb|\bfetch\s*\(/);
    }
  });
});
