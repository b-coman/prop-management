/**
 * `redirect()` inside a server action works by THROWING a control-flow error that Next catches and
 * turns into a navigation. Any `try/catch` around the call therefore intercepts a success as if it
 * were a failure — which is exactly why deleting a season showed "Failed to delete… Please try again"
 * after the document was already gone, and why the season/override forms reported errors on success.
 *
 * Next only exports its own `isRedirectError` from an internal path (`next/dist/client/components/
 * redirect-error`), which is not a stable import. The digest prefix is, so match on that.
 */
const REDIRECT_DIGEST_PREFIX = 'NEXT_REDIRECT';
const NOT_FOUND_DIGEST = 'NEXT_NOT_FOUND';

/** True when the "error" is Next's redirect control flow and must be re-thrown, never swallowed. */
export function isNextRedirectError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string' && digest.startsWith(REDIRECT_DIGEST_PREFIX);
}

/** True for Next's `notFound()` control flow — same rule: re-throw, never swallow. */
export function isNextNotFoundError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return digest === NOT_FOUND_DIGEST;
}

/** Either of Next's control-flow throws. Re-throw these before treating an error as a real failure. */
export function isNextControlFlowError(error: unknown): boolean {
  return isNextRedirectError(error) || isNextNotFoundError(error);
}
