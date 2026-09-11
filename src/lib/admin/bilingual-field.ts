/**
 * One zod schema for an admin field that may be plain text or `{en, ro}`.
 *
 * WHY IT EXISTS. `cancellationPolicy` was typed `z.string()` in both the client form and the server
 * action, and the form loaded only the `.en` half into a single textarea. Opening a property in
 * admin and pressing Save therefore replaced `{en, ro}` with the English string, and the Romanian
 * text was gone with no error and no warning. That was harmless for as long as nothing rendered the
 * field. The booking page renders it now, so one admin save would put English cancellation terms in
 * front of every Romanian guest - and the Bucharest apartment's policy is already a bare English
 * string, which is very likely how.
 *
 * It lives in `lib` rather than beside either caller because BOTH have to agree: a bilingual form in
 * front of a `z.string()` server action still flattens on write, since the server schema is what
 * reaches Firestore. Two copies of this transform is exactly the drift that caused the bug, so
 * there is one.
 *
 * NOT A MIGRATION. A value that is already a plain string stays a plain string - every reader goes
 * through `serverTranslateContent`, which handles both shapes, so widening a field is a decision for
 * whoever fills in the second language, not a side effect of saving an unrelated form.
 */
import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';

/**
 * Accepts a string or a `{lang: text}` map and sanitises every branch.
 *
 * Empty languages are dropped rather than stored as `''`, so a property whose RO tab was never
 * touched keeps no empty key - `serverTranslateContent` falls back to English on a missing key but
 * would happily return an empty string for a present one, which renders as a blank policy instead
 * of the English text.
 */
export const bilingualTextSchema = z
  .union([z.string(), z.record(z.string())])
  .optional()
  .transform((val) => {
    if (!val) return '';
    if (typeof val === 'string') return sanitizeText(val);

    const out: Record<string, string> = {};
    for (const [lang, text] of Object.entries(val)) {
      if (text) out[lang] = sanitizeText(text);
    }
    // Every language was blank. Returning `{}` would be a truthy value that reads as empty
    // everywhere downstream; '' is the shape the rest of the form uses for "nothing here".
    return Object.keys(out).length > 0 ? out : '';
  });
